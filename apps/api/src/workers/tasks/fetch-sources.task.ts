import { createHash } from 'node:crypto';

import type { AppLogger } from '../../core/logger.js';
import type { SourceRepository, DueSource } from '../../modules/source/source.repository.js';
import type { PeriodicTask, TaskOutcome } from '../periodic-task.js';

/**
 * Phase 0 — fetch every due source, hash it, record what happened.
 *
 * NO PARSING. Nothing here reads meaning out of a page or writes to a
 * user-facing table. It answers "what changes, and how often" and stops there,
 * because every parser decision downstream should be made against a month of
 * evidence rather than an assumption about how often NTA updates a page.
 *
 * Deliberately polite, in ways that are also cheap:
 *   - robots.txt is checked before a URL is fetched, ever
 *   - conditional requests, so an unchanged 2 MB PDF costs a 304
 *   - one request at a time, with a gap between them
 *   - a real User-Agent naming the site and a contact route
 */

const USER_AGENT =
  'SchoolToCareerBot/1.0 (+https://schooltocareer.in/about; monitors official exam notices)';

/**
 * Bodies larger than this are hashed in full but stored truncated.
 *
 * Raised from 512 kB after measurement. NTA's notice archive is 2.2 MB, and at
 * the old cap we kept 23% of it — while `rawTruncated` correctly forbids
 * parsing a partial body, which left the single most valuable fetchable source
 * on the list unusable by Phase 1. The exam subdomains it would have to
 * substitute for are behind a bot wall (docs/architecture/source-acquisition.md),
 * so this page is not one option among several.
 *
 * Cost is modest: bodies are stored ONLY on a change, and HTML TOASTs well.
 * `rawLocation` exists for the point where this stops being true.
 */
const MAX_STORED_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
/** Gap between requests. Twenty sources at 1.5s is 30s of wall clock, and no
 *  official site should ever see a burst from us. */
const DELAY_BETWEEN_MS = 1_500;
const BATCH = 25;
/** robots.txt is re-checked weekly, not per fetch. */
const ROBOTS_TTL_MS = 7 * 24 * 3_600_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalises before hashing so cosmetic churn is not reported as a change.
 *
 * Without this, a page carrying a "generated at" timestamp or a rotating CSRF
 * token registers as changed on every single poll, and the change signal —
 * the entire point of this phase — becomes noise.
 */
function normalise(body: string): string {
  return body
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The most specific line a thrown fetch error carries.
 *
 * undici reports every transport failure as "fetch failed", which names
 * nothing. The cause holds the certificate mismatch or the DNS error that
 * actually has to be fixed, and that string is the whole value of the record.
 */
function describe(error: unknown): string {
  const cause = (error as { cause?: unknown } | null)?.cause;
  if (cause instanceof Error && cause.message) return cause.message.split('\n')[0] ?? cause.message;
  if (error instanceof Error && error.message) return error.message.split('\n')[0] ?? error.message;
  return String(error);
}

/**
 * Truncates to a UTF-8 BYTE budget, without splitting a character.
 *
 * `String.prototype.slice` counts UTF-16 code units, so slicing to a limit
 * meant as bytes silently stored up to three times the budget for Devanagari —
 * which is exactly what NTA publishes half its notices in.
 */
export function truncateToBytes(input: string, maxBytes: number): string {
  const buffer = Buffer.from(input, 'utf8');
  if (buffer.byteLength <= maxBytes) return input;
  // Decoding a buffer cut mid-character yields U+FFFD; dropping a trailing
  // replacement char removes the partial sequence rather than storing a
  // corrupt one.
  const decoded = buffer.subarray(0, maxBytes).toString('utf8');
  return decoded.endsWith('\uFFFD') ? decoded.slice(0, -1) : decoded;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Minimal robots.txt evaluation for our own user-agent.
 *
 * Not a full RFC 9309 implementation, and deliberately biased to caution: on a
 * parse failure, a network failure, or anything ambiguous, it returns false.
 * Refusing to crawl when unsure costs a delayed data point; crawling when we
 * should not is the kind of mistake that gets an IP banned and is hard to
 * argue was accidental.
 */
export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split('\n').map((l) => l.replace(/#.*$/, '').trim());
  let applies = false;
  let sawAnyGroup = false;
  const disallows: string[] = [];
  const allows: string[] = [];

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      sawAnyGroup = true;
      // A group for `*` applies to us; so does one naming our bot.
      applies = value === '*' || value.toLowerCase().includes('schooltocareerbot');
      continue;
    }
    if (!applies) continue;
    if (key === 'disallow' && value) disallows.push(value);
    if (key === 'allow' && value) allows.push(value);
  }

  // No groups at all means an empty or non-standard file — permitted.
  if (!sawAnyGroup) return true;

  // Longest match wins, per the standard: an Allow deeper than a Disallow
  // re-permits the path.
  const longest = (rules: string[]) =>
    rules.filter((r) => path.startsWith(r)).reduce((max, r) => Math.max(max, r.length), -1);

  const deny = longest(disallows);
  const permit = longest(allows);
  if (deny === -1) return true;
  return permit >= deny;
}

/**
 * The outcome of asking a site whether we may crawl a path.
 *
 * Three states, not two. "Allowed" and "disallowed" are both answers; failing
 * to reach robots.txt is not an answer at all, and recording it as a disallow
 * attributes to the site a decision it never made.
 */
export type RobotsVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'DISALLOWED' }
  | { allowed: false; reason: 'UNAVAILABLE'; detail: string };

