#!/usr/bin/env tsx
/**
 * Runs ONE fact-extraction pass over the newest stored snapshots, now.
 *
 *   pnpm facts:extract           # detect and queue changes
 *   pnpm facts:extract --dry-run # read and report; write nothing
 *
 * The worker does this on its own every 45 minutes. This exists for the loop
 * that matters when editing an extractor: change a label pattern, re-run, read
 * what it now claims about every watched page — without waiting out a tick.
 *
 * `--dry-run` is the one that gets used. It reads the same bodies through the
 * same extractor and prints what WOULD be observed, without writing a row, so a
 * pattern change can be judged against every real page before it is allowed to
 * propose anything to a reviewer.
 *
 * Identical code path to the worker's. A checking tool that reads differently
 * from the thing it checks proves nothing.
 */
import { EXTRACTABLE_SOURCE_SEEDS } from '@stc/constants/sources';
import { PrismaClient } from '@prisma/client';

import { extractFacts } from '../../apps/api/src/modules/fact/fact.extractor.js';
import { FactRepository } from '../../apps/api/src/modules/fact/fact.repository.js';
import { FactService } from '../../apps/api/src/modules/fact/fact.service.js';
import { OutboxQueueProvider } from '../../apps/api/src/providers/queue/outbox.queue-provider.js';
import { OutboxRepository } from '../../apps/api/src/providers/queue/outbox.repository.js';
import { MemoryCacheProvider } from '../../apps/api/src/providers/cache/memory.cache-provider.js';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const logger = {
  info: (obj: unknown, msg?: string) => console.log(`  ${msg ?? ''} ${JSON.stringify(obj)}`),
  warn: (obj: unknown, msg?: string) => console.log(`  ! ${msg ?? ''} ${JSON.stringify(obj)}`),
  error: (obj: unknown, msg?: string) => console.error(`  ${msg ?? ''} ${JSON.stringify(obj)}`),
  debug: () => {},
  fatal: () => {},
  trace: () => {},
} as never;

async function dryRun(repository: FactRepository): Promise<void> {
  const targets = await repository.findExtractionTargets(EXTRACTABLE_SOURCE_SEEDS, 25);
  console.log(`\nReading ${targets.length} bound source(s). Nothing will be written.\n`);

  for (const target of targets) {
    const result = extractFacts({
      body: target.rawContent,
      truncated: target.rawTruncated,
    });

    console.log(`${target.sourceName}  →  ${target.examSlug}`);

    if (!result.ok) {
      // Each refusal is a DIFFERENT fixable condition, so they are never
      // collapsed into "no facts".
      const why = {
        TRUNCATED: 'stored body was truncated — raise the cap or move to object storage',
        NO_BODY: 'no body stored for the newest changed snapshot',
        NO_TEXT: 'body is a JavaScript shell — needs a different fetch strategy',
      }[result.reason];
      console.log(`   refused: ${result.reason} — ${why}\n`);
      continue;
    }

    if (result.observations.length === 0) {
      console.log(`   read successfully, states nothing about any watched fact\n`);
      continue;
    }

    for (const observation of result.observations) {
      console.log(
        `   ${observation.factType.padEnd(18)} ${observation.normalizedValue.padEnd(24)} ` +
          `${observation.confidence.padEnd(6)} tentative=${observation.isTentative}`,
      );
      for (const line of observation.evidence.split('\n').slice(1)) {
        console.log(`       ${line}`);
      }
    }
    console.log('');
  }
}

async function main(): Promise<void> {
  const repository = new FactRepository(prisma);

  if (DRY_RUN) {
    await dryRun(repository);
    await prisma.$disconnect();
    return;
  }

  const service = new FactService({
    repository,
    bindings: EXTRACTABLE_SOURCE_SEEDS,
    queue: new OutboxQueueProvider(new OutboxRepository(prisma)),
    cache: new MemoryCacheProvider(),
    logger,
  });

  console.log('\nExtracting facts from the newest changed snapshot of every bound source.\n');
  const tally = await service.detect();

  console.log(`\n  snapshots read     ${tally.snapshots}`);
  console.log(`  observations       ${tally.observations}`);
  console.log(`  changes queued     ${tally.changes}  (critical: ${tally.critical})`);
  console.log(`  invalid values     ${tally.invalid}`);
  console.log(`  refused: truncated ${tally.truncated}`);
  console.log(`  read but silent    ${tally.silent}`);
  console.log(
    '\nNothing above has been published. Changes wait in the review queue at\n' +
      '  GET /api/v1/admin/fact-changes?status=PENDING_REVIEW\n',
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
