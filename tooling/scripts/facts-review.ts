#!/usr/bin/env tsx
/**
 * Evidence-rich, read-only review queue for pending fact changes.
 *
 *   pnpm facts:review
 *
 * Decisions stay behind the authenticated fact API. This command makes the
 * evidence available to an operator without creating a second write path.
 */
import { PrismaClient } from '@prisma/client';

import { CANONICAL_OWNER } from '../../apps/api/src/modules/fact/fact.types.js';

const prisma = new PrismaClient();

/**
 * Which ExamEvent row each fact type maps to — read from CANONICAL_OWNER, the
 * single definition the approval path itself uses.
 *
 * This file previously kept its own local copy of that mapping. Two copies of
 * canonical ownership is the exact failure the fact engine was built to avoid:
 * the day someone re-pointed RESULT_DATE, this report would have kept showing
 * the old event's value as "canonical current" and a reviewer would have
 * approved against a row that was no longer the target.
 */
const factEventType: Record<string, string> = Object.fromEntries(
  Object.entries(CANONICAL_OWNER).map(([factType, owner]) => [factType, owner.eventType]),
);

function value(value: string | null): string {
  return value ?? '(none)';
}

async function main(): Promise<void> {
  const changes = await prisma.factChange.findMany({
    where: { status: 'PENDING_REVIEW' },
    orderBy: [{ risk: 'asc' }, { createdAt: 'asc' }],
    include: {
      extractedFact: {
        include: {
          source: { select: { name: true, url: true } },
          snapshot: { select: { id: true, fetchedAt: true, outcome: true } },
        },
      },
    },
  });

  const ownerIds = [...new Set(changes.map((change) => change.ownerId))];
  const exams = await prisma.exam.findMany({
    where: { id: { in: ownerIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      years: {
        where: { isCurrent: true, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          year: true,
          sessionName: true,
          events: {
            select: {
              id: true,
              type: true,
              startDate: true,
              endDate: true,
              officialUrl: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  const examById = new Map(exams.map((exam) => [exam.id, exam]));

  console.log('\nFACT CHANGE REVIEW\n');
  console.log(`Pending changes: ${changes.length}`);
  console.log('Read-only report. Approve, reject, or ignore through the authenticated fact API.\n');

  for (const [index, change] of changes.entries()) {
    const exam = examById.get(change.ownerId);
    const eventType = factEventType[change.factType];
    const event = exam?.years[0]?.events.find((candidate) => candidate.type === eventType);
    const cycle = exam?.years[0];
    const fact = change.extractedFact;
    const snapshot = fact.snapshot;

    console.log('='.repeat(72));
    console.log(`${index + 1}. ${exam?.name ?? change.ownerId} (${exam?.slug ?? 'unknown slug'})`);
    console.log(`Fact:              ${change.factType}`);
    console.log(`Change:            ${change.kind}`);
    console.log(`Old value:         ${value(change.previousValue)}`);
    console.log(`New value:         ${value(change.proposedValue)}`);
    console.log(`Risk/confidence:   ${change.risk}/${change.confidence}`);
    console.log(`Cycle:             ${cycle ? `${cycle.year}${cycle.sessionName ? ` ${cycle.sessionName}` : ''}` : '(none)'}`);
    console.log(`Canonical event:   ${event?.id ?? change.canonicalId ?? '(none)'}`);
    console.log(`Canonical current: ${event ? `${event.startDate?.toISOString() ?? '(none)'} to ${event.endDate?.toISOString() ?? '(none)'}` : '(unavailable)'}`);
    console.log(`Canonical URL:     ${event?.officialUrl ?? '(none)'}`);
    console.log(`Source:            ${fact.source.name}`);
    console.log(`Source URL:        ${fact.source.url}`);
    console.log(`Snapshot:          ${snapshot.id}`);
    console.log(`Snapshot fetched:  ${snapshot.fetchedAt.toISOString()} (${snapshot.outcome})`);
    console.log(`Extracted:         ${fact.extractedAt.toISOString()}`);
    console.log(`Raw value:         ${fact.rawValue}`);
    console.log(`Normalised value:  ${fact.normalizedValue}`);
    console.log(`Tentative:         ${fact.isTentative ? 'yes' : 'no'}`);
    console.log(`Extractor version: ${fact.extractorVersion}`);
    console.log(`Evidence:\n${fact.evidence}`);
    console.log(`\nFactChange ID:     ${change.id}`);
    console.log('API actions:       POST /api/v1/admin/fact-changes/:id/{approve,reject,ignore}');
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });