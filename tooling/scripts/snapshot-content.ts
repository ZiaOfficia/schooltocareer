#!/usr/bin/env tsx
/**
 * Copies everything the website shows from the API into JSON files in the
 * repo, so the website never calls the API at runtime.
 *
 *   STC_API_URL=https://<api host> pnpm content:snapshot
 *   pnpm content:snapshot -- --from raw.json     # use a crawl saved earlier
 *
 * WHY. The API runs on a free Render instance that sleeps when idle. When the
 * website rendered pages from it, a sleeping API meant a slow or failed page
 * for whoever (or whichever crawler) arrived first. Now every page is built
 * at deploy time from apps/web/src/data/snapshot/, and the API is only needed
 * when the content changes.
 *
 * WHEN TO RUN IT. After any change made through the API or the database (a
 * new paper, an exam-hub edit through `pnpm exams:hubs`, a fact approval).
 * Run it, review the diff, commit, push: the deploy rebuilds the pages.
 *
 * Every list row's `preview` is rebuilt from the question's stem with the
 * current @stc/utils code, so the snapshot never depends on which version of
 * the API happened to be deployed when it was taken.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { markdownMathToText } from '@stc/utils/math-text';

import { crawlSnapshot } from './lib/snapshot-crawl.mjs';

const OUT = new URL('../../apps/web/src/data/snapshot/', import.meta.url);
const PREVIEW_MAX = 160;

type Json = Record<string, unknown>;
type Snapshot = Record<string, unknown> & { questions: Record<string, Json | null> };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function apiBase(): string {
  const raw = process.env.STC_API_URL?.trim();
  if (!raw) {
    console.error(
      'Set STC_API_URL to the API origin, e.g. STC_API_URL=https://schooltocareer.onrender.com',
    );
    process.exit(1);
  }
  return raw.replace(/\/+$/, '');
}

/** GET with pacing under the API's 300-requests-a-minute limit, and waits out a 429. */
function getter(base: string) {
  return async (path: string): Promise<unknown> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await sleep(220);
      let res: Response;
      try {
        // A sleeping Render instance can take a minute to answer the first request.
        res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(120_000) });
      } catch (error) {
        if (attempt === 7) throw error;
        await sleep(5000);
        continue;
      }
      if (res.status === 429) {
        await sleep((Number(res.headers.get('ratelimit-reset')) || 20) * 1000);
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
      return res.json();
    }
    throw new Error(`GET ${path}: still rate-limited after 8 attempts`);
  };
}

function preview(stem: string): string {
  const text = markdownMathToText(stem);
  if (text.length <= PREVIEW_MAX) return text;
  const slice = text.slice(0, PREVIEW_MAX);
  const space = slice.lastIndexOf(' ');
  return `${(space > PREVIEW_MAX * 0.6 ? slice.slice(0, space) : slice).replace(/[\s…]+$/, '')}…`;
}

/** Rewrites every `preview` next to a known `publicId`, anywhere in the snapshot. */
function refreshPreviews(node: unknown, stems: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const item of node) refreshPreviews(item, stems);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Json;
  const stem = typeof record.publicId === 'string' ? stems.get(record.publicId) : undefined;
  if (stem !== undefined && typeof record.preview === 'string') record.preview = preview(stem);
  for (const value of Object.values(record)) refreshPreviews(value, stems);
}

async function main() {
  const fromIndex = process.argv.indexOf('--from');
  const snapshot = (
    fromIndex > -1
      ? JSON.parse(readFileSync(process.argv[fromIndex + 1]!, 'utf8'))
      : await crawlSnapshot(getter(apiBase()), (stage: string) => console.log(`reading ${stage}…`))
  ) as Snapshot;

  const stems = new Map<string, string>();
  for (const [id, question] of Object.entries(snapshot.questions)) {
    if (question && typeof question.stem === 'string') stems.set(id, question.stem);
  }
  refreshPreviews(snapshot, stems);

  mkdirSync(OUT, { recursive: true });
  for (const [name, value] of Object.entries(snapshot)) {
    writeFileSync(new URL(`${name}.json`, OUT), `${JSON.stringify(value, null, 1)}\n`);
  }
  writeFileSync(
    new URL('meta.json', OUT),
    `${JSON.stringify({ takenAt: new Date().toISOString() }, null, 1)}\n`,
  );

  const count = (value: unknown) =>
    Array.isArray(value) ? value.length : Object.keys(value as object).length;
  console.log(
    Object.entries(snapshot)
      .map(([name, value]) => `${name}: ${count(value)}`)
      .join('\n'),
  );
  console.log('\nWrote apps/web/src/data/snapshot/. Review the diff, commit and push to publish.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