export async function checkRobots(url: string, logger: AppLogger): Promise<RobotsVerdict> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { allowed: false, reason: 'UNAVAILABLE', detail: `malformed source URL: ${url}` };
  }

  try {
    const response = await fetch(`${target.origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    // No robots.txt is permission by omission — the standard's position, not
    // an assumption of ours.
    if (response.status === 404 || response.status === 410) return { allowed: true };

    if (!response.ok) {
      return {
        allowed: false,
        reason: 'UNAVAILABLE',
        detail: `HTTP ${response.status} fetching robots.txt`,
      };
    }

    return isAllowedByRobots(await response.text(), target.pathname)
      ? { allowed: true }
      : { allowed: false, reason: 'DISALLOWED' };
  } catch (error) {
    logger.warn({ url, detail: describe(error) }, 'robots.txt unreadable — refusing to fetch');
    return { allowed: false, reason: 'UNAVAILABLE', detail: describe(error) };
  }
}

async function fetchOne(
  source: DueSource,
  deps: { repository: SourceRepository; logger: AppLogger },
): Promise<'changed' | 'unchanged' | 'skipped' | 'failed'> {
  const { repository, logger } = deps;

  const robotsStale =
    source.robotsCheckedAt === null ||
    Date.now() - new Date(source.robotsCheckedAt).getTime() > ROBOTS_TTL_MS;

  if (robotsStale) {
    const verdict = await checkRobots(source.url, logger);
    const error =
      verdict.allowed === false && verdict.reason === 'UNAVAILABLE' ? verdict.detail : null;
    await repository.recordRobots(source.id, verdict.allowed, error);
    source.robotsAllowed = verdict.allowed;
    source.robotsError = error;
  }

  // Still cautious: anything short of an explicit yes means we do not fetch.
  // What changed is what gets WRITTEN DOWN. Declining to crawl on a 403 from a
  // CDN is the right call; filing it as "the site disallows this path" is not,
  // because that reads as settled policy and stops anyone from looking again.
  if (source.robotsAllowed !== true) {
    const unreadable = source.robotsAllowed === null || source.robotsError !== null;
    await repository.recordFetch({
      sourceId: source.id,
      outcome: unreadable ? 'ROBOTS_UNAVAILABLE' : 'BLOCKED_BY_ROBOTS',
      error: unreadable
        ? (source.robotsError ?? 'robots.txt has never been checked')
        : 'robots.txt disallows this path',
    });
    return 'skipped';
  }

  const started = Date.now();
  try {
    const headers: Record<string, string> = { 'user-agent': USER_AGENT };
    if (source.etag) headers['if-none-match'] = source.etag;
    if (source.lastModified) headers['if-modified-since'] = source.lastModified;

    const response = await fetch(source.url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const durationMs = Date.now() - started;

    if (response.status === 304) {
      await repository.recordFetch({
        sourceId: source.id,
        outcome: 'NOT_MODIFIED',
        httpStatus: 304,
        durationMs,
      });
      return 'unchanged';
    }

    if (!response.ok) {
      await repository.recordFetch({
        sourceId: source.id,
        outcome: 'HTTP_ERROR',
        httpStatus: response.status,
        durationMs,
        error: `HTTP ${response.status} ${response.statusText}`,
      });
      return 'failed';
    }

    const body = await response.text();
    const hash = sha256(normalise(body));
    const changed = hash !== source.lastHash;
    const bytes = Buffer.byteLength(body);

    await repository.recordFetch({
      sourceId: source.id,
      outcome: changed ? 'CHANGED' : 'UNCHANGED',
      httpStatus: response.status,
      durationMs,
      contentHash: hash,
      contentType: response.headers.get('content-type'),
      contentBytes: bytes,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      // Bodies are kept only when something changed — an unchanged body is by
      // definition already known, and storing it every poll would be ~58k
      // identical copies a year per source.
      rawContent: changed ? truncateToBytes(body, MAX_STORED_BYTES) : null,
      rawTruncated: changed && bytes > MAX_STORED_BYTES,
    });

    if (changed) {
      logger.info(
        { source: source.name, authority: source.authority, url: source.url },
        'source changed',
      );
    }
    return changed ? 'changed' : 'unchanged';
  } catch (error) {
    await repository.recordFetch({
      sourceId: source.id,
      outcome: 'NETWORK_ERROR',
      durationMs: Date.now() - started,
      error: describe(error),
    });
    return 'failed';
  }
}

export function fetchSourcesTask(deps: {
  repository: SourceRepository;
  logger: AppLogger;
}): PeriodicTask {
  return {
    name: 'fetch-sources',
    // Every 30 minutes the task wakes; each SOURCE is polled on its own
    // cadence, so this interval only bounds how promptly a due source is
    // picked up.
    everyMs: 30 * 60_000,
    async run(): Promise<TaskOutcome> {
      const due = await deps.repository.findDue(BATCH);
      if (due.length === 0) return { processed: 0 };

      const tally = { changed: 0, unchanged: 0, skipped: 0, failed: 0 };

      // Sequential on purpose. Twenty sources at 1.5s apart is half a minute
      // of wall clock and invisible to the sites; a parallel burst from one IP
      // across several government domains is exactly what gets a crawler
      // blocked, and there is no deadline here worth that risk.
      for (const source of due) {
        tally[await fetchOne(source, deps)] += 1;
        await sleep(DELAY_BETWEEN_MS);
      }

      return { processed: due.length, detail: tally };
    },
  };
}
