#!/usr/bin/env tsx
/**
 * Writes reviewed exam-hub text (overview, conducting body, official website)
 * to the live exams, through the authenticated admin API.
 *
 *   STC_API_URL=https://<api host> pnpm exams:hubs            # report only
 *   STC_API_URL=https://<api host> pnpm exams:hubs -- --apply # write
 *
 * WHERE THE TEXT COMES FROM. tooling/scripts/data/exam-hubs.json. Each entry
 * names the official documents its facts were read from and the date they were
 * read. Edit the JSON, not the database: the file is reviewed in a pull
 * request, the database is not.
 *
 * WHY THE API AND NOT PRISMA. An update through the API is versioned, audited
 * and dispatches the exam.updated event, which queues the cache revalidation
 * that makes the page change without waiting out its ISR window. A direct
 * database write would skip all three — the same reason the fact tools keep
 * decisions behind the API.
 *
 * WHAT IT DOES NOT WRITE. Dates. Exam dates come from the fact review queue,
 * never from here. Nor does it publish or unpublish anything.
 *
 * The report shows, per exam, what changes and the indexability score the hub
 * will have afterwards, computed with the same function and inputs the API
 * uses. A hub below the threshold is reported, not silently written.
 *
 * Credentials: STC_ADMIN_EMAIL (or a prompt), and the password from a hidden
 * prompt only — never from argv or the environment.
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

import { evaluateIndexability } from '@stc/utils/indexability';

import { readSecret } from './lib/read-secret.js';

const APPLY = process.argv.includes('--apply');
const DATA_FILE = new URL('./data/exam-hubs.json', import.meta.url);
const API_PREFIX = '/api/v1';

/** The hub template always emits these. Mirrors isExamHubIndexable in the API. */
const HUB_STRUCTURED_DATA = ['BreadcrumbList', 'FAQPage', 'EducationalOccupationalProgram'];

type HubEntry = {
  slug: string;
  checkedOn: string;
  sources: string[];
  conductingBody: string;
  officialWebsite: string;
  overview: string;
};

type ExamFromApi = {
  id: string;
  slug: string;
  name: string;
  level: string;
  mode: string;
  status: string;
  isIndexable: boolean;
  conductingBody: string | null;
  officialWebsite: string | null;
  overview: string | null;
};

type Envelope<T> = { ok: boolean; data: T; error?: { message?: string } };

function apiBase(): string {
  const raw = process.env.STC_API_URL?.trim();
  if (!raw) {
    console.error(
      'Set STC_API_URL to the API origin, e.g. STC_API_URL=https://your-api.onrender.com\n' +
        '(the same value as API_BASE_URL in Vercel).',
    );
    process.exit(1);
  }
  return raw.replace(/\/+$/, '');
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.ok) {
    const reason = body?.error?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(`${init.method ?? 'GET'} ${url} failed: ${reason}`);
  }
  return body.data;
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

function words(text: string | null): number {
  return text ? text.trim().split(/\s+/).length : 0;
}

function same(a: string | null, b: string): boolean {
  return (a ?? '').trim() === b.trim();
}

async function main(): Promise<void> {
  const base = apiBase();
  const { exams: entries } = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as { exams: HubEntry[] };

  console.log(`\nEXAM HUB TEXT — ${APPLY ? 'APPLY' : 'report only'} — ${base}\n`);

  const plan: Array<{ entry: HubEntry; exam: ExamFromApi; patch: Record<string, string> }> = [];

  for (const entry of entries) {
    const exam = await call<ExamFromApi>(`${base}${API_PREFIX}/exams/${entry.slug}`);

    const patch: Record<string, string> = {};
    if (!same(exam.overview, entry.overview)) patch.overview = entry.overview.trim();
    if (!same(exam.conductingBody, entry.conductingBody))
      patch.conductingBody = entry.conductingBody.trim();
    if (!same(exam.officialWebsite, entry.officialWebsite))
      patch.officialWebsite = entry.officialWebsite.trim();

    const after = evaluateIndexability({
      kind: 'EXAM_HUB',
      body: entry.overview,
      fields: {
        name: exam.name,
        conductingBody: entry.conductingBody,
        overview: entry.overview,
        level: exam.level,
        mode: exam.mode,
      },
      structuredDataTypes: HUB_STRUCTURED_DATA,
    });

    console.log(`${exam.name} (${exam.slug}) — ${exam.status}`);
    console.log(`  overview        ${words(exam.overview)} → ${words(entry.overview)} words`);
    console.log(`  conductingBody  ${exam.conductingBody ?? '(none)'} → ${entry.conductingBody}`);
    console.log(`  officialWebsite ${exam.officialWebsite ?? '(none)'} → ${entry.officialWebsite}`);
    console.log(
      `  indexable       ${exam.isIndexable ? 'yes' : 'no'} → ${after.indexable ? 'yes' : 'NO'} (score ${after.score})`,
    );
    console.log(`  sources read    ${entry.checkedOn}`);
    if (!after.indexable) {
      console.log(
        `  ! still below the threshold: ${after.missingFields.join(', ') || 'see score'}`,
      );
    }
    console.log(
      Object.keys(patch).length === 0
        ? '  no change\n'
        : `  will change: ${Object.keys(patch).join(', ')}\n`,
    );

    if (Object.keys(patch).length > 0) plan.push({ entry, exam, patch });
  }

  if (plan.length === 0) {
    console.log('Nothing to write.');
    return;
  }
  if (!APPLY) {
    console.log(`${plan.length} exam(s) would change. Re-run with --apply to write them.`);
    return;
  }

  const email = process.env.STC_ADMIN_EMAIL?.trim() || (await ask('Admin email: '));
  const password = await readSecret('Password (not shown): ');
  const { accessToken } = await call<{ accessToken: string }>(`${base}${API_PREFIX}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  for (const { exam, patch } of plan) {
    await call(`${base}${API_PREFIX}/exams/admin/${exam.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(patch),
    });
    console.log(`  written: ${exam.slug} (${Object.keys(patch).join(', ')})`);
  }

  console.log(
    '\nDone. Pages refresh when the cache revalidation runs; then resubmit sitemap.xml in Search Console.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
