#!/usr/bin/env tsx
/**
 * THE PHASE 0 DELIVERABLE.
 *
 *   pnpm sources:report
 *
 * Turns a month of hashes into the answers that decide Phase 1: which sources
 * actually change, which are dead, which honour conditional requests, and
 * which are too slow or too flaky to poll on their current cadence.
 *
 * Every one of those is a guess right now. Each guess would otherwise be baked
 * into a parser before there was any evidence for it.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Row = {
  authority: string;
  name: string;
  url: string;
  cadence: number;
  fetches: bigint;
  changes: bigint;
  unchanged: bigint;
  not_modified: bigint;
  failures: bigint;
  blocked: bigint;
  p50_ms: number | null;
  first_seen: Date | null;
  last_change: Date | null;
};

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT s.authority, s.name, s.url, s."cadenceMinutes" AS cadence,
           count(sn.*)                                                        AS fetches,
           count(*) FILTER (WHERE sn.outcome = 'CHANGED')                     AS changes,
           count(*) FILTER (WHERE sn.outcome = 'UNCHANGED')                   AS unchanged,
           count(*) FILTER (WHERE sn.outcome = 'NOT_MODIFIED')                AS not_modified,
           count(*) FILTER (WHERE sn.outcome IN ('HTTP_ERROR','NETWORK_ERROR')) AS failures,
           count(*) FILTER (WHERE sn.outcome = 'BLOCKED_BY_ROBOTS')           AS blocked,
           percentile_disc(0.5) WITHIN GROUP (ORDER BY sn."durationMs")       AS p50_ms,
           min(sn."fetchedAt")                                                AS first_seen,
           max(sn."fetchedAt") FILTER (WHERE sn.outcome = 'CHANGED')          AS last_change
      FROM "Source" s
      LEFT JOIN "SourceSnapshot" sn ON sn."sourceId" = s.id
     GROUP BY s.authority, s.name, s.url, s."cadenceMinutes"
     ORDER BY changes DESC, failures DESC, s.authority
  `;

  if (rows.length === 0) {
    console.log('No sources. Run `pnpm sources:seed` first.');
    await prisma.$disconnect();
    return;
  }

  const n = (v: bigint | number | null) => Number(v ?? 0);

  console.log('\nSource intelligence — Phase 0\n');
  console.log(
    'authority  source'.padEnd(46) +
      'fetch  chg  304  fail  blkd   p50   change rate',
  );
  console.log('─'.repeat(100));

  for (const r of rows) {
    const fetches = n(r.fetches);
    const changes = n(r.changes);
    const rate = fetches > 0 ? `${((changes / fetches) * 100).toFixed(1)}%` : '—';
    console.log(
      `${r.authority.padEnd(10)} ${r.name.slice(0, 34).padEnd(35)}` +
        `${String(fetches).padStart(5)}${String(changes).padStart(5)}` +
        `${String(n(r.not_modified)).padStart(5)}${String(n(r.failures)).padStart(6)}` +
        `${String(n(r.blocked)).padStart(6)}${String(n(r.p50_ms)).padStart(6)}` +
        `${rate.padStart(11)}`,
    );
  }

  const dead = rows.filter((r) => n(r.fetches) > 3 && n(r.failures) === n(r.fetches));
  const blocked = rows.filter((r) => n(r.blocked) > 0);
  const never = rows.filter((r) => n(r.fetches) > 10 && n(r.changes) === 0);
  const conditional = rows.filter((r) => n(r.not_modified) > 0);
  const slow = rows.filter((r) => n(r.p50_ms) > 3000);

  console.log('\nWhat this says:\n');
  console.log(`  honour conditional requests   ${conditional.length}/${rows.length} — these cost a 304, not a download`);
  console.log(`  never changed                 ${never.length} — candidates for a slower cadence, not a parser`);
  console.log(`  always failing                ${dead.length} — wrong URL, or needs a headless browser`);
  console.log(`  blocked by robots.txt         ${blocked.length} — must never be fetched`);
  console.log(`  slower than 3s                ${slow.length} — poll less often`);

  if (blocked.length > 0) {
    console.log('\n  Blocked, and correctly skipped:');
    for (const r of blocked) console.log(`    ${r.authority} — ${r.url}`);
  }
  if (dead.length > 0) {
    console.log('\n  Failing every time — fix or retire:');
    for (const r of dead) console.log(`    ${r.authority} — ${r.url}`);
  }

  console.log(
    '\nParse the sources that actually change. Anything with a 0% change rate over\n' +
      'a month does not need a crawler — it needs a slower clock.\n',
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
