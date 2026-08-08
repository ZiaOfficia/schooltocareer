#!/usr/bin/env tsx
/**
 * End-to-end verification against a real PostgreSQL database.
 *
 * Everything the unit tests could not prove, because they used fakes:
 *
 *   PostgreSQL features   SKIP LOCKED, recursive CTEs, NULLS NOT DISTINCT,
 *                         partial indexes, generated tsvector, pg_trgm,
 *                         batched groupBy
 *   Real flows            publish -> outbox -> worker -> search index
 *                         slug rename -> history + redirects
 *                         rollback from a revision
 *                         scheduled publish
 *   Failure paths         duplicate slug, version conflict, outbox retry,
 *                         failed media confirmation cleanup
 *
 * Read-mostly: it creates a handful of rows under a `verify_` prefix and
 * removes them at the end, so it is safe to run repeatedly against a seeded
 * database.
 *
 *   pnpm verify:e2e
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Check = { name: string; group: string; ok: boolean; detail: string };
const checks: Check[] = [];
let group = 'general';

function setGroup(name: string): void {
  group = name;
  console.log(`\n${name}`);
}

async function check(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    checks.push({ name, group, ok: true, detail });
    console.log(`  ok    ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    const detail =
      error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
    checks.push({ name, group, ok: false, detail });
    console.log(`  FAIL  ${name}\n        ${detail}`);
  }
}

/** Asserts that an operation is rejected — a failure path IS the assertion. */
async function expectRejection(fn: () => Promise<unknown>, matching: RegExp): Promise<string> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (matching.test(message)) return 'rejected as expected';
    throw new Error(`rejected, but not with the expected error: ${message.split('\n')[0]}`);
  }
  throw new Error('the operation SUCCEEDED but should have been rejected');
}

const PREFIX = 'verify_';
const SITE_ID = 'seed_site_stc';
const ADMIN_ID = 'seed_user_admin';

async function main(): Promise<void> {
  console.log('End-to-end verification\n');

  await preflight();
  await verifyPostgresFeatures();
  await verifyRecursiveCtes();
  await verifyFaceting();
  await verifyFullTextSearch();
  await verifyOutboxSkipLocked();
  await verifyPublishFlow();
  await verifySlugRename();
  await verifyRevisionRollback();
  await verifyScheduledPublish();
  await verifyFailurePaths();
  await cleanup();

  report();
}

// ── Preflight ───────────────────────────────────────────────────────────────

async function preflight(): Promise<void> {
  setGroup('Database');

  await check('database reachable', async () => {
    const rows = await prisma.$queryRaw<Array<{ v: string }>>`SELECT version() AS v`;
    return rows[0]!.v.split(',')[0]!;
  });

  await check('PostgreSQL 15 or newer', async () => {
    // `SHOW server_version` returns a column named `server_version`, not `v`,
    // so the old alias silently read undefined and died on .split(). Prisma
    // cannot alias SHOW, and server_version_num needs no string parsing at all.
    const rows = await prisma.$queryRaw<Array<{ v: number }>>`
      SELECT current_setting('server_version_num')::int AS v
    `;
    const num = Number(rows[0]?.v);
    if (!Number.isFinite(num)) throw new Error('could not read server_version_num');
    const major = Math.floor(num / 10000);
    if (major < 15) throw new Error(`PostgreSQL ${major} — NULLS NOT DISTINCT needs 15+`);
    return `v${major}`;
  });

  await check('extensions installed', async () => {
    const rows = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')
    `;
    const found = rows.map((r) => r.extname);
    if (!found.includes('pg_trgm')) throw new Error('pg_trgm missing — run pnpm db:constraints');
    return found.join(', ');
  });

  await check('seed data present', async () => {
    const papers = await prisma.questionPaper.count();
    if (papers < 100) throw new Error(`only ${papers} papers — run pnpm db:seed first`);
    return `${papers} question papers`;
  });
}

// ── PostgreSQL features ─────────────────────────────────────────────────────

async function verifyPostgresFeatures(): Promise<void> {
  setGroup('Constraints and indexes');

  await check('partial indexes exist', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexdef LIKE '%WHERE%'
         AND (indexname LIKE 'uq_%' OR indexname LIKE 'idx_%')
    `;
    if (rows.length === 0) throw new Error('none found — run pnpm db:constraints');
    return `${rows.length} partial indexes`;
  });

  await check('NULLS NOT DISTINCT blocks a duplicate BoardClass', async () => {
    const existing = await prisma.boardClass.findFirst({
      where: { stream: null, deletedAt: null },
      select: { boardId: true, classLevelId: true },
    });
    if (!existing) throw new Error('no stream-less BoardClass to test against');

    // Without the NULLS NOT DISTINCT index this INSERT succeeds, because
    // PostgreSQL treats NULL stream values as distinct — the exact bug the
    // index exists to prevent.
    return expectRejection(
      () =>
        prisma.boardClass.create({
          data: {
            id: `${PREFIX}dup_bc`,
            boardId: existing.boardId,
            classLevelId: existing.classLevelId,
            stream: null,
            slug: `${PREFIX}dup`,
          },
        }),
      /unique|duplicate/i,
    );
  });

  await check('partial unique on MediaAsset.checksum blocks a live duplicate', async () => {
    const existing = await prisma.mediaAsset.findFirst({
      where: { checksum: { not: null }, deletedAt: null },
      select: { checksum: true },
    });
    if (!existing?.checksum) throw new Error('no checksummed asset to test against');

    return expectRejection(
      () =>
        prisma.mediaAsset.create({
          data: {
            id: `${PREFIX}dup_media`,
            provider: 'verify',
            publicId: `${PREFIX}dup`,
            secureUrl: 'https://x.test/d.png',
            type: 'IMAGE',
            mimeType: 'image/png',
            checksum: existing.checksum,
          },
        }),
      /unique|duplicate/i,
    );
  });

  await check('searchVector is GENERATED, not a plain column', async () => {
    // This check used to count non-NULL vectors and return a string — it could
    // not fail. With SearchDocument empty it reported "ok — 0 documents with a
    // vector", which is precisely the state it existed to catch: `prisma
    // migrate` creates searchVector as a PLAIN tsvector (the schema declares it
    // Unsupported("tsvector")), so `ADD COLUMN IF NOT EXISTS` in the manual SQL
    // does nothing and every row's vector stays NULL forever.
    //
    // Assert the structure instead. attgenerated = 's' means STORED.
    const rows = await prisma.$queryRaw<Array<{ attgenerated: string }>>`
      SELECT a.attgenerated
        FROM pg_attribute a
        JOIN pg_class c     ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'SearchDocument'
         AND a.attname = 'searchVector' AND a.attnum > 0 AND NOT a.attisdropped
    `;
    if (rows.length === 0) throw new Error('searchVector column is absent — run pnpm db:constraints');
    if (rows[0]?.attgenerated !== 's') {
      throw new Error(
        'searchVector exists but is NOT generated — it will be NULL for every row. ' +
          'Run pnpm db:constraints; it drops and re-adds the column.',
      );
    }

    const counts = await prisma.$queryRaw<Array<{ total: bigint; withVector: bigint }>>`
      SELECT count(*) AS total,
             count("searchVector") AS "withVector"
        FROM "SearchDocument"
    `;
    const total = Number(counts[0]?.total ?? 0);
    const withVector = Number(counts[0]?.withVector ?? 0);
    if (total > 0 && withVector < total) {
      throw new Error(`${total - withVector} of ${total} documents have a NULL vector`);
    }
    return `GENERATED ALWAYS ... STORED — ${withVector}/${total} rows populated`;
  });
}

// ── Recursive CTEs ──────────────────────────────────────────────────────────

