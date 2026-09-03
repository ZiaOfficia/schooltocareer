#!/usr/bin/env tsx
/**
 * What the semantic layer currently knows and what is waiting on a human.
 *
 *   pnpm facts:report
 *
 * DELIBERATELY SEPARATE FROM `sources:report`. That one answers "which official
 * pages change, and how often" — a crawling question. This answers "which
 * FACTS changed, and who has not looked at them yet" — an editorial one. They
 * are different jobs with different readers, and merging them produces a
 * dashboard that serves neither.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function bar(label: string, value: string | number, width = 34): string {
  return `  ${String(label).padEnd(width)}${value}`;
}

async function main(): Promise<void> {
  const [observations, changes, pending, exams] = await Promise.all([
    prisma.extractedFact.groupBy({ by: ['factType'], _count: { _all: true } }),
    prisma.factChange.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.factChange.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: [{ risk: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        ownerId: true,
        factType: true,
        kind: true,
        previousValue: true,
        proposedValue: true,
        risk: true,
        confidence: true,
        createdAt: true,
        extractedFact: {
          select: { isTentative: true, source: { select: { name: true, url: true } } },
        },
      },
    }),
    prisma.exam.findMany({ select: { id: true, slug: true } }),
  ]);

  const slugOf = new Map(exams.map((e) => [e.id, e.slug]));

  console.log('\nOBSERVATIONS  (what the pages said)\n');
  if (observations.length === 0) {
    console.log('  none yet — run `pnpm facts:extract`');
  }
  for (const row of observations) {
    console.log(bar(row.factType, row._count._all));
  }

  console.log('\nCHANGES BY STATUS\n');
  if (changes.length === 0) console.log('  none');
  for (const row of changes) {
    console.log(bar(row.status, row._count._all));
  }

  console.log(`\nWAITING FOR REVIEW  (${pending.length})\n`);
  if (pending.length === 0) {
    console.log('  nothing pending.\n');
  }

  for (const change of pending) {
    const age = Math.floor((Date.now() - change.createdAt.getTime()) / 3_600_000);
    console.log(
      `  [${change.risk}/${change.confidence}] ${slugOf.get(change.ownerId) ?? change.ownerId} ` +
        `${change.factType} ${change.kind}`,
    );
    console.log(
      `      ${change.previousValue ?? '(nothing held)'}  →  ${change.proposedValue ?? '(removed)'}` +
        `${change.extractedFact.isTentative ? '   [source calls it tentative]' : ''}`,
    );
    console.log(`      from ${change.extractedFact.source.name} · ${age}h old · id ${change.id}`);
  }

  // The number that matters operationally. A CRITICAL change sitting unreviewed
  // means a student may be reading a date the authority has already moved.
  const criticalAgeHours = pending
    .filter((c) => c.risk === 'CRITICAL')
    .map((c) => Math.floor((Date.now() - c.createdAt.getTime()) / 3_600_000));

  if (criticalAgeHours.length > 0) {
    console.log(
      `\n  ${criticalAgeHours.length} CRITICAL change(s) pending, oldest ` +
        `${Math.max(...criticalAgeHours)}h.\n`,
    );
  }

  console.log('');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
