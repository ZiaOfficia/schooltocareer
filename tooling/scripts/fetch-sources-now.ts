#!/usr/bin/env tsx
/**
 * Runs ONE fetch pass over every due source, now.
 *
 *   pnpm sources:fetch
 *
 * The worker does this on its own every 30 minutes. This exists for the loop
 * that matters when editing the watch list: change a URL, re-seed, fetch, read
 * the report — without waiting out a tick to find out whether the URL was even
 * right.
 *
 * Identical code path to the worker's, deliberately. A checking tool that
 * fetches differently from the thing it checks proves nothing.
 */
import { PrismaClient } from '@prisma/client';

import { SourceRepository } from '../../apps/api/src/modules/source/source.repository.js';
import { fetchSourcesTask } from '../../apps/api/src/workers/tasks/fetch-sources.task.js';

const prisma = new PrismaClient();

const logger = {
  info: (obj: unknown, msg?: string) => console.log(`  ${msg ?? ''}`, JSON.stringify(obj)),
  warn: (obj: unknown, msg?: string) => console.log(`  ${msg ?? ''}`, JSON.stringify(obj)),
  error: (obj: unknown, msg?: string) => console.error(`  ${msg ?? ''}`, JSON.stringify(obj)),
  debug: () => {},
  fatal: () => {},
  trace: () => {},
} as never;

async function main(): Promise<void> {
  console.log('\nFetching every due source. One request at a time, 1.5s apart.\n');

  const task = fetchSourcesTask({ repository: new SourceRepository(prisma), logger });
  const outcome = await task.run();

  console.log(`\n${outcome.processed} sources polled.`);
  if (outcome.detail) console.log(`  ${JSON.stringify(outcome.detail)}`);
  console.log('\nRun `pnpm sources:report` for what it means.\n');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