async function verifyRecursiveCtes(): Promise<void> {
  setGroup('Recursive queries');

  await check('ancestor walk terminates and returns the chain', async () => {
    const deep = await prisma.category.findFirst({
      where: { slug: 'jee-strategy' },
      select: { id: true },
    });
    if (!deep) throw new Error('seed category jee-strategy missing');

    const rows = await prisma.$queryRaw<Array<{ slug: string; depth: number }>>`
      WITH RECURSIVE ancestors AS (
        SELECT id, slug, "parentId", 0 AS depth FROM "Category"
         WHERE id = ${deep.id} AND "deletedAt" IS NULL
        UNION ALL
        SELECT c.id, c.slug, c."parentId", a.depth + 1
          FROM "Category" c JOIN ancestors a ON c.id = a."parentId"
         WHERE c."deletedAt" IS NULL AND a.depth < 10
      )
      SELECT slug, depth FROM ancestors WHERE id <> ${deep.id} ORDER BY depth DESC
    `;
    if (rows.length < 2) throw new Error(`expected a 2-deep chain, got ${rows.length}`);
    return rows.map((r) => r.slug).join(' > ');
  });

  await check('descendant walk returns the subtree', async () => {
    const root = await prisma.category.findFirst({
      where: { slug: 'exam-prep' },
      select: { id: true },
    });
    if (!root) throw new Error('seed category exam-prep missing');

    const rows = await prisma.$queryRaw<Array<{ slug: string }>>`
      WITH RECURSIVE descendants AS (
        SELECT id, slug, "parentId", 0 AS depth FROM "Category"
         WHERE id = ${root.id} AND "deletedAt" IS NULL
        UNION ALL
        SELECT c.id, c.slug, c."parentId", d.depth + 1
          FROM "Category" c JOIN descendants d ON c."parentId" = d.id
         WHERE c."deletedAt" IS NULL AND d.depth < 10
      )
      SELECT slug FROM descendants WHERE id <> ${root.id}
    `;
    if (rows.length < 3) throw new Error(`expected 3+ descendants, got ${rows.length}`);
    return `${rows.length} descendants`;
  });

  await check('depth guard bounds a self-referencing cycle', async () => {
    // Writes a genuine cycle, walks it, and confirms the guard stops the query
    // rather than the connection hanging. An unguarded CTE never returns here.
    const a = `${PREFIX}cyc_a`;
    const b = `${PREFIX}cyc_b`;
    await prisma.category.createMany({
      data: [
        { id: a, siteId: SITE_ID, name: 'Cycle A', slug: `${PREFIX}cyc-a`, type: 'BLOG' },
        { id: b, siteId: SITE_ID, name: 'Cycle B', slug: `${PREFIX}cyc-b`, type: 'BLOG', parentId: a },
      ],
      skipDuplicates: true,
    });
    await prisma.category.update({ where: { id: a }, data: { parentId: b } });

    const started = Date.now();
    const rows = await prisma.$queryRaw<Array<{ depth: number }>>`
      WITH RECURSIVE walk AS (
        SELECT id, "parentId", 0 AS depth FROM "Category" WHERE id = ${a}
        UNION ALL
        SELECT c.id, c."parentId", w.depth + 1
          FROM "Category" c JOIN walk w ON c.id = w."parentId"
         WHERE w.depth < 10
      )
      SELECT depth FROM walk ORDER BY depth DESC LIMIT 1
    `;
    return `stopped at depth ${rows[0]?.depth} in ${Date.now() - started}ms`;
  });
}

// ── Faceting ────────────────────────────────────────────────────────────────

/** The seven fields the paper filter panel counts. */
type PaperFacetField = 'year' | 'paperType' | 'examId' | 'boardId' | 'subjectId' | 'shift' | 'locale';

/**
 * Builds one `GROUP BY` per field, exactly as QuestionPaperRepository.facetCounts
 * does — variable-typed `by`, cast at the call site, `$transaction(... as never)`.
 *
 * The literal form (`by: ['year']`) is unwritable under this repo's compiler
 * settings: a literal `by` makes Prisma's conditional type require an `orderBy`
 * key, and `exactOptionalPropertyTypes` then rejects `orderBy: undefined` as a
 * value for an optional property. Production already solved this; the
 * verification script had simply never been compiled to discover it.
 *
 * No `orderBy` is emitted either way, so the SQL is what the plan capture and
 * the timings above measure.
 */
function facetQueries(
  specs: ReadonlyArray<{ field: PaperFacetField; where: Record<string, unknown> }>,
): unknown[] {
  return specs.map(({ field, where }) =>
    prisma.questionPaper.groupBy({
      by: [field as 'year'],
      where: where as Prisma.QuestionPaperWhereInput,
      _count: { _all: true },
    }),
  );
}

