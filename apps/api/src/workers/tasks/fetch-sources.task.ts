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

/** Bodies larger than this are hashed in full but stored truncated. */
const MAX_STORED_BYTES = 512 * 1024;
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

async function robotsAllows(url: string, logger: AppLogger): Promise<boolean> {
  try {
    const target = new URL(url);
    const response = await fetch(`${target.origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    // No robots.txt is permission by omission — that is the standard's
    // position, not an assumption of ours.
    if (response.status === 404) return true;
    if (!response.ok) return false;
    return isAllowedByRobots(await response.text(), target.pathname);
  } catch (error) {
    logger.warn({ url, err: error }, 'robots.txt unreachable — refusing to fetch');
    return false;
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
    const allowed = await robotsAllows(source.url, logger);
    await repository.recordRobots(source.id, allowed);
    source.robotsAllowed = allowed;
  }

  if (source.robotsAllowed !== true) {
    await repository.recordFetch({
      sourceId: source.id,
      outcome: 'BLOCKED_BY_ROBOTS',
      error: 'robots.txt disallows this path',
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
      rawContent: changed ? body.slice(0, MAX_STORED_BYTES) : null,
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
      error: error instanceof Error ? (error.message.split('\n')[0] ?? 'unknown') : String(error),
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
