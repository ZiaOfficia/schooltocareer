#!/usr/bin/env tsx
/**
 * Puts facts read from an official notice into the REVIEW QUEUE.
 *
 *   pnpm facts:queue-notice            # report only
 *   pnpm facts:queue-notice -- --apply # fetch the notice, queue the changes
 *
 * WHY THIS EXISTS. Some official facts are published only as a scanned image:
 * NTA's examination calendar is a photograph of a table inside a PDF, and the
 * extractor reads text. Until now such a fact had no way in at all, so the page
 * said "To be announced" about a date the authority had announced.
 *
 * WHAT IT IS NOT. It is not an approval path and it writes no canonical data.
 * It does exactly what the extractor does when it reads a page — record the
 * observation against a snapshot of the source, compare it with the published
 * value, and queue a PENDING_REVIEW change if they differ. A person still
 * opens the notice and approves or rejects through the authenticated fact API,
 * which remains the only thing that writes an ExamEvent.
 *
 * The observations live in data/notice-facts.json with the notice URL and the
 * exact row they were read from. Confidence is MEDIUM by policy: a value read
 * by eye has not been parsed, and MEDIUM is what makes the reviewer state a
 * reason when approving.
 *
 * The notice is FETCHED on --apply rather than trusted from the data file, so
 * the snapshot records the real status, size and hash of what the URL serves.
 * A notice that has been withdrawn (anything but 200) queues nothing.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { riskOf } from '../../apps/api/src/modules/fact/fact.extractor.js';
import { CANONICAL_OWNER } from '../../apps/api/src/modules/fact/fact.types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/** Distinguishes these rows from anything the text extractor produced. */
const EXTRACTOR_VERSION = 'notice-read-by-eye-v1';

type FactType = keyof typeof CANONICAL_OWNER;

type Notice = {
  source: { name: string; authority: string; url: string; kind: 'HTML' | 'PDF' };
  readOn: string;
  observations: Array<{
    examSlug: string;
    cycleYear: number;
    factType: FactType;
    rawValue: string;
    normalizedValue: string;
    isTentative: boolean;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    evidence: string;
  }>;
};

const iso = (date: Date): string => date.toISOString().slice(0, 10);

/** The published value in the same normalised form the fact engine compares on. */
async function canonicalOf(examYearId: string, factType: FactType) {
  const owner = CANONICAL_OWNER[factType];
  const event = await prisma.examEvent.findFirst({
    where: { examYearId, type: owner.eventType },
    select: { id: true, startDate: true, endDate: true, officialUrl: true, updatedAt: true },
  });
  if (!event) return { eventId: null, value: null, version: null };
  if (owner.field === 'officialUrl') {
    return { eventId: event.id, value: event.officialUrl, version: event.updatedAt };
  }
  const start = event.startDate ? iso(event.startDate) : null;
  const end = event.endDate ? iso(event.endDate) : null;
  const value = start === null ? null : end === null || end === start ? start : `${start}/${end}`;
  return { eventId: event.id, value, version: event.updatedAt };
}