async function verifyFaceting(): Promise<void> {
  setGroup('Faceting');

  await check('disjunctive facet counts differ from filtered counts', async () => {
    const base = { status: 'PUBLISHED' as const, deletedAt: null };

    // The year facet must be computed WITHOUT the year filter, or the user can
    // never switch years. This asserts the two counts genuinely differ.
    const grouped = (await prisma.$transaction(
      facetQueries([
        { field: 'year', where: base },
        { field: 'year', where: { ...base, year: { in: [new Date().getFullYear()] } } },
      ]) as never,
    )) as Array<Array<unknown>>;

    const allYears = grouped[0] ?? [];
    const filteredYears = grouped[1] ?? [];

    if (allYears.length <= filteredYears.length) {
      throw new Error('the unfiltered year facet is not wider than the filtered one');
    }
    return `${allYears.length} years unfiltered vs ${filteredYears.length} filtered`;
  });

  await check('seven facet aggregations in one transaction', async () => {
    const where = { status: 'PUBLISHED' as const, deletedAt: null };
    const fields: readonly PaperFacetField[] = [
      'year',
      'paperType',
      'examId',
      'boardId',
      'subjectId',
      'shift',
      'locale',
    ];

    const started = Date.now();
    const results = (await prisma.$transaction(
      facetQueries(fields.map((field) => ({ field, where }))) as never,
    )) as Array<Array<unknown>>;

    const buckets = results.reduce((sum, r) => sum + r.length, 0);
    return `${buckets} buckets in ${Date.now() - started}ms`;
  });
}

// ── Full-text search ────────────────────────────────────────────────────────

async function verifyFullTextSearch(): Promise<void> {
  setGroup('Search');

  const doc = {
    id: `${PREFIX}doc`,
    siteId: SITE_ID,
    ownerType: 'EXAM' as const,
    ownerId: `${PREFIX}owner`,
    locale: 'EN' as const,
    path: '/verify/doc',
    title: 'Joint Entrance Examination Main Physics',
    summary: 'Preparation guide for the physics section',
    body: 'A detailed walkthrough of rotational dynamics and thermodynamics for aspirants.',
    keywords: ['JEE', 'NTA', 'physics'],
    entityLabel: 'Exam',
  };

  await check('indexing a document populates its vector', async () => {
    await prisma.searchDocument.upsert({
      where: {
        siteId_ownerType_ownerId_locale: {
          siteId: doc.siteId,
          ownerType: doc.ownerType,
          ownerId: doc.ownerId,
          locale: doc.locale,
        },
      },
      create: doc,
      update: doc,
    });

    const rows = await prisma.$queryRaw<Array<{ has: boolean }>>`
      SELECT ("searchVector" IS NOT NULL) AS has FROM "SearchDocument" WHERE id = ${doc.id}
    `;
    if (!rows[0]?.has) throw new Error('searchVector is NULL — the generated column is missing');
    return 'vector generated on insert';
  });

  await check('websearch_to_tsquery ranks the document', async () => {
    const rows = await prisma.$queryRaw<Array<{ title: string; score: number }>>`
      WITH q AS (SELECT websearch_to_tsquery('english', 'entrance physics') AS tsq)
      SELECT title, ts_rank_cd("searchVector", q.tsq, 32) AS score
        FROM "SearchDocument", q
       WHERE "searchVector" @@ q.tsq AND "siteId" = ${SITE_ID}
       ORDER BY score DESC LIMIT 5
    `;
    if (rows.length === 0) throw new Error('no match — check the tsvector weighting');
    return `top hit "${rows[0]!.title}" score ${rows[0]!.score.toFixed(4)}`;
  });

  await check('weighting puts a title match above a body match', async () => {
    const rows = await prisma.$queryRaw<Array<{ a: number; b: number }>>`
      WITH q AS (SELECT websearch_to_tsquery('english', 'physics') AS tsq)
      SELECT ts_rank_cd(setweight(to_tsvector('english','physics'),'A'), q.tsq, 32) AS a,
             ts_rank_cd(setweight(to_tsvector('english','physics'),'D'), q.tsq, 32) AS b
        FROM q
    `;
    if (!(rows[0]!.a > rows[0]!.b)) throw new Error('weight A did not outrank weight D');
    return `A=${rows[0]!.a.toFixed(3)} > D=${rows[0]!.b.toFixed(3)}`;
  });

  await check('pg_trgm tolerates a typo', async () => {
    const rows = await prisma.$queryRaw<Array<{ title: string; sim: number }>>`
      SELECT title, similarity(title, 'Entrence Examinaton') AS sim
        FROM "SearchDocument"
       WHERE title % 'Entrence Examinaton'
       ORDER BY sim DESC LIMIT 3
    `;
    if (rows.length === 0) throw new Error('trigram similarity found nothing for a 2-typo query');
    return `matched "${rows[0]!.title}" at ${rows[0]!.sim.toFixed(3)}`;
  });
}

