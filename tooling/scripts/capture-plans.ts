#!/usr/bin/env tsx
/**
 * Captures EXPLAIN (ANALYZE, BUFFERS) for the queries that carry the site.
 *
 * The output is a BASELINE, committed to docs/architecture/query-plans.md. Its
 * value is comparison: when a page gets slow in six months, the question is
 * "what changed in the plan", and without a baseline the answer is guesswork.
 *
 * It also catches the failure that matters most at this stage — a query falling
 * back to a Seq Scan because the index it was designed around does not exist,
 * which `pnpm db:constraints` silently failing would cause.
 *
 *   pnpm db:plans
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient, Prisma } from '@prisma/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/architecture/query-plans.md');

const prisma = new PrismaClient();
const YEAR = new Date().getFullYear();

type PlanCase = {
  name: string;
  why: string;
  /** The index or feature this query is supposed to use. */
  expects: string;
  sql: Prisma.Sql;
};

const CASES: PlanCase[] = [
  {
    name: 'exam hub page by slug',
    why: 'The most-requested read on the site. Must be a unique index lookup.',
    expects: 'Index Scan using Exam_slug_key',
    sql: Prisma.sql`
      SELECT id, slug, name, overview FROM "Exam"
       WHERE slug = 'jee-main' AND "deletedAt" IS NULL AND status = 'PUBLISHED'
    `,
  },
  {
    name: 'paper listing, keyset paginated',
    why: 'The public browse default over ~3k rows. Must not sort the whole table.',
    expects: 'Index Scan on (examId, year DESC) — no Sort node',
    sql: Prisma.sql`
      SELECT id, slug, title, year FROM "QuestionPaper"
       WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL
         AND (year < ${YEAR} OR (year = ${YEAR} AND id > ''))
       ORDER BY year DESC, id DESC
       LIMIT 21
    `,
  },
  {
    name: 'paper facet: year counts',
    why: 'One of seven aggregations the filter panel runs per request.',
    expects: 'HashAggregate over an index scan, not a full Seq Scan + Sort',
    sql: Prisma.sql`
      SELECT year, count(*) FROM "QuestionPaper"
       WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL
       GROUP BY year
    `,
  },
  {
    name: 'paper facet with a filter applied',
    why: 'Disjunctive faceting: the year facet computed WITHOUT the year filter.',
    expects: 'Index or bitmap scan on examId',
    sql: Prisma.sql`
      SELECT year, count(*) FROM "QuestionPaper"
       WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL
         AND "examId" IN (SELECT id FROM "Exam" LIMIT 3)
       GROUP BY year
    `,
  },
  {
    name: 'full-text search',
    why: 'Every site search. The GIN index is the whole point.',
    expects: 'Bitmap Index Scan using idx_search_vector',
    sql: Prisma.sql`
      WITH q AS (SELECT websearch_to_tsquery('english', 'physics preparation') AS tsq)
      SELECT title, ts_rank_cd("searchVector", q.tsq, 32) AS score
        FROM "SearchDocument", q
       WHERE "searchVector" @@ q.tsq AND "isActive" = true
       ORDER BY score DESC LIMIT 20
    `,
  },
  {
    name: 'typo-tolerant autocomplete',
    why: 'Fires on every keystroke. ILIKE %x% cannot use an index; % can.',
    expects: 'Bitmap Index Scan using idx_search_title_trgm',
    sql: Prisma.sql`
      SELECT title, similarity(title, 'entrence') AS sim FROM "SearchDocument"
       WHERE title % 'entrence' ORDER BY sim DESC LIMIT 8
    `,
  },
  {
    name: 'recursive category ancestors',
    why: 'Runs on every article page to build the breadcrumb.',
    expects: 'Recursive Union with an index scan on the id, bounded by depth',
    sql: Prisma.sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, slug, "parentId", 0 AS depth FROM "Category"
         WHERE slug = 'jee-strategy' AND "deletedAt" IS NULL
        UNION ALL
        SELECT c.id, c.slug, c."parentId", a.depth + 1
          FROM "Category" c JOIN ancestors a ON c.id = a."parentId"
         WHERE c."deletedAt" IS NULL AND a.depth < 10
      )
      SELECT * FROM ancestors
    `,
  },
  {
    name: 'outbox claim (SKIP LOCKED)',
    why: 'The worker runs this continuously. A Seq Scan here is a hot loop.',
    expects: 'Index Scan on (status, availableAt)',
    sql: Prisma.sql`
      SELECT id FROM "OutboxEvent"
       WHERE status IN ('PENDING','FAILED') AND "availableAt" <= NOW()
       ORDER BY id ASC LIMIT 50
    `,
  },
  {
    name: 'scheduled posts due',
    why: 'Runs every minute forever. Must be a bounded range read.',
    expects: 'Index Scan on (status, publishedAt)',
    sql: Prisma.sql`
      SELECT id FROM "ContentEntry"
       WHERE status = 'DRAFT' AND "deletedAt" IS NULL AND "publishedAt" <= NOW()
       ORDER BY "publishedAt" ASC LIMIT 50
    `,
  },
  {
    name: 'results awaiting declaration',
    why: 'Homepage widget, cached briefly but recomputed all day on result days.',
    expects: 'Index scan on (year DESC, isDeclared, status)',
    sql: Prisma.sql`
      SELECT id, title FROM "Result"
       WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL AND "isDeclared" = false
       ORDER BY "expectedAt" ASC LIMIT 10
    `,
  },
];

/**
 * The access method the planner actually chose.
 *
 * This is the one line worth reading in CI. The full plan goes to the file;
 * "did it use an index" is the question that catches regressions.
 */
function accessMethod(plan: string): string {
  const node =
    /(Index Only Scan|Index Scan|Bitmap Heap Scan|Bitmap Index Scan|Seq Scan|CTE Scan|Function Scan)/.exec(
      plan,
    )?.[1];
  if (!node) return 'unknown';

  const index = /using (\w+)/.exec(plan)?.[1];
  return index ? `${node} using ${index}` : node;
}

/**
 * Below this many rows actually scanned, a Seq Scan is the CORRECT plan and no
 * index would be chosen even if one existed. Reporting it as a problem is how
 * a plan report trains people to ignore it.
 */
const SEQ_SCAN_MIN_ROWS = 500;

/** A Seq Scan node with the row count it actually produced, not its estimate. */
function seqScans(plan: string): Array<{ table: string; rows: number }> {
  return [
    ...plan.matchAll(/Seq Scan on "?(\w+)"?[^\n]*?actual time=[^)]*?rows=([\d.]+)/g),
  ].map((m) => ({ table: m[1]!, rows: Number(m[2]) }));
}

/**
 * Flags the failure modes worth catching automatically.
 *
 * The first version treated ANY Seq Scan as a warning, which produced 7 false
 * alarms out of 10 on the seeded database — SearchDocument and OutboxEvent are
 * empty, Category has 7 rows, Exam has 20. A report that is 70% noise gets
 * skimmed, and the one real finding in it gets skipped with the rest.
 */
function assess(plan: string): { level: 'ok' | 'warn' | 'info'; note: string } {
  const scans = seqScans(plan);
  const describe = (list: typeof scans) =>
    [...new Map(list.map((s) => [s.table, s])).values()]
      .map((s) => `${s.table} (${s.rows.toLocaleString()} rows)`)
      .join(', ');

  const significant = scans.filter((s) => s.rows >= SEQ_SCAN_MIN_ROWS);
  if (significant.length > 0) {
    return {
      level: 'warn',
      note: `Seq Scan on ${describe(significant)} — the expected index is missing or unusable`,
    };
  }
  if (/External (Sort|Merge)|Sort Method: external/.test(plan)) {
    return { level: 'warn', note: 'sort spilled to disk — work_mem or a missing index' };
  }
  if (scans.length > 0) {
    return {
      level: 'info',
      note: `Seq Scan on ${describe(scans)} — correct at this size; re-check at production volume`,
    };
  }
  return { level: 'ok', note: '' };
}

function executionMs(plan: string): string {
  return /Execution Time: ([\d.]+) ms/.exec(plan)?.[1] ?? '?';
}

async function main(): Promise<void> {
  console.log('Query plan baseline\n');
  console.log(`  ${'query'.padEnd(38)} ${'access method'.padEnd(42)} ${'time'.padStart(11)}`);
  console.log(`  ${'─'.repeat(38)} ${'─'.repeat(42)} ${'─'.repeat(11)}`);

  const sections: string[] = [
    '# Query plan baseline',
    '',
    'Generated by `pnpm db:plans` against a seeded database.',
    '',
    'Regenerate after a schema or index change and diff it. A plan that turns',
    'into a `Seq Scan` is usually a missing index, and the most common cause is',
    '`pnpm db:constraints` not having been re-run after a migration recreated a',
    'table.',
    '',
    `Captured: ${new Date().toISOString()}`,
    '',
  ];

  let warnings = 0;

  for (const testCase of CASES) {
    let plan: string;
    try {
      const rows = await prisma.$queryRaw<Array<Record<string, string>>>(
        Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE false) ${testCase.sql}`,
      );
      plan = rows.map((row) => Object.values(row)[0]).join('\n');
    } catch (error) {
      plan = `FAILED: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
    }

    const verdict = plan.startsWith('FAILED') ? { level: 'warn' as const, note: 'query failed' } : assess(plan);
    if (verdict.level === 'warn') warnings += 1;

    // One readable line per query. The full plan goes to the file — this is
    // what someone scans in CI to spot a regression without reading pages of
    // execution output.
    const mark = verdict.level === 'ok' ? '✓' : verdict.level === 'info' ? '·' : '⚠';
    console.log(
      `  ${mark} ${testCase.name.padEnd(36)} ${accessMethod(plan).padEnd(42)} ${executionMs(plan).padStart(8)} ms`,
    );
    if (verdict.note) console.log(`      ${verdict.note}`);

    sections.push(
      `## ${testCase.name}`,
      '',
      `**Why it matters:** ${testCase.why}`,
      '',
      `**Expected:** ${testCase.expects}`,
      '',
      verdict.level === 'warn'
        ? `> ⚠️ ${verdict.note}`
        : verdict.note
          ? `> ${verdict.note} · ${executionMs(plan)} ms`
          : `> Execution time: ${executionMs(plan)} ms`,
      '',
      '```',
      plan,
      '```',
      '',
    );
  }

  writeFileSync(OUT, sections.join('\n'), 'utf8');
  console.log(`\nWritten to docs/architecture/query-plans.md`);
  console.log(
    warnings === 0
      ? `${CASES.length}/${CASES.length} plans clean`
      : `${CASES.length - warnings}/${CASES.length} plans clean — ${warnings} need an index`,
  );
  console.log(
    `· = Seq Scan under ${SEQ_SCAN_MIN_ROWS} rows, which is the correct plan at this volume.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Plan capture failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
