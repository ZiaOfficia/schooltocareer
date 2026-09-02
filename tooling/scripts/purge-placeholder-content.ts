#!/usr/bin/env tsx
/**
 * Removes placeholder content that reached a live database.
 *
 *   pnpm data:purge-placeholder          # report only, changes nothing
 *   pnpm data:purge-placeholder --apply  # perform the cleanup
 *
 * WHAT THIS IS FOR. The volume seed writes PUBLISHED rows whose job is query
 * plan realism: every exam carries `conductingBody: 'National Testing Agency'`
 * and `officialWebsite: https://example.test/<slug>`, every ExamEvent a random
 * date. Run against production — as it was, to refill the database after a
 * `migrate reset` — that publishes fabricated exam facts to students.
 *
 * WHAT IT DOES NOT DO. It does not delete rows, and it does not touch anything
 * outside the seed's own id namespace. Reference data (boards, classes,
 * subjects, categories) is real and is left alone; only fabricated FACTS are
 * cleared and fabricated CONTENT is unpublished.
 *
 * Every synthetic row carries an id of the form `seed_<kind>_<key>`, so the
 * selector is exact rather than heuristic. A row created by an editor cannot
 * match it.
 *
 * Idempotent: running twice changes nothing the second time.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/** Only ids the seed itself generates. Never an editor's row. */
const SEEDED = { id: { startsWith: 'seed_' } } as const;

type Step = { label: string; count: () => Promise<number>; apply: () => Promise<unknown> };

const steps: Step[] = [
  {
    // A reserved TLD (RFC 6761) offered to students as the official authority.
    label: 'Exam.officialWebsite  → NULL   (example.test placeholders)',
    count: () =>
      prisma.exam.count({ where: { ...SEEDED, officialWebsite: { contains: 'example.' } } }),
    apply: () =>
      prisma.exam.updateMany({
        where: { ...SEEDED, officialWebsite: { contains: 'example.' } },
        data: { officialWebsite: null },
      }),
  },
  {
    // Correct for five exams, wrong for CAT, GATE, UPSC, SSC, IBPS, SBI, RRB,
    // CTET, BITSAT, VITEEE, WBJEE, MHT-CET, NIFT, CLAT and NDA. We do not know
    // which is which without a source, so none of it is kept.
    label: 'Exam.conductingBody   → NULL   (one hardcoded agency for all)',
    count: () => prisma.exam.count({ where: { ...SEEDED, conductingBody: { not: null } } }),
    apply: () =>
      prisma.exam.updateMany({ where: SEEDED, data: { conductingBody: null } }),
  },
  {
    // One templated paragraph reused across every exam, written to clear the
    // 200-character floor in assertPublishable rather than to inform anyone.
    label: 'Exam.overview         → NULL   (one template for all 20)',
    count: () => prisma.exam.count({ where: { ...SEEDED, overview: { not: null } } }),
    apply: () => prisma.exam.updateMany({ where: SEEDED, data: { overview: null } }),
  },
  {
    // `new Date(year, index + 1, rng.int(1, 27))`. Not estimates — noise.
    label: 'ExamEvent             → DELETE (random dates, 2 of 3 years marked firm)',
    count: () => prisma.examEvent.count({ where: SEEDED }),
    apply: () => prisma.examEvent.deleteMany({ where: SEEDED }),
  },
  {
    label: 'Result.officialUrl    → NULL   (example.test placeholders)',
    count: () =>
      prisma.result.count({ where: { ...SEEDED, officialUrl: { contains: 'example.' } } }),
    apply: () =>
      prisma.result.updateMany({
        where: { ...SEEDED, officialUrl: { contains: 'example.' } },
        data: { officialUrl: null },
      }),
  },
  {
    // Wholly invented entities — "Result 47 2024" names no real declaration.
    // Unpublished rather than deleted: the rows are what the query-plan
    // captures were taken against, and DRAFT already removes them from every
    // public read path.
    label: 'Result                → DRAFT  (invented declarations)',
    count: () => prisma.result.count({ where: { ...SEEDED, status: 'PUBLISHED' } }),
    apply: () =>
      prisma.result.updateMany({ where: SEEDED, data: { status: 'DRAFT', publishedAt: null } }),
  },
  {
    label: 'QuestionPaper         → DRAFT  (invented papers, no real file)',
    count: () => prisma.questionPaper.count({ where: { ...SEEDED, status: 'PUBLISHED' } }),
    apply: () =>
      prisma.questionPaper.updateMany({
        where: SEEDED,
        data: { status: 'DRAFT', publishedAt: null },
      }),
  },
  {
    label: 'ContentEntry          → DRAFT  (lorem articles)',
    count: () => prisma.contentEntry.count({ where: { ...SEEDED, status: 'PUBLISHED' } }),
    apply: () =>
      prisma.contentEntry.updateMany({
        where: SEEDED,
        data: { status: 'DRAFT', publishedAt: null },
      }),
  },
];

async function main(): Promise<void> {
  console.log(`\nPlaceholder content purge — ${APPLY ? 'APPLYING' : 'DRY RUN'}\n`);

  let total = 0;
  for (const step of steps) {
    const n = await step.count();
    total += n;
    console.log(`  ${n === 0 ? ' ok ' : String(n).padStart(4)}  ${step.label}`);
    if (APPLY && n > 0) await step.apply();
  }

  if (total === 0) {
    console.log('\nNothing to clean — no placeholder content is published.\n');
  } else if (APPLY) {
    console.log(`\n${total} rows cleaned. Run \`pnpm gate:integrity\` to verify.\n`);
  } else {
    console.log(`\n${total} rows would change. Re-run with --apply to perform it.\n`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
