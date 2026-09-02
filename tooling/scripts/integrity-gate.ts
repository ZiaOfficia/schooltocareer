#!/usr/bin/env tsx
/**
 * PRODUCTION DATA INTEGRITY GATE.
 *
 *   pnpm gate:integrity          # database checks
 *   pnpm gate:integrity --live   # also fetch the deployed sitemap
 *
 * Seven counts that must all be zero. Exits non-zero if any is not, so this
 * can stand in CI or a release step rather than being a check someone
 * remembers to run.
 *
 * It exists because the volume seed — whose fabricated rows are correct and
 * necessary in a throwaway database — was run against production and published
 * 100 indexable exam pages stating a fabricated exam date, the wrong
 * conducting body for 15 of 20 exams, and a reserved-TLD domain as the
 * official link. Nothing errored. Every page returned 200.
 *
 * That is the failure mode this guards: not a crash, but a confident page.
 * A student who acts on a wrong exam date loses a year, which is why these are
 * gates and not warnings.
 *
 * The checks read the DATABASE. `--live` additionally fetches the deployed
 * sitemap, because a clean database does not prove the CDN stopped serving
 * the old one.
 */
import { PrismaClient } from '@prisma/client';

// Subpath, not the barrel: this file is ESM and @stc/utils is CommonJS, so the
// barrel's `export *` chain loses named exports across the boundary. Same
// reason seed-sources.ts imports @stc/constants/sources.
import { isPlaceholderUrl } from '@stc/utils/indexability';

const prisma = new PrismaClient();
const LIVE = process.argv.includes('--live');
const ORIGIN = process.env['SITE_ORIGIN'] ?? 'https://www.schooltocareer.in';

/**
 * Live pages are server-rendered against an API on a free tier that cold
 * starts, so a single slow response must not abort the gate. A request that
 * cannot be completed is reported as UNKNOWN, never as a pass — the one thing
 * this file must never do is report a clean result it did not verify.
 */
async function fetchText(url: string): Promise<{ ok: true; body: string } | { ok: false; why: string }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) return { ok: false, why: `HTTP ${response.status}` };
      return { ok: true, body: await response.text() };
    } catch (error) {
      if (attempt === 3) {
        return { ok: false, why: error instanceof Error ? error.name : String(error) };
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000 * attempt));
    }
  }
  return { ok: false, why: 'unreachable' };
}

type CheckResult = { count: number; detail?: string[] };
type Check = { label: string; run: () => Promise<CheckResult> };

/** Anything published that a student could actually read. */
const LIVE_EXAM = { status: 'PUBLISHED', deletedAt: null } as const;

