# @stc/database — Schema v1.0-LAUNCH

**30 models.** The launch cut. Validated against Prisma 6.3.0.

The full 89-model design is preserved at `docs/architecture/schema-full-v1/`
and is the roadmap, not dead weight — everything deferred is **additive**.

```
prisma/schema/
├── schema.prisma       0  datasource, generator, 22 enums
├── platform.prisma     2  Site (seam), OutboxEvent
├── auth.prisma         2  User (role enum), Session
├── education.prisma    7  State, Board, ClassLevel, BoardClass,
│                          Subject, BoardClassSubject, Chapter
├── exam.prisma         7  ExamCategory, Exam, ExamYear, ExamEvent,
│                          QuestionPaper, QuestionPaperFile, Result
├── content.prisma      6  ContentEntry, Category, PageSection, FaqItem,
│                          ContentDraft, ContentRevision
├── media.prisma        1  MediaAsset
└── seo.prisma          5  SeoMeta, SlugHistory, Redirect,
                           SearchDocument, SearchQueryLog
```

---

## What was cut, and why it's safe

| Deferred | Phase | Why deferring is free |
|---|---|---|
| Careers, Colleges, Courses, Scholarships, Jobs | 2 | New tables, no changes to existing ones |
| RBAC tables (Role/Permission/…) | 2 | `User.role` enum today; all checks already funnel through one `can()` helper |
| ExamCutoff, AnswerKey, ExamSubject, ExamEligibility, ExamPatternSection | 2 | Prose sub-pages are `PageSection` rows; structured versions are new tables |
| Tags, MediaFolder, MediaLink, ContentRelation | 2 | New tables |
| Article/Note/SyllabusDoc satellites | 2 | `ContentEntry.type` + `attributes` JSON covers launch |
| Analytics, AuditLog, PageStat, DownloadRecord | 3 | New tables |
| Translations (11 tables) | 3 | New tables; `locale` columns already present |
| AI, embeddings, pgvector | 3 | New tables |

**One thing was kept despite being unused: `siteId`.** It participates in
composite unique constraints on `ContentEntry`, `Category`, `SeoMeta`,
`Redirect` and `SearchDocument`. Adding a column to a populated table is
trivial; altering a unique index on a 100k-row table is not. One seeded row,
no UI, no site switcher.

**Two things were kept that look like "workflow" but aren't:** `ContentDraft`
(autosave) and `ContentRevision` (append-only history). No review queue, no
scheduling, no locks. These exist so that losing the blog post you were writing
becomes impossible. The content is the asset.

---

## Conventions

| Concern | Rule |
|---|---|
| Entity/content IDs | `String @default(cuid())` — safe to expose, no enumeration |
| Append-only tables | `BigInt @default(autoincrement())` — B-tree locality |
| Audit columns | `createdById` / `updatedById` are **unconstrained** — no FK, no back-reference |
| Soft delete | `deletedAt` on user-facing rows only. Never on revisions or logs. |
| M:N | Always an explicit join model. Never Prisma's implicit `@relation`. |

**Referential actions:** `Cascade` for owned children (Chapter, ExamEvent,
Session) · `Restrict` for reference data (`Subject`, `ClassLevel`) and
published artefacts (`QuestionPaperFile.media`) · `SetNull` for optional links.

**Polymorphism** (`ownerType` + `ownerId`, no FK) is permitted on **exactly**
seven tables: `ContentRevision`, `ContentDraft`, `PageSection`, `FaqItem`,
`SlugHistory`, `SearchDocument`, `OutboxEvent`. All core domain relationships
use real foreign keys. `OwnerType` already contains the Phase 2 values
(`COLLEGE`, `COURSE`, `CAREER`, …) so Phase 2 adds tables, not enum migrations.

---

## Slugs

| Tier | Models | Constraint |
|---|---|---|
| Global | Exam, Board, Subject, QuestionPaper, Result | `slug @unique` |
| Scoped | BoardClass, BoardClassSubject, Chapter, ExamYear | `@@unique([parentId, slug])` |
| Site + type + locale | ContentEntry, Category | `@@unique([siteId, type, slug, locale])` |

Cross-table collisions don't matter — every URL is namespaced by its silo
prefix (`/exam/`, `/board/`).

**Generation** (inside the create transaction): slugify → reserved-word check
(`admin`, `api`, `search`, `sitemap`, `_next`) → probe → domain-meaningful
discriminator (`jee-main-2026`, not `jee-main-2`) → retry on unique violation.
The DB constraint is the guard; the probe is an optimisation.

**Immutable after publish.** Renaming is one transaction:

