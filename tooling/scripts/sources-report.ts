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
 *
 * The one rule this report has to obey: never state a conclusion the data does
 * not support. An earlier version printed "blocked by robots.txt — 7" when the
 * true number was zero, because the fetcher had no way to say "I could not
 * reach robots.txt" and said "the site forbade me" instead. A report that is
 * confidently wrong about its own inputs is worse than no report, because the
 * decisions downstream are made once and not revisited.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Row = {
  authority: string;
  name: string;
  url: string;
  status: string;
  robots_error: string | null;
  cadence: number;
  fetches: bigint;
  changes: bigint;
  unchanged: bigint;
  not_modified: bigint;
  failures: bigint;
  disallowed: bigint;
  unreadable: bigint;
  forbidden: bigint;
  p50_ms: number | null;
  first_seen: Date | null;
  last_change: Date | null;
};

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT s.authority, s.name, s.url, s.status::text AS status,
           s."robotsError" AS robots_error, s."cadenceMinutes" AS cadence,
           count(sn.*)                                                        AS fetches,
           count(*) FILTER (WHERE sn.outcome = 'CHANGED')                     AS changes,
           count(*) FILTER (WHERE sn.outcome = 'UNCHANGED')                   AS unchanged,
           count(*) FILTER (WHERE sn.outcome = 'NOT_MODIFIED')                AS not_modified,
           count(*) FILTER (WHERE sn.outcome IN ('HTTP_ERROR','NETWORK_ERROR')) AS failures,
           count(*) FILTER (WHERE sn.outcome = 'BLOCKED_BY_ROBOTS')           AS disallowed,
           count(*) FILTER (WHERE sn.outcome = 'ROBOTS_UNAVAILABLE')          AS unreadable,
           count(*) FILTER (WHERE sn."httpStatus" = 403)                      AS forbidden,
           percentile_disc(0.5) WITHIN GROUP (ORDER BY sn."durationMs")       AS p50_ms,
           min(sn."fetchedAt")                                                AS first_seen,
           max(sn."fetchedAt") FILTER (WHERE sn.outcome = 'CHANGED')          AS last_change
      FROM "Source" s
      LEFT JOIN "SourceSnapshot" sn ON sn."sourceId" = s.id
     -- Retired sources keep their history but must not appear beside their own
     -- replacements, where they read as a second, permanently failing source.
     WHERE s.status <> 'DEAD'
     GROUP BY s.authority, s.name, s.url, s.status, s."robotsError", s."cadenceMinutes"
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
    'authority  source'.padEnd(46) + 'fetch  chg  304  fail  n/rb  403   p50   change rate',
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
        `${String(n(r.unreadable)).padStart(6)}${String(n(r.forbidden)).padStart(5)}` +
        `${String(n(r.p50_ms)).padStart(6)}${rate.padStart(11)}`,
    );
  }

  // Three different conditions that all LOOK like "we did not get the page",
  // and that need three different responses. Collapsing them is the mistake
  // this report was rewritten to stop making.
  //
  //   disallowed  the site's own decision, in robots.txt. Settled. Never fetch.
  //   walled      no directive at all — an edge WAF refuses non-browser
  //               clients. Needs a different acquisition route entirely.
  //   unreachable transport failed: DNS, TLS, timeout. Usually a wrong URL or
  //               a server misconfiguration, and usually fixable by us.
  const isForbidden = (r: Row) => n(r.forbidden) > 0 || (r.robots_error ?? '').includes('403');
  const disallowed = rows.filter((r) => n(r.disallowed) > 0);
  const walled = rows.filter(isForbidden);
  const unreachable = rows.filter((r) => r.robots_error !== null && !isForbidden(r));

  const dead = rows.filter((r) => n(r.fetches) > 3 && n(r.failures) === n(r.fetches));
  const never = rows.filter((r) => n(r.fetches) > 10 && n(r.changes) === 0);
  const conditional = rows.filter((r) => n(r.not_modified) > 0);
  const slow = rows.filter((r) => n(r.p50_ms) > 3000);
  const reachable = rows.filter((r) => n(r.changes) + n(r.unchanged) + n(r.not_modified) > 0);

  console.log('\nWhat this says:\n');
  console.log(`  fetched at least once         ${reachable.length}/${rows.length} — the sources a parser can actually use`);
  console.log(`  honour conditional requests   ${conditional.length}/${rows.length} — these cost a 304, not a download`);
  console.log(`  never changed                 ${never.length} — candidates for a slower cadence, not a parser`);
  console.log(`  always failing                ${dead.length} — wrong URL, or needs a headless browser`);
  console.log(`  disallowed by robots.txt      ${disallowed.length} — the site's decision; never fetch`);
  console.log(`  refused our client            ${walled.length} — no directive; the edge blocks non-browser clients`);
  console.log(`  unreachable                   ${unreachable.length} — DNS, TLS or timeout; usually ours to fix`);
  console.log(`  slower than 3s                ${slow.length} — poll less often`);

  if (disallowed.length > 0) {
    console.log('\n  Disallowed by robots.txt, and correctly skipped:');
    for (const r of disallowed) console.log(`    ${r.authority} — ${r.url}`);
  }

  if (walled.length > 0) {
    console.log(
      '\n  Behind a bot wall. There is no robots directive here — the edge simply\n' +
        '  refuses a non-browser client. Measured: changing the User-Agent makes no\n' +
        '  difference, so these need a different acquisition route, not a disguise:',
    );
    for (const r of walled) console.log(`    ${r.authority.padEnd(8)} ${r.url}`);
  }

  if (unreachable.length > 0) {
    console.log('\n  Unreachable, with the reason. Most of these are ours to fix:');
    for (const r of unreachable) {
      console.log(`    ${r.authority.padEnd(8)} ${r.url}`);
      console.log(`             ${r.robots_error}`);
    }
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