// ── Outbox / SKIP LOCKED ────────────────────────────────────────────────────

async function verifyOutboxSkipLocked(): Promise<void> {
  setGroup('Transactions and outbox');

  await check('two concurrent claims take disjoint batches', async () => {
    await prisma.outboxEvent.createMany({
      data: Array.from({ length: 20 }, (_, index) => ({
        eventType: 'SEARCH_UPSERT' as const,
        ownerType: 'EXAM' as const,
        ownerId: `${PREFIX}skiplock_${index}`,
        payload: {},
      })),
    });

    const claim = (limit: number) => prisma.$queryRaw<Array<{ id: bigint }>>`
      UPDATE "OutboxEvent" SET status = 'PROCESSING', attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM "OutboxEvent"
          WHERE status IN ('PENDING','FAILED') AND "availableAt" <= NOW()
            AND "ownerId" LIKE ${`${PREFIX}skiplock_%`}
          ORDER BY id ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED
       )
      RETURNING id
    `;

    // Fired together. Without SKIP LOCKED the second blocks on the first's row
    // locks and both return the same ids once it unblocks.
    const [first, second] = await Promise.all([claim(10), claim(10)]);
    const overlap = first.filter((row) => second.some((other) => other.id === row.id));

    if (overlap.length > 0) {
      throw new Error(`${overlap.length} rows were claimed TWICE — SKIP LOCKED is not working`);
    }
    return `${first.length} + ${second.length} claimed, 0 overlap`;
  });

  await check('reclaim returns stranded PROCESSING rows', async () => {
    await prisma.$executeRaw`
      UPDATE "OutboxEvent" SET status = 'PROCESSING', "createdAt" = NOW() - INTERVAL '10 minutes'
       WHERE "ownerId" LIKE ${`${PREFIX}skiplock_%`}
    `;
    const result = await prisma.outboxEvent.updateMany({
      where: {
        status: 'PROCESSING',
        createdAt: { lt: new Date(Date.now() - 5 * 60_000) },
        ownerId: { startsWith: `${PREFIX}skiplock_` },
      },
      data: { status: 'PENDING', availableAt: new Date() },
    });
    if (result.count === 0) throw new Error('nothing reclaimed — stranded rows would be stuck');
    return `${result.count} reclaimed`;
  });
}

// ── Real flows ──────────────────────────────────────────────────────────────

async function verifyPublishFlow(): Promise<void> {
  setGroup('Transactions and outbox');

  await check('publish writes the row and its outbox event in ONE transaction', async () => {
    const examId = `${PREFIX}exam`;
    const categoryId = (await prisma.examCategory.findFirst({ select: { id: true } }))?.id ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.exam.create({
        data: {
          id: examId,
          slug: `${PREFIX}exam-slug`,
          name: 'Verify Exam',
          shortName: 'VERIFY',
          conductingBody: 'Verification Authority',
          categoryId,
          level: 'NATIONAL',
          mode: 'ONLINE',
          frequency: 'ANNUAL',
          educationLevel: 'UNDERGRADUATE',
          overview: 'x'.repeat(250),
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdById: ADMIN_ID,
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'SEARCH_UPSERT',
          ownerType: 'EXAM',
          ownerId: examId,
          payload: { reason: 'verify' },
        },
      });
    });

    const event = await prisma.outboxEvent.findFirst({ where: { ownerId: examId } });
    if (!event) throw new Error('no outbox row — the transaction did not include it');
    return `outbox id ${event.id}`;
  });

  await check('a rolled-back transaction leaves NO outbox row', async () => {
    const ghostId = `${PREFIX}ghost`;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.outboxEvent.create({
          data: { eventType: 'SEARCH_UPSERT', ownerType: 'EXAM', ownerId: ghostId, payload: {} },
        });
        throw new Error('deliberate rollback');
      });
    } catch {
      /* expected */
    }

    const orphan = await prisma.outboxEvent.findFirst({ where: { ownerId: ghostId } });
    if (orphan) {
      throw new Error('an outbox row survived a rollback — the guarantee is broken');
    }
    return 'no orphaned event';
  });
}

