#!/usr/bin/env tsx
/**
 * Moves every exam on to a new cycle (ExamYear) and makes it the current one.
 *
 *   pnpm cycle:roll -- --year 2027           # report only, changes nothing
 *   pnpm cycle:roll -- --year 2027 --apply   # create the cycles and switch
 *
 * WHAT IT WRITES. Per exam, at most: one new ExamYear for the target year
 * (status matching the cycle it replaces, no events, no fee, no notification
 * URL), `isCurrent` moved from the old cycle to the new one, and one
 * CACHE_REVALIDATE outbox row so the public pages pick the switch up without
 * waiting out their ISR window.
 *
 * WHAT IT DOES NOT WRITE. Any date. A new cycle starts empty, and the pages
 * say "To be announced" until a reviewed fact fills it. Dates arrive only
 * through the fact review queue, from the official sources bound to this
 * cycle in packages/constants/src/sources.ts — never from this script.
 *
 * Nothing is deleted: the old cycle and its events stay, still reachable as
 * history, just no longer current.
 *
 * Idempotent: an exam already on the target year is reported and skipped.
 */
import { CACHE_TAGS } from '@stc/constants/cache-tags';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function targetYear(): number {
  const index = process.argv.indexOf('--year');
  const year = index === -1 ? Number.NaN : Number(process.argv[index + 1]);
  // Bounded so a typo cannot create cycle 20227 on every exam at once.
  const now = new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < now - 1 || year > now + 2) {
    console.error(`Pass --year YYYY, between ${now - 1} and ${now + 2}.`);
    process.exit(1);
  }
  return year;
}

async function main(): Promise<void> {
  const year = targetYear();

  const exams = await prisma.exam.findMany({
    where: { deletedAt: null },
    orderBy: { popularityScore: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      years: {
        where: { deletedAt: null },
        orderBy: { year: 'desc' },
        select: {
          id: true,
          year: true,
          slug: true,
          sessionName: true,
          isCurrent: true,
          status: true,
          _count: { select: { events: true } },
        },
      },
    },
  });

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — roll ${exams.length} exams to ${year}\n`);

  let created = 0;
  let switched = 0;
  let skipped = 0;

  for (const exam of exams) {
    const current = exam.years.find((y) => y.isCurrent) ?? exam.years[0] ?? null;
    const existing = exam.years.find((y) => y.year === year && y.sessionName === null);
    const label = `${exam.slug.padEnd(22)} ${String(current?.year ?? '—').padEnd(5)}→ ${year}`;

    if (current && current.year === year && current.isCurrent) {
      console.log(`  ${label}  already current, skipped`);
      skipped += 1;
      continue;
    }

    const leaving = current
      ? ` (leaves ${current.year} current=${current.isCurrent}, ${current._count.events} events, kept)`
      : ' (no previous cycle)';
    console.log(`  ${label}  ${existing ? 'switch to existing' : 'create + switch'}${leaving}`);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      // Clear first: the page and the fact engine both read "the" current
      // cycle, and two flagged rows would make that a coin toss.
      await tx.examYear.updateMany({
        where: { examId: exam.id, isCurrent: true },
        data: { isCurrent: false },
      });

      if (existing) {
        await tx.examYear.update({ where: { id: existing.id }, data: { isCurrent: true } });
      } else {
        await tx.examYear.create({
          data: {
            examId: exam.id,
            year,
            slug: String(year),
            isCurrent: true,
            // The new cycle is as visible as the one it replaces. A DRAFT cycle
            // would leave a published exam page with no cycle to show.
            status: current?.status ?? 'PUBLISHED',
          },
        });
        created += 1;
      }
      switched += 1;

      // Same tags a fact approval publishes, so the hub and its whole cluster
      // re-render with the new year rather than serving the old one for an hour.
      await tx.outboxEvent.create({
        data: {
          eventType: 'CACHE_REVALIDATE',
          ownerType: 'EXAM',
          ownerId: exam.id,
          payload: {
            tags: [
              CACHE_TAGS.entity('EXAM', exam.slug),
              CACHE_TAGS.entityList('EXAM'),
              CACHE_TAGS.sitemap(),
            ],
            paths: ['/exams'],
            reason: `cycle:roll:${year}`,
          },
        },
      });
    });
  }

  console.log(
    APPLY
      ? `\n  created ${created}, switched ${switched}, already current ${skipped}\n`
      : `\n  nothing written. Re-run with --apply to perform the roll.\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