const checks: Check[] = [
  {
    label: 'Fake dates',
    run: async () => {
      // A published date with no provenance anywhere — no officialUrl on the
      // event, no officialWebsite on the exam. Traceability is the whole test:
      // a date nobody can check is indistinguishable from one that was made up.
      const counted = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n
          FROM "ExamEvent" ev
          JOIN "ExamYear" y ON y.id = ev."examYearId"
          JOIN "Exam" e     ON e.id = y."examId"
         WHERE e.status = 'PUBLISHED' AND e."deletedAt" IS NULL
           AND ev."startDate" IS NOT NULL
           AND ev."officialUrl" IS NULL
           AND (e."officialWebsite" IS NULL OR e."officialWebsite" LIKE '%example.%')`;

      // Sample for the operator; the count above is the real figure. Capping
      // both with one LIMIT reported 20 fabricated dates when there were 417.
      const rows = await prisma.$queryRaw<Array<{ slug: string; type: string; d: Date }>>`
        SELECT e.slug, ev.type::text AS type, ev."startDate" AS d
          FROM "ExamEvent" ev
          JOIN "ExamYear" y ON y.id = ev."examYearId"
          JOIN "Exam" e     ON e.id = y."examId"
         WHERE e.status = 'PUBLISHED' AND e."deletedAt" IS NULL
           AND ev."startDate" IS NOT NULL
           AND ev."officialUrl" IS NULL
           -- A placeholder host is not provenance. Testing only for NULL let
           -- https://example.test/<slug> count as a source, which hid every
           -- one of the 417 fabricated dates behind a fake citation.
           AND (e."officialWebsite" IS NULL OR e."officialWebsite" LIKE '%example.%')
         LIMIT 20`;
      return {
        count: Number(counted[0]?.n ?? 0),
        detail: rows.map((r) => `${r.slug} ${r.type} ${r.d.toISOString().slice(0, 10)}`),
      };
    },
  },
  {
    label: 'Fake official URLs',
    run: async () => {
      const exams = await prisma.exam.findMany({
        where: LIVE_EXAM,
        select: { slug: true, officialWebsite: true },
      });
      const results = await prisma.result.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        select: { slug: true, officialUrl: true },
      });
      const bad = [
        ...exams.filter((e) => isPlaceholderUrl(e.officialWebsite)).map((e) => `exam ${e.slug}`),
        ...results.filter((r) => isPlaceholderUrl(r.officialUrl)).map((r) => `result ${r.slug}`),
      ];
      return { count: bad.length, detail: bad.slice(0, 20) };
    },
  },
  {
    label: 'Fake conducting bodies',
    run: async () => {
      // The seed gave all 20 exams the same authority. One value shared by
      // many published exams is a placeholder, not a coincidence — NTA really
      // does run several of these, but it does not run CAT and UPSC.
      const rows = await prisma.$queryRaw<Array<{ body: string; n: bigint }>>`
        SELECT "conductingBody" AS body, count(*) n
          FROM "Exam"
         WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL AND "conductingBody" IS NOT NULL
         GROUP BY 1 HAVING count(*) > 8`;
      return {
        count: rows.reduce((sum, r) => sum + Number(r.n), 0),
        detail: rows.map((r) => `"${r.body}" on ${Number(r.n)} published exams`),
      };
    },
  },
  {
    label: 'Placeholder domains',
    run: async () => {
      const like = { contains: 'example.' };
      const [exams, results, files] = await Promise.all([
        prisma.exam.count({ where: { ...LIVE_EXAM, officialWebsite: like } }),
        prisma.result.count({ where: { status: 'PUBLISHED', officialUrl: like } }),
        prisma.questionPaperFile.count({
          where: { questionPaper: { status: 'PUBLISHED' }, media: { secureUrl: like } },
        }),
      ]);
      return {
        count: exams + results + files,
        detail: [`exam=${exams} result=${results} paperFile=${files}`],
      };
    },
  },
  {
    label: 'Fabricated fallback facts',
    run: async () => {
      // One templated overview reused verbatim across many exams is not
      // content — it is a string written to clear a publish gate.
      const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT coalesce(sum(n), 0) AS n FROM (
          SELECT right(overview, 160) AS tail, count(*) AS n
            FROM "Exam"
           WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL AND overview IS NOT NULL
           GROUP BY 1 HAVING count(*) > 3
        ) dupes`;
      return {
        count: Number(rows[0]?.n ?? 0),
        detail: ['exams sharing a verbatim overview ending with 3 or more others'],
      };
    },
  },
  {
    label: 'Unintentionally indexed',
    run: async () => {
      // Incomplete exams may EXIST; they may not be ADVERTISED. isIndexable
      // (REQUIRED_FIELDS.EXAM_HUB) is meant to make such a page serve
      // `noindex, follow`, so the honest test is to fetch the page and read
      // what it actually sent — a database assertion here would only restate
      // the rule it is supposed to be checking.
      const incomplete = await prisma.exam.findMany({
        where: {
          ...LIVE_EXAM,
          OR: [{ conductingBody: null }, { overview: null }, { officialWebsite: null }],
        },
        select: { slug: true },
        orderBy: { popularityScore: 'desc' },
        take: 12,
      });

      if (!LIVE) {
        return {
          count: 0,
          detail: [
            `${incomplete.length} incomplete published exams sampled — pass --live to verify they serve noindex`,
          ],
        };
      }

      // Every route the exam cluster serves, not just the hub. Checking only
      // /exam/<slug> reported a clean gate while all 80 cluster pages —
      // /result, /admit-card, /answer-key, /previous-year-papers — were still
      // serving "index, follow".
      const SECTIONS = ['', '/result', '/admit-card', '/answer-key', '/previous-year-papers'];
      const targets = incomplete.flatMap((exam) =>
        SECTIONS.map((section) => `/exam/${exam.slug}${section}`),
      );

      const leaked: string[] = [];
      const unreachable: string[] = [];
      for (const path of targets) {
        const page = await fetchText(`${ORIGIN}${path}`);
        if (!page.ok) {
          unreachable.push(`${path} (${page.why})`);
          continue;
        }
        const robots = /<meta name="robots" content="([^"]*)"/.exec(page.body)?.[1] ?? '(none)';
        if (!robots.includes('noindex')) leaked.push(`${path} → "${robots}"`);
      }
      // An unverifiable page counts as a failure. "Could not check" is not
      // "fine", and treating it as fine is how the original problem stayed
      // invisible for three weeks.
      return {
        count: leaked.length + unreachable.length,
        detail: [
          ...leaked,
          ...unreachable.map((u) => `could not verify ${u}`),
          `${targets.length - unreachable.length - leaked.length}/${targets.length} cluster pages verified as noindex`,
        ],
      };
    },
  },
  {
    label: 'Sitemap fake URLs',
    run: async () => {
      if (!LIVE) {
        return { count: 0, detail: ['skipped — pass --live to fetch the deployed sitemap'] };
      }
      const response = await fetch(`${ORIGIN}/sitemap.xml`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        return { count: 1, detail: [`sitemap returned HTTP ${response.status}`] };
      }
      const body = await response.text();
      const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? '');
      const examUrls = urls.filter((u) => u.includes('/exam/'));

      const complete = await prisma.exam.findMany({
        where: {
          ...LIVE_EXAM,
          conductingBody: { not: null },
          overview: { not: null },
          officialWebsite: { not: null },
        },
        select: { slug: true },
      });
      const allowed = new Set(complete.map((e) => e.slug));

      const bad = examUrls.filter((url) => {
        const slug = url.split('/exam/')[1]?.split('/')[0];
        return slug !== undefined && !allowed.has(slug);
      });
      return {
        count: bad.length,
        detail:
          bad.length > 0
            ? bad.slice(0, 10)
            : [`${urls.length} URLs live, ${examUrls.length} exam URLs, all backed by real data`],
      };
    },
  },
];

