-- ===========================================================================
-- SchoolToCareer — Schema v1.0-LAUNCH
-- Constraints & indexes PostgreSQL supports but Prisma cannot express.
--
-- HOW TO APPLY
--   NOT run by `prisma migrate deploy`. `CREATE INDEX CONCURRENTLY` cannot run
--   inside a transaction, and Prisma wraps every migration in one.
--       pnpm db:constraints
--   (tooling/scripts/apply-concurrent-indexes.ts, using DIRECT_DATABASE_URL)
--
-- Every statement is idempotent and safe to re-run.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------------------------------------------------------------------------
-- 1. NULLS NOT DISTINCT identity constraints  (PostgreSQL 15+)
--
-- PostgreSQL treats NULLs as DISTINCT in a unique constraint, so a plain
-- @@unique containing a nullable column enforces NOTHING for the null rows.
-- Without these, "CBSE Class 10" (no stream) could be inserted five times.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_boardclass_identity
  ON "BoardClass" ("boardId", "classLevelId", "stream") NULLS NOT DISTINCT
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_examyear_identity
  ON "ExamYear" ("examId", "year", "sessionName") NULLS NOT DISTINCT
  WHERE "deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Partial uniques — columns that are NEVER findUnique keys.
--
-- A partial index costs nothing here because these are looked up with
-- findFirst anyway. Lookup/upsert keys (`slug`, `dedupeKey`, `publicId`,
-- `email`) keep their Prisma @unique and are TOMBSTONED on soft delete
-- instead — see README.
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

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_live_exam
  ON "ContentEntry" ("examId", "type", "publishedAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paper_live_exam
  ON "QuestionPaper" ("examId", "year" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paper_live_board
  ON "QuestionPaper" ("boardClassId", "subjectId", "year" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

-- The UNFILTERED browse default. Every other index on this table leads with
-- examId, boardClassId or paperType, so none of them can supply the ordering
-- for "all live papers, newest first" — the planner fell back to a Seq Scan
-- plus a top-N heapsort over all 3,000 seeded rows.
--
-- That costs 1.4 ms today and scales linearly: 20,418 papers at launch is ~10 ms
-- of pure sort on the single most-visited listing on the site, and it only goes
-- up. Columns match the keyset cursor (year, id) so the sort disappears
-- entirely rather than just getting cheaper.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paper_live_year
  ON "QuestionPaper" ("year" DESC, "id" DESC)
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
-- calls use LITERAL regconfig values, which makes those calls immutable.
-- (Also why unaccent() is not used here — not immutable without a wrapper.)
--
-- array_to_string() NEEDS THE SAME TREATMENT. It is marked STABLE, not
-- IMMUTABLE, because in the general case it calls an element type's output
-- function. PostgreSQL therefore rejects the whole expression with
--   42P17: generation expression is not immutable
-- For text[] specifically the result is genuinely immutable, so the wrapper
-- below asserts what the generic signature cannot.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stc_keywords_text(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS 'SELECT array_to_string($1, '' '')';

-- ---------------------------------------------------------------------------
-- WHY THIS IS A DO BLOCK AND NOT `ADD COLUMN IF NOT EXISTS`
--
-- The Prisma schema declares `searchVector Unsupported("tsvector")?`, so
-- `prisma migrate` creates the column as a PLAIN tsvector. `IF NOT EXISTS`
-- then finds it present, does nothing, and reports success — leaving the GIN
-- index built over a column that is NULL for every row, forever. Search
-- returns zero results and nothing anywhere reports an error.
--
-- So: drop the column when it exists but is not generated, then add it
-- properly. Re-running when it is already correct does nothing, which matters
-- because ADD COLUMN ... STORED takes ACCESS EXCLUSIVE and rewrites the table.
-- ---------------------------------------------------------------------------

DO $searchvector$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
      JOIN pg_class c     ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'SearchDocument'
       AND a.attname = 'searchVector' AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attgenerated <> 's'
  ) THEN
    ALTER TABLE "SearchDocument" DROP COLUMN "searchVector";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
      JOIN pg_class c     ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'SearchDocument'
       AND a.attname = 'searchVector' AND a.attnum > 0 AND NOT a.attisdropped
  ) THEN
    ALTER TABLE "SearchDocument"
      ADD COLUMN "searchVector" tsvector
      GENERATED ALWAYS AS (
        CASE WHEN "locale" = 'HI' THEN
            setweight(to_tsvector('simple',  coalesce("title",   '')), 'A') ||
            setweight(to_tsvector('simple',  stc_keywords_text("keywords")), 'B') ||
            setweight(to_tsvector('simple',  coalesce("summary", '')), 'C') ||
            setweight(to_tsvector('simple',  coalesce("body",    '')), 'D')
        ELSE
            setweight(to_tsvector('english', coalesce("title",   '')), 'A') ||
            setweight(to_tsvector('english', stc_keywords_text("keywords")), 'B') ||
            setweight(to_tsvector('english', coalesce("summary", '')), 'C') ||
            setweight(to_tsvector('english', coalesce("body",    '')), 'D')
        END
      ) STORED;
  END IF;
END
$searchvector$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_vector
  ON "SearchDocument" USING GIN ("searchVector");

-- Trigram index for autocomplete and typo tolerance.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_title_trgm
  ON "SearchDocument" USING GIN ("title" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- DEFERRED to Phase 2/3 (see docs/architecture/schema-full-v1/):
--   • pgvector extension + HNSW index on ContentEmbedding
--   • monthly range partitioning for AnalyticsEvent / AuditLog /
--     DownloadRecord / PageStat
--   • NULLS NOT DISTINCT identity index on CollegeCourse
--
-- NOTE ON PARTITIONING: converting a populated table to partitioned requires a
-- rename + copy. SearchQueryLog is the only append-only table in the launch
-- cut and is expected to stay small (<1M rows in year one). Revisit before it
-- does not.
-- ---------------------------------------------------------------------------