```
new slug → SlugHistory row → N Redirect rows (one per sub-path template)
        → ContentEntry.path rewrite → SearchDocument.path
        → OutboxEvent(CACHE_REVALIDATE)
```

Sub-path templates live in `packages/config/src/routes.ts`, so adding a new
sub-page extends redirect coverage for all past renames on the next
regeneration.

---

## Soft delete: tombstone, not partial unique

Partial unique indexes (`WHERE deletedAt IS NULL`) free the slug but **break
`findUnique`/`upsert`**, because Prisma has no knowledge of raw partial
indexes. Tombstoning keeps the plain `@unique` and loses nothing, because
`SlugHistory` preserves the original value.

**On soft delete, in one transaction:**

```
slug      := slug || '__d' || epoch          (length-guarded)
dedupeKey := dedupeKey || '__d' || epoch     (QuestionPaper)
email     := id || '+deleted@tombstone.invalid'
SlugHistory { reason: SOFT_DELETE, isActive: false }
Redirect    old path → parent listing, 301
OutboxEvent SEARCH_DELETE + CACHE_REVALIDATE
```

**On restore:** read the original from `SlugHistory`, attempt to reclaim. If
taken, fail with a clear error requiring an explicit new slug. Never silent.

Partial uniques are used only where the column is never a `findUnique` key:
`MediaAsset.checksum` and `QuestionPaperFile.isCurrent`.

**Cascade:** PostgreSQL `ON DELETE CASCADE` never fires on a soft delete.
Soft-deleting a `Board` must walk `BoardClass → BoardClassSubject → Chapter` in
one transaction — `CascadeSoftDeleteService`, driven by a declared relationship
map, written once.

**Query enforcement** is a Prisma Client Extension (`src/extensions/soft-delete.ts`),
not per-query `where` clauses. One forgotten `deletedAt: null` leaks deleted
content onto a public, indexed page. `.withDeleted()` is the admin escape hatch.

---

## Search

`SearchDocument` is the canonical, **provider-agnostic** index.

- **Now:** PostgreSQL FTS reads it directly via the generated `searchVector` —
  weighted A/B/C/D, locale-branched (PostgreSQL ships no Hindi stemmer, so
  Devanagari uses `'simple'`). See `001_raw_constraints.sql`.
- **Later:** Meilisearch becomes a *second consumer* of
  `OutboxEvent(SEARCH_UPSERT)` behind `ISearchProvider`. Backfill, dual-read
  behind a flag, cut over. **Zero schema migration.**

Indexing uses the **transactional outbox**: the `OutboxEvent` row is written in
the same transaction as the content write, and a worker claims batches with
`SELECT … FOR UPDATE SKIP LOCKED`. Enqueueing to Redis inside a service method
means a later rollback leaves the index permanently wrong.

`SearchQueryLog` earns its place at launch for one reason: **zero-result
queries are your editorial backlog, written in your users' own words.**

---

## Migrations

```
Neon branches:  main → production · staging → staging · preview/* → per PR
```

1. `pnpm db:migrate --name <name>` — SQL committed alongside the schema change
2. CI: `prisma migrate diff` (drift), `prisma validate`, apply to preview branch
3. Deploy: Render pre-deploy runs `prisma migrate deploy` with
   **`DIRECT_DATABASE_URL`** — PgBouncer transaction pooling breaks advisory
   locks and DDL
4. Post-deploy: `pnpm db:constraints` (idempotent)

**Rules:** never edit an applied migration · expand/contract for breaking
changes · backfills are jobs, not migrations · CI fails on `DROP TABLE` /
`DROP COLUMN` without `-- @allow-destructive` · seeds are idempotent `upsert`s
keyed by slug.

---

## Read-path rules

1. **Never offset-paginate deep** — `OFFSET 50000` scans and discards 50,000 rows. Feeds use cursor pagination on `(publishedAt, id)`.
2. **Two cache layers before Postgres** — Next ISR (tag-invalidated) → `ICacheProvider` cache-aside → Postgres.
3. **Pooled connections at runtime only** — `?pgbouncer=true&connection_limit=1`. Migrations use the direct URL.
4. **Denormalised counters, never `COUNT(*)` on render.** `viewCount`, `downloadCount`, `popularityScore` are updated by a batched worker. A synchronous `SET view_count = view_count + 1` is row-lock contention that takes the site down on result-declaration day.

---

## Known trade-off: in-memory cache on multiple instances

`ICacheProvider` ships with an in-memory LRU. On more than one Render instance,
`delByTag` invalidates only the instance that handled the request. Mitigation
until Redis exists: memory-tier TTLs ≤60s, with Next.js ISR tag revalidation as
the authoritative layer. That limitation *is* the trigger to add Redis — not a
date on a roadmap.
