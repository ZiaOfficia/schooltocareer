#!/usr/bin/env tsx
/**
 * Seeds the ingestion watch list from SOURCE_SEEDS.
 *
 *   pnpm sources:seed
 *
 * Idempotent — re-running converges rather than duplicating, so the list can be
 * edited in packages/constants/src/sources.ts and re-applied.
 */
// Subpath, not the barrel: this file is ESM and @stc/constants is CommonJS, so
// the barrel's `export *` chain loses named exports across the boundary.
import { SOURCE_SEEDS } from '@stc/constants/sources';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const siteId = process.env['SITE_ID'];
  if (!siteId) {
    console.error('SITE_ID is not set. It must match the Site row these sources belong to.');
    process.exit(1);
  }

  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) {
    const all = await prisma.site.findMany({ select: { id: true } });
    console.error(
      `SITE_ID="${siteId}" matches no Site row. Available: ${all.map((s) => s.id).join(', ') || 'none'}`,
    );
    process.exit(1);
  }

  for (const seed of SOURCE_SEEDS) {
    await prisma.source.upsert({
      where: { siteId_url: { siteId, url: seed.url } },
      // Cadence is left alone on update: once Phase 0 data exists it will be
      // tuned per source, and re-seeding must not stamp on that.
      update: { name: seed.name, authority: seed.authority },
      create: {
        siteId,
        name: seed.name,
        authority: seed.authority,
        url: seed.url,
        kind: seed.kind,
        cadenceMinutes: seed.cadenceMinutes,
      },
    });
  }

  // Raw rather than groupBy: with a literal `by` tuple Prisma's conditional
  // type demands an `orderBy` key, and exactOptionalPropertyTypes then forbids
  // passing undefined for it. See docs/architecture/operational-validation.md.
  const byAuthority = await prisma.$queryRaw<Array<{ authority: string; n: bigint }>>`
    SELECT authority, count(*) AS n FROM "Source" GROUP BY authority ORDER BY n DESC, authority
  `;

  console.log(`${SOURCE_SEEDS.length} sources applied.\n`);
  for (const row of byAuthority) {
    console.log(`  ${row.authority.padEnd(10)} ${Number(row.n)}`);
  }
  console.log('\nThe worker picks these up on its next tick. Nothing is parsed.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