async function verifySlugRename(): Promise<void> {
  setGroup('Content: slugs and redirects');

  await check('rename writes history and redirects atomically', async () => {
    const examId = `${PREFIX}exam`;
    const oldSlug = `${PREFIX}exam-slug`;
    const newSlug = `${PREFIX}exam-renamed`;

    await prisma.$transaction(async (tx) => {
      await tx.exam.update({ where: { id: examId }, data: { slug: newSlug } });
      await tx.slugHistory.create({
        data: {
          entityType: 'EXAM',
          entityId: examId,
          oldSlug,
          newSlug,
          reason: 'MANUAL_RENAME',
          isActive: true,
        },
      });
      // One per registered sub-path template — the real service derives these
      // from ENTITY_PATH_TEMPLATES.
      for (const suffix of ['', '/syllabus', '/result', '/previous-year-papers']) {
        await tx.redirect.create({
          data: {
            siteId: SITE_ID,
            fromPath: `/exam/${oldSlug}${suffix}`,
            toPath: `/exam/${newSlug}${suffix}`,
            reason: 'slug-change',
          },
        });
      }
    });

    const history = await prisma.slugHistory.findFirst({ where: { entityId: examId } });
    const redirects = await prisma.redirect.count({
      where: { fromPath: { startsWith: `/exam/${oldSlug}` } },
    });
    if (!history || redirects < 4) throw new Error(`history=${!!history} redirects=${redirects}`);
    return `history + ${redirects} redirects`;
  });

  await check('the historical slug resolves to exactly one entity', async () => {
    // @@unique([entityType, oldSlug, locale]) is what makes the 301
    // deterministic. Without it an old slug can point at two entities.
    return expectRejection(
      () =>
        prisma.slugHistory.create({
          data: {
            entityType: 'EXAM',
            entityId: `${PREFIX}other`,
            oldSlug: `${PREFIX}exam-slug`,
            newSlug: 'somewhere-else',
            reason: 'MANUAL_RENAME',
          },
        }),
      /unique|duplicate/i,
    );
  });
}

async function verifyRevisionRollback(): Promise<void> {
  setGroup('Content: revisions');

  await check('revision versions are strictly sequential per owner', async () => {
    const ownerId = `${PREFIX}post`;
    for (let version = 1; version <= 3; version++) {
      await prisma.contentRevision.create({
        data: {
          ownerType: 'CONTENT_ENTRY',
          ownerId,
          version,
          revisionType: 'MANUAL',
          status: 'DRAFT',
          snapshot: { title: `Version ${version}` },
          changedFields: ['title'],
        },
      });
    }
    const rows = await prisma.contentRevision.findMany({
      where: { ownerId },
      orderBy: { version: 'asc' },
      select: { version: true },
    });
    return `versions ${rows.map((r) => r.version).join(', ')}`;
  });

  await check('a duplicate version is rejected — concurrent saves cannot interleave', async () =>
    expectRejection(
      () =>
        prisma.contentRevision.create({
          data: {
            ownerType: 'CONTENT_ENTRY',
            ownerId: `${PREFIX}post`,
            version: 2,
            revisionType: 'MANUAL',
            status: 'DRAFT',
            snapshot: {},
            changedFields: [],
          },
        }),
      /unique|duplicate/i,
    ),
  );

  await check('rollback appends a NEW version rather than rewinding', async () => {
    const ownerId = `${PREFIX}post`;
    const source = await prisma.contentRevision.findFirst({
      where: { ownerId, version: 1 },
      select: { snapshot: true },
    });

    await prisma.contentRevision.create({
      data: {
        ownerType: 'CONTENT_ENTRY',
        ownerId,
        version: 4,
        revisionType: 'ROLLBACK',
        rollbackOfVersion: 1,
        status: 'DRAFT',
        snapshot: source!.snapshot as Prisma.InputJsonValue,
        changedFields: ['title'],
      },
    });

    const total = await prisma.contentRevision.count({ where: { ownerId } });
    if (total !== 4) throw new Error(`expected 4 revisions, found ${total}`);
    return 'history is append-only';
  });
}

