-- ===========================================================================
-- SchoolToCareer — constraints & indexes PostgreSQL supports but Prisma
-- cannot express.
--
-- HOW TO APPLY
--   These are NOT run by `prisma migrate deploy`. `CREATE INDEX CONCURRENTLY`
--   cannot run inside a transaction, and Prisma wraps every migration in one.
--   Apply via the idempotent post-deploy step:
--       pnpm --filter @stc/database db:constraints
--   (infra/scripts/apply-concurrent-indexes.ts, using DIRECT_DATABASE_URL)
--
-- Every statement here is IF NOT EXISTS / idempotent and safe to re-run.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- 1. NULLS NOT DISTINCT identity constraints  (PostgreSQL 15+)
--
-- PostgreSQL treats NULLs as DISTINCT in a unique constraint, so a plain
-- @@unique containing a nullable column enforces NOTHING for the null rows.
-- Without these, "CBSE Class 10" (no stream) could be inserted five times.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_boardclass_identity
  ON "BoardClass" ("boardId", "classLevelId", "streamId") NULLS NOT DISTINCT
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_collegecourse_identity
  ON "CollegeCourse" ("collegeId", "courseId", "specializationId") NULLS NOT DISTINCT
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_examyear_identity
  ON "ExamYear" ("examId", "year", "sessionName") NULLS NOT DISTINCT
  WHERE "deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Partial uniques — columns that are NEVER findUnique keys.
--
-- Using a partial index here (rather than tombstoning) costs nothing, because
-- these columns are looked up with findFirst anyway. Lookup/upsert keys such
-- as `slug`, `dedupeKey`, `publicId` and `email` keep their Prisma @unique and
-- are TOMBSTONED on soft delete instead — see README.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_media_checksum_live
  ON "MediaAsset" ("checksum")
  WHERE "deletedAt" IS NULL AND "checksum" IS NOT NULL;

-- Exactly one current file per (paper, role, locale).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_paperfile_current
  ON "QuestionPaperFile" ("questionPaperId", "fileRole", "locale")
  WHERE "isCurrent" = true;

-- ---------------------------------------------------------------------------
-- 3. Partial indexes for the live-content hot path.
--
-- A partial index over ~100k PUBLISHED rows is far smaller than a full index
-- over drafts + archives + soft-deleted rows, and every public page render
-- carries exactly this predicate.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_live
  ON "ContentEntry" ("siteId", "type", "publishedAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_live_entity
  ON "ContentEntry" ("examId", "type", "publishedAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paper_live
  ON "QuestionPaper" ("examId", "year" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paper_live_board
  ON "QuestionPaper" ("boardClassId", "subjectId", "year" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_live
  ON "Exam" ("popularityScore" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_result_live
  ON "Result" ("year" DESC, "declaredAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Full-text search.
--
-- Weighting: title A, keywords B, summary C, body D.
--
-- The locale branch is REQUIRED: PostgreSQL ships no Hindi stemmer or stopword
-- dictionary, so Devanagari must use the 'simple' configuration. Using
-- 'english' on Hindi text silently produces near-useless tokens.
--
-- The CASE is valid inside a generated column only because both to_tsvector
-- calls use LITERAL regconfig values, which makes the expression immutable.
-- (This is also why unaccent() is not used here — it is not immutable without
-- a wrapper function.)
-- ---------------------------------------------------------------------------

ALTER TABLE "SearchDocument"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    CASE WHEN "locale" = 'HI' THEN
        setweight(to_tsvector('simple',  coalesce("title",   '')), 'A') ||
        setweight(to_tsvector('simple',  array_to_string("keywords", ' ')), 'B') ||
        setweight(to_tsvector('simple',  coalesce("summary", '')), 'C') ||
        setweight(to_tsvector('simple',  coalesce("body",    '')), 'D')
    ELSE
        setweight(to_tsvector('english', coalesce("title",   '')), 'A') ||
        setweight(to_tsvector('english', array_to_string("keywords", ' ')), 'B') ||
        setweight(to_tsvector('english', coalesce("summary", '')), 'C') ||
        setweight(to_tsvector('english', coalesce("body",    '')), 'D')
    END
  ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_vector
  ON "SearchDocument" USING GIN ("searchVector");

-- Trigram index for autocomplete and fuzzy/typo tolerance.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_title_trgm
  ON "SearchDocument" USING GIN ("title" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 5. pgvector (RESERVED — not populated in v1.0).
--
-- The extension is created now because adding it to a live database later
-- requires a maintenance window. The index is cheap on an empty table.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embedding_hnsw
  ON "ContentEmbedding" USING hnsw ("embedding" vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 6. Monthly range partitioning for the unbounded append-only tables.
--
-- These five tables grow forever. AnalyticsEvent alone reaches ~35M rows/year.
-- PostgreSQL requires the partition key in the primary key, which is why these
-- models declare @@id([id, <timeColumn>]) in the Prisma schema.
--
-- Converting an existing table to partitioned requires a rename + copy, so
-- this MUST be applied before production traffic. The monthly
-- `create-partitions` worker rolls new partitions forward and detaches those
-- past retention (raw events: 90 days; rollups: permanent).
--
-- Run infra/scripts/partition-bootstrap.ts to convert and pre-create the
-- first 12 partitions for:
--     AuditLog        (createdAt)
--     AnalyticsEvent  (occurredAt)
--     DownloadRecord  (createdAt)
--     SearchQueryLog  (createdAt)
--     PageStat        (date)
-- ---------------------------------------------------------------------------