const WIDTH = 38;

function box(rows: Array<{ label: string; count: number }>): string {
  const title = 'PRODUCTION DATA INTEGRITY GATE';
  const pad = Math.floor((WIDTH + 2 - title.length) / 2);
  return [
    `+${'='.repeat(WIDTH + 2)}+`,
    `|${' '.repeat(pad)}${title}${' '.repeat(WIDTH + 2 - pad - title.length)}|`,
    `+${'='.repeat(WIDTH + 2)}+`,
    ...rows.map((r) => {
      const value = String(r.count);
      return `| ${`${r.label}:`.padEnd(WIDTH - value.length - 1)}${value} |`;
    }),
    `+${'='.repeat(WIDTH + 2)}+`,
  ].join('\n');
}

async function main(): Promise<void> {
  const rows: Array<{ label: string; count: number }> = [];
  const details: string[] = [];

  for (const check of checks) {
    const { count, detail } = await check.run();
    rows.push({ label: check.label, count });
    for (const line of detail ?? []) details.push(`    ${check.label}: ${line}`);
  }

  console.log(`\n${box(rows)}\n`);
  if (details.length > 0) console.log(`${details.join('\n')}\n`);

  const failed = rows.filter((r) => r.count > 0);
  if (failed.length > 0) {
    console.error(
      `GATE FAILED — ${failed.map((f) => f.label.toLowerCase()).join(', ')}.\n` +
        'Run `pnpm data:purge-placeholder` to see what would be cleaned.\n',
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`GATE PASSED${LIVE ? ' (including the deployed sitemap)' : ''}.\n`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
