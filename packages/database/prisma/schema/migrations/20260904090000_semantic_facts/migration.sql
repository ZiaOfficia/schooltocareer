-- Phase 2A: the semantic fact layer.
--
-- Hand-written and applied with `migrate deploy`, per the procedure in
-- tooling/scripts/guard-migrate-dev.mjs. `migrate dev` diffs the schema against
-- the database, reads the manual objects in migrations/manual/001_raw_constraints.sql
-- as drift, and on a database with no TTY resolves that by dropping it. It has
-- done so once.
--
-- Purely ADDITIVE. Two new tables, five new enums, and nothing touched on any
-- existing table except two back-relation fields, which are virtual in Prisma
-- and generate no DDL at all.

-- CreateEnum
CREATE TYPE "FactType" AS ENUM (
  'EXAM_DATE', 'APPLICATION_START', 'APPLICATION_END', 'RESULT_DATE',
  'OFFICIAL_APPLICATION_URL', 'OFFICIAL_RESULT_URL'
);

-- CreateEnum: how sure the EXTRACTOR is. Not how much the value matters.
CREATE TYPE "FactConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum: what publishing it wrong would cost. Independent of confidence.
CREATE TYPE "FactRisk" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "FactChangeKind" AS ENUM ('ADDED', 'CHANGED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FactReviewStatus" AS ENUM (
  'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'IGNORED', 'SUPERSEDED'
);

-- CreateTable: one observation, from one snapshot, by one extractor version.
CREATE TABLE "ExtractedFact" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "factType" "FactType" NOT NULL,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "confidence" "FactConfidence" NOT NULL,
    "isTentative" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT NOT NULL,
    "extractorVersion" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable: a semantic difference that needs a human decision.
CREATE TABLE "FactChange" (
    "id" TEXT NOT NULL,
    "extractedFactId" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "factType" "FactType" NOT NULL,
    "kind" "FactChangeKind" NOT NULL,
    "previousValue" TEXT,
    "proposedValue" TEXT,
    "risk" "FactRisk" NOT NULL,
    "confidence" "FactConfidence" NOT NULL,
    "status" "FactReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "canonicalModel" TEXT NOT NULL,
    "canonicalId" TEXT,
    "canonicalVersion" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: THE IDEMPOTENCY KEY. One observation per fact per snapshot, so
-- re-running extraction converges instead of appending.
CREATE UNIQUE INDEX "ExtractedFact_snapshotId_ownerId_factType_key"
  ON "ExtractedFact"("snapshotId", "ownerId", "factType");

-- CreateIndex: an entity's history for one fact, newest first.
CREATE INDEX "ExtractedFact_ownerType_ownerId_factType_extractedAt_idx"
  ON "ExtractedFact"("ownerType", "ownerId", "factType", "extractedAt" DESC);

-- CreateIndex
CREATE INDEX "ExtractedFact_sourceId_extractedAt_idx"
  ON "ExtractedFact"("sourceId", "extractedAt" DESC);

-- CreateIndex: the review queue's only query — what is pending, worst first.
CREATE INDEX "FactChange_status_risk_createdAt_idx"
  ON "FactChange"("status", "risk", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FactChange_ownerType_ownerId_factType_status_idx"
  ON "FactChange"("ownerType", "ownerId", "factType", "status");

-- CreateIndex
CREATE INDEX "FactChange_extractedFactId_idx" ON "FactChange"("extractedFactId");

-- AddForeignKey
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SourceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactChange" ADD CONSTRAINT "FactChange_extractedFactId_fkey"
  FOREIGN KEY ("extractedFactId") REFERENCES "ExtractedFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SetNull, not Cascade. Deleting a departed editor's account must
-- not delete the record that an exam date was approved — the audit trail is the
-- point, and it survives the reviewer.
ALTER TABLE "FactChange" ADD CONSTRAINT "FactChange_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
