#!/usr/bin/env tsx
/**
 * Applies the raw SQL that Prisma cannot express.
 *
 * WHY THIS IS A SEPARATE STEP: `CREATE INDEX CONCURRENTLY` cannot run inside a
 * transaction, and `prisma migrate` wraps every migration in one. So the
 * partial indexes, `NULLS NOT DISTINCT` constraints and the generated tsvector
 * column live in 001_raw_constraints.sql and are applied here instead.
 *
 * Every statement in that file is idempotent, so this is safe to re-run — and
 * it MUST be re-run after every `prisma migrate deploy`, because a migration
 * that recreates a table drops these with it.
 *
 * Uses DIRECT_DATABASE_URL: PgBouncer transaction pooling breaks DDL and
 * advisory locks, and the failure mode is confusing rather than obvious.
 *
 *   pnpm db:constraints
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SQL_FILE = join(ROOT, 'packages/database/prisma/migrations/manual/001_raw_constraints.sql');

/**
 * Splits the file into statements.
 *
 * The previous version stripped `--` lines and split on `;`. Its own comment
 * said it must be REPLACED rather than patched if a `$$`-quoted body was ever
 * added — one now has been, so this is the replacement.
 *
 * Single pass over the characters, tracking the four contexts in which a `;`
 * or a `--` does not mean what it looks like: line comments, block comments,
 * single-quoted literals (with `''` escapes), and dollar-quoted bodies (whose
 * tag must match exactly, so `$$` and `$searchvector$` do not terminate each
 * other). Comments outside a literal are dropped so statement labels and the
 * log stay readable; comments inside one are preserved, because there they are
 * part of the value.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;

  while (i < sql.length) {
    const rest = sql.slice(i);

    // Line comment — drop to end of line, keeping the newline.
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      continue;
    }

    // Block comment — PostgreSQL allows nesting.
    if (rest.startsWith('/*')) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql.startsWith('/*', i)) (depth++, (i += 2));
        else if (sql.startsWith('*/', i)) (depth--, (i += 2));
        else i++;
      }
      continue;
    }

    // Single-quoted literal. '' is an escaped quote, not a terminator.
    if (rest.startsWith("'")) {
      current += "'";
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''";
          i += 2;
          continue;
        }
        current += sql[i];
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Dollar-quoted body: $tag$ ... $tag$, tag possibly empty.
    const open = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (open) {
      const tag = open[0];
      const close = sql.indexOf(tag, i + tag.length);
      const end = close === -1 ? sql.length : close + tag.length;
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    if (sql[i] === ';') {
      statements.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  statements.push(current.trim());
  return statements.filter((statement) => statement.length > 0);
}

function label(statement: string): string {
  const match =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+(\w+)/i.exec(statement) ??
    /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+(\w+)/i.exec(statement) ??
    /ALTER\s+TABLE\s+"?(\w+)"?/i.exec(statement);
  return match?.[1] ?? statement.slice(0, 60).replace(/\s+/g, ' ');
}

async function main(): Promise<void> {
  const directUrl = process.env['DIRECT_DATABASE_URL'];
  if (!directUrl) {
    console.error(
      'DIRECT_DATABASE_URL is not set.\n' +
        'Migrations and DDL must use the UNPOOLED Neon URL (no "-pooler" in the host).',
    );
    process.exit(1);
  }
  if (directUrl.includes('-pooler')) {
    console.error(
      'DIRECT_DATABASE_URL points at the POOLED endpoint (it contains "-pooler").\n' +
        'CREATE INDEX CONCURRENTLY and advisory locks do not work through PgBouncer.\n' +
        'Use the direct connection string from the Neon dashboard.',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

  const version = await prisma.$queryRaw<Array<{ v: string }>>`SELECT version() AS v`;
  const major = Number(/PostgreSQL (\d+)/.exec(version[0]?.v ?? '')?.[1] ?? 0);
  console.log(`PostgreSQL major version: ${major || 'unknown'}`);

  if (major > 0 && major < 15) {
    console.error(
      `\nPostgreSQL ${major} is too old. NULLS NOT DISTINCT requires 15+, and three\n` +
        'identity constraints depend on it — without them, "CBSE Class 10" can be\n' +
        'inserted five times.',
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const statements = splitStatements(readFileSync(SQL_FILE, 'utf8'));
  console.log(`Applying ${statements.length} statements from 001_raw_constraints.sql\n`);

  let applied = 0;
  let failed = 0;

  for (const statement of statements) {
    const name = label(statement);
    try {
      // $executeRawUnsafe runs OUTSIDE a transaction, which is exactly what
      // CREATE INDEX CONCURRENTLY needs.
      await prisma.$executeRawUnsafe(statement);
      console.log(`  ok    ${name}`);
      applied += 1;
    } catch (error) {
      const message =
        error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
      // "already exists" is success on a re-run — the whole file is written to
      // be idempotent, and IF NOT EXISTS does not cover ADD COLUMN on all
      // PostgreSQL versions.
      if (/already exists/i.test(message)) {
        console.log(`  skip  ${name} (already present)`);
        applied += 1;
        continue;
      }
      console.error(`  FAIL  ${name}\n        ${message}`);
      failed += 1;
    }
  }

  // Report what actually landed, rather than trusting the statements above.
  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public'
       AND (indexname LIKE 'uq_%' OR indexname LIKE 'idx_%')
     ORDER BY indexname
  `;
  // `attgenerated` distinguishes the three states that matter. The old check
  // only asked whether SOME generated column existed on the table, so it could
  // not tell "absent" from "present but plain" — and "present but plain" is the
  // dangerous one, because every index and query over it silently succeeds
  // while matching nothing.
  const vector = await prisma.$queryRaw<Array<{ attgenerated: string }>>`
    SELECT a.attgenerated
      FROM pg_attribute a
      JOIN pg_class c     ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'SearchDocument'
       AND a.attname = 'searchVector' AND a.attnum > 0 AND NOT a.attisdropped
  `;
  const vectorState =
    vector.length === 0
      ? 'ABSENT — full-text search will not work'
      : vector[0]?.attgenerated === 's'
        ? 'present, GENERATED ALWAYS ... STORED'
        : 'PRESENT BUT NOT GENERATED — it will be NULL for every row';
  const vectorOk = vector[0]?.attgenerated === 's';

  console.log(`\nVerified in the database:`);
  console.log(`  custom indexes:        ${indexes.length}`);
  for (const index of indexes) console.log(`    - ${index.indexname}`);
  console.log(`  generated tsvector:    ${vectorState}`);

  await prisma.$disconnect();

  console.log(`\n${applied} applied, ${failed} failed`);
  // A silently-plain searchVector is a failure even when every statement ran.
  process.exit(failed > 0 || !vectorOk ? 1 : 0);
}

void main();