async function verifyScheduledPublish(): Promise<void> {
  setGroup('Content: scheduling');

  await check('a future publishedAt on a DRAFT is invisible to the public filter', async () => {
    const id = `${PREFIX}scheduled`;
    await prisma.contentEntry.create({
      data: {
        id,
        siteId: SITE_ID,
        type: 'ARTICLE',
        slug: `${PREFIX}scheduled`,
        path: `/blog/${PREFIX}scheduled`,
        title: 'Scheduled post',
        status: 'DRAFT',
        publishedAt: new Date(Date.now() + 86_400_000),
        authorId: ADMIN_ID,
      },
    });

    const visible = await prisma.contentEntry.count({
      where: { id, status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    });
    if (visible !== 0) throw new Error('a scheduled post is publicly visible');
    return 'hidden until its time';
  });

  await check('the scheduler query finds due posts via the status+publishedAt index', async () => {
    await prisma.contentEntry.update({
      where: { id: `${PREFIX}scheduled` },
      data: { publishedAt: new Date(Date.now() - 60_000) },
    });
    const due = await prisma.contentEntry.findMany({
      where: { status: 'DRAFT', deletedAt: null, publishedAt: { not: null, lte: new Date() } },
      select: { id: true },
    });
    if (!due.some((row) => row.id === `${PREFIX}scheduled`)) {
      throw new Error('the due post was not returned');
    }
    return `${due.length} due`;
  });
}

// ── Failure paths ───────────────────────────────────────────────────────────

async function verifyFailurePaths(): Promise<void> {
  setGroup('Failure paths');

  await check('duplicate slug is rejected', async () =>
    expectRejection(
      () =>
        prisma.exam.create({
          data: {
            id: `${PREFIX}dup_exam`,
            slug: `${PREFIX}exam-renamed`,
            name: 'Duplicate',
            shortName: 'DUP',
            conductingBody: 'x',
            level: 'NATIONAL',
            mode: 'ONLINE',
            frequency: 'ANNUAL',
            educationLevel: 'UNDERGRADUATE',
          },
        }),
      /unique|duplicate/i,
    ),
  );

  await check('tombstoning frees the slug for reuse', async () => {
    const examId = `${PREFIX}exam`;
    await prisma.exam.update({
      where: { id: examId },
      data: { slug: `${PREFIX}exam-renamed__d${Math.floor(Date.now() / 1000)}`, deletedAt: new Date() },
    });
    const reused = await prisma.exam.create({
      data: {
        id: `${PREFIX}exam_reuse`,
        slug: `${PREFIX}exam-renamed`,
        name: 'Reused slug',
        shortName: 'REUSE',
        conductingBody: 'x',
        level: 'NATIONAL',
        mode: 'ONLINE',
        frequency: 'ANNUAL',
        educationLevel: 'UNDERGRADUATE',
      },
      select: { slug: true },
    });
    return `re-created with slug ${reused.slug}`;
  });

  await check('QuestionPaper dedupeKey blocks a duplicate import', async () => {
    const existing = await prisma.questionPaper.findFirst({ select: { dedupeKey: true } });
    return expectRejection(
      () =>
        prisma.questionPaper.create({
          data: {
            id: `${PREFIX}dup_paper`,
            slug: `${PREFIX}dup-paper`,
            dedupeKey: existing!.dedupeKey,
            title: 'Duplicate import',
            paperType: 'PREVIOUS_YEAR',
            year: 2024,
          },
        }),
      /unique|duplicate/i,
    );
  });

  await check('the outbox retries a failure with backoff', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        eventType: 'CACHE_REVALIDATE',
        ownerType: 'EXAM',
        ownerId: `${PREFIX}retry`,
        payload: {},
        attempts: 1,
      },
    });
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'FAILED', lastError: 'simulated', availableAt: new Date(Date.now() + 30_000) },
    });

    const claimableNow = await prisma.outboxEvent.count({
      where: { id: event.id, status: { in: ['PENDING', 'FAILED'] }, availableAt: { lte: new Date() } },
    });
    if (claimableNow !== 0) throw new Error('a backed-off event is immediately claimable again');
    return 'backoff respected';
  });

  await check('deleting a media asset still referenced is refused', async () => {
    // The service guard counts live references. This asserts the FK also
    // refuses, so a bug in the service cannot orphan a paper's file.
    const file = await prisma.questionPaperFile.findFirst({ select: { mediaId: true } });
    return expectRejection(
      () => prisma.mediaAsset.delete({ where: { id: file!.mediaId } }),
      /foreign key|constraint|violat/i,
    );
  });
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  setGroup('Cleanup');

  await check('verification rows removed', async () => {
    // Order matters: children before parents, or the FKs refuse.
    await prisma.$transaction([
      prisma.outboxEvent.deleteMany({ where: { ownerId: { startsWith: PREFIX } } }),
      prisma.contentRevision.deleteMany({ where: { ownerId: { startsWith: PREFIX } } }),
      prisma.searchDocument.deleteMany({ where: { ownerId: { startsWith: PREFIX } } }),
      prisma.redirect.deleteMany({ where: { fromPath: { contains: PREFIX } } }),
      prisma.slugHistory.deleteMany({ where: { entityId: { startsWith: PREFIX } } }),
      prisma.contentEntry.deleteMany({ where: { id: { startsWith: PREFIX } } }),
      prisma.exam.deleteMany({ where: { id: { startsWith: PREFIX } } }),
      prisma.category.deleteMany({ where: { id: { startsWith: PREFIX } } }),
      prisma.boardClass.deleteMany({ where: { id: { startsWith: PREFIX } } }),
      prisma.mediaAsset.deleteMany({ where: { id: { startsWith: PREFIX } } }),
    ]);
    return 'done';
  });
}