async function main(): Promise<void> {
  const notices = JSON.parse(
    readFileSync(join(HERE, 'data', 'notice-facts.json'), 'utf8'),
  ) as Notice[];

  const siteId = process.env['SITE_ID'];
  if (APPLY && !siteId) {
    console.error('SITE_ID is not set. It must match the Site row the sources belong to.');
    process.exit(1);
  }

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${notices.length} notice(s)\n`);
  let queued = 0;

  for (const notice of notices) {
    console.log(`  ${notice.source.name}\n  ${notice.source.url}`);

    let snapshotId: string | null = null;
    let sourceId: string | null = null;

    if (APPLY && siteId) {
      const started = Date.now();
      const response = await fetch(notice.source.url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        console.log(`    SKIP  the notice answers ${response.status}; nothing queued from it.`);
        continue;
      }
      const body = Buffer.from(await response.arrayBuffer());
      const hash = createHash('sha256').update(body).digest('hex');

      const source = await prisma.source.upsert({
        where: { siteId_url: { siteId, url: notice.source.url } },
        update: { name: notice.source.name, authority: notice.source.authority },
        create: {
          siteId,
          name: notice.source.name,
          authority: notice.source.authority,
          url: notice.source.url,
          kind: notice.source.kind,
          // A dated notice does not change, and the fetcher could not read it
          // if it did. Paused keeps it out of the polling loop.
          status: 'PAUSED',
          notes: `One-off notice, read by eye on ${notice.readOn}. Not polled.`,
        },
        select: { id: true },
      });
      sourceId = source.id;

      const snapshot = await prisma.sourceSnapshot.create({
        data: {
          sourceId: source.id,
          outcome: 'CHANGED',
          httpStatus: response.status,
          durationMs: Date.now() - started,
          contentHash: hash,
          contentType: response.headers.get('content-type'),
          contentBytes: body.length,
          lastModified: response.headers.get('last-modified'),
          // The body is a scanned image; there is no text to keep.
          rawLocation: notice.source.url,
        },
        select: { id: true },
      });
      snapshotId = snapshot.id;
    }

    for (const seen of notice.observations) {
      const exam = await prisma.exam.findFirst({
        where: { slug: seen.examSlug, deletedAt: null },
        select: {
          id: true,
          years: {
            where: { year: seen.cycleYear, deletedAt: null },
            select: { id: true, isCurrent: true },
          },
        },
      });
      const cycle = exam?.years[0];
      if (!exam || !cycle) {
        console.log(`    SKIP  ${seen.examSlug} has no ${seen.cycleYear} cycle to write to.`);
        continue;
      }

      const owner = CANONICAL_OWNER[seen.factType];
      const canonical = await canonicalOf(cycle.id, seen.factType);
      const label = `${seen.examSlug} ${seen.cycleYear} ${seen.factType}`;

      if (canonical.value === seen.normalizedValue) {
        console.log(`    same  ${label} is already published as ${canonical.value}`);
        continue;
      }

      console.log(
        `    ${APPLY ? 'queue' : 'would queue'}  ${label}: ${canonical.value ?? '(none)'} -> ` +
          `${seen.normalizedValue}${seen.isTentative ? ' (tentative)' : ''}`,
      );
      if (!APPLY || !snapshotId || !sourceId) continue;

      const fact = await prisma.extractedFact.create({
        data: {
          sourceId,
          snapshotId,
          ownerType: 'EXAM',
          ownerId: exam.id,
          factType: seen.factType,
          rawValue: seen.rawValue,
          normalizedValue: seen.normalizedValue,
          confidence: seen.confidence,
          isTentative: seen.isTentative,
          evidence: seen.evidence,
          extractorVersion: EXTRACTOR_VERSION,
        },
        select: { id: true },
      });

      const kind = canonical.value === null ? 'ADDED' : 'CHANGED';
      const change = {
        extractedFactId: fact.id,
        previousValue: canonical.value,
        proposedValue: seen.normalizedValue,
        kind,
        confidence: seen.confidence,
        canonicalId: canonical.eventId,
        canonicalVersion: canonical.version,
      } as const;

      // One open change per fact, as in the service: refresh it rather than
      // stack a second row a reviewer would have to reconcile by hand.
      const pending = await prisma.factChange.findFirst({
        where: { ownerId: exam.id, factType: seen.factType, status: 'PENDING_REVIEW' },
        select: { id: true },
      });

      const row = pending
        ? await prisma.factChange.update({
            where: { id: pending.id },
            data: change,
            select: { id: true },
          })
        : await prisma.factChange.create({
            data: {
              ...change,
              ownerType: 'EXAM',
              ownerId: exam.id,
              factType: seen.factType,
              risk: riskOf(seen.factType),
              canonicalModel: owner.model,
            },
            select: { id: true },
          });

      queued += 1;
      console.log(`           change id ${row.id} — PENDING_REVIEW`);
    }
  }

  console.log(
    APPLY
      ? `\n  queued ${queued}. Nothing is published until a reviewer approves it.\n`
      : `\n  nothing written. Re-run with --apply to queue.\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
