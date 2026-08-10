#!/usr/bin/env node
/**
 * Blocks `prisma migrate dev` and `prisma migrate reset` against a database
 * that is not a throwaway.
 *
 * WHY THIS EXISTS. On 2026-08-11 `prisma migrate dev` was run to create a
 * migration. This database deliberately holds objects Prisma does not model —
 * the GENERATED tsvector column, the partial indexes, the NULLS NOT DISTINCT
 * constraints from migrations/manual/001_raw_constraints.sql. Prisma read them
 * as drift, decided a reset was required, and with no TTY to prompt on it went
 * ahead. Every row was destroyed and the live site served an empty API until
 * the seed finished.
 *
 * The procedure was already documented — operational-validation.md says to use
 * `migrate deploy` for exactly this reason. Documentation did not stop it, so
 * this does.
 *
 * The safe way to add a migration here is:
 *   1. edit the schema
 *   2. write prisma/schema/migrations/<timestamp>_<name>/migration.sql BY HAND
 *      with only the additive DDL
 *   3. pnpm db:deploy
 *   4. pnpm db:constraints        <- never optional; deploy does not restore
 *                                    the manual objects
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args.join(' ');

const DESTRUCTIVE = /\bmigrate\s+(dev|reset)\b/;

if (DESTRUCTIVE.test(command)) {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  // A local database is fair game. Anything else is assumed to matter.
  const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);

  if (!isLocal) {
    const host = url.replace(/^.*@/, '').replace(/\/.*$/, '') || '(no DATABASE_URL set)';
    console.error(
      `\nREFUSED: \`prisma ${command}\` against ${host}\n\n` +
        '  migrate dev and migrate reset DROP THE DATABASE when they detect drift,\n' +
        '  and this schema always looks drifted — it carries a GENERATED column,\n' +
        '  partial indexes and NULLS NOT DISTINCT constraints that Prisma does not\n' +
        '  model. Without a TTY there is no prompt; it simply proceeds.\n\n' +
        '  This destroyed the production database once. To add a migration:\n\n' +
        '    1. edit the schema\n' +
        '    2. hand-write prisma/schema/migrations/<timestamp>_<name>/migration.sql\n' +
        '    3. pnpm db:deploy\n' +
        '    4. pnpm db:constraints\n\n' +
        '  If you genuinely want to reset a throwaway database, point\n' +
        '  DIRECT_DATABASE_URL at localhost first.\n',
    );
    process.exit(1);
  }
}

execSync(`prisma ${command}`, { stdio: 'inherit' });