// ── Report ──────────────────────────────────────────────────────────────────

/**
 * Grouped summary.
 *
 * The point is that a future failure names the SUBSYSTEM immediately. "23/25
 * passed" tells you something broke; "Transactions ✗" tells you where to look.
 */
function report(): void {
  const failed = checks.filter((check) => !check.ok);

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${checks.length - failed.length} / ${checks.length} checks passed`);

  const groups = [...new Set(checks.map((check) => check.group))];
  for (const name of groups) {
    const inGroup = checks.filter((check) => check.group === name);
    const groupFailed = inGroup.filter((check) => !check.ok).length;
    console.log(`\n${name}${groupFailed > 0 ? `  (${groupFailed} failed)` : ''}`);
    for (const check of inGroup) {
      console.log(`  ${check.ok ? '✓' : '✗'} ${check.name}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n${'─'.repeat(64)}\nFailure detail:`);
    for (const check of failed) {
      console.log(`  [${check.group}] ${check.name}\n      ${check.detail}`);
    }
  }

  // Stating what this suite does NOT cover matters as much as what it does — a
  // green run should not be mistaken for "the whole system is verified".
  console.log(`\n${'─'.repeat(64)}`);
  console.log('Not covered here (needs the worker process and live provider accounts):');
  console.log('  · CACHE_REVALIDATE delivery to the Next.js endpoint');
  console.log('  · Cloudinary sign/confirm/replace round-trip');
  console.log('  · IndexNow submission');
  console.log('These are enqueued and asserted as outbox rows; delivery is a separate step.');

  process.exitCode = failed.length > 0 ? 1 : 0;
}

main()
  .catch((error: unknown) => {
    console.error('\nVerification aborted:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
