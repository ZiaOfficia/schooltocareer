-- Question bank, part 2 of 2: exam subjects, units and chapters; questions,
-- options and answers; computed chapter statistics; reader error reports.
-- See questions.prisma for what each table is for and docs/QUESTION-BANK.md
-- for the sourcing rules.
--
-- Hand-written and applied with `migrate deploy`, per the procedure in
-- tooling/scripts/guard-migrate-dev.mjs. Written to match what Prisma
-- generates for questions.prisma (names, types, defaults, FK actions) so that
-- a later diff against the schema is empty.
--
-- Purely ADDITIVE. Eight new tables and six new enums. Nothing on any existing
-- table changes: the back-relation fields added to Exam, Subject,
-- QuestionPaper and User are virtual in Prisma and generate no DDL.

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ_SINGLE', 'MCQ_MULTI', 'NUMERICAL');

-- CreateEnum: where a shown answer comes from. Never OFFICIAL_* without a key.
CREATE TYPE "AnswerProvenance" AS ENUM ('OFFICIAL_FINAL', 'OFFICIAL_PROVISIONAL', 'EDITORIAL', 'DROPPED');

-- CreateEnum
CREATE TYPE "SyllabusStatus" AS ENUM ('IN_SYLLABUS', 'REDUCED', 'REMOVED');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionReportKind" AS ENUM ('WRONG_ANSWER', 'SOLUTION_ERROR', 'TYPO', 'MISSING_FIGURE', 'OTHER');

-- CreateEnum
CREATE TYPE "QuestionReportStatus" AS ENUM ('OPEN', 'FIXED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExamSubject" (
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSubject_pkey" PRIMARY KEY ("examId","subjectId")
);

-- CreateTable
CREATE TABLE "ExamUnit" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamChapter" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "unitId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "syllabusStatus" "SyllabusStatus" NOT NULL DEFAULT 'IN_SYLLABUS',
    "syllabusSourceUrl" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExamChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "questionPaperId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "subjectId" TEXT,
    "examChapterId" TEXT,
    "type" "QuestionType" NOT NULL,
    "marksRight" DOUBLE PRECISION NOT NULL,
    "marksWrong" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stem" TEXT NOT NULL,
    "stemHi" TEXT,
    "difficulty" "QuestionDifficulty",
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHi" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "questionId" TEXT NOT NULL,
    "provenance" "AnswerProvenance" NOT NULL,
    "answerKeySourceUrl" TEXT,
    "numericValue" DECIMAL(18,6),
    "numericTolerance" DECIMAL(18,6),
    "solution" TEXT,
    "solutionHi" TEXT,
    "authorId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "ExamChapterYearStat" (
    "examChapterId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "questions" INTEGER NOT NULL,
    "subjectQuestions" INTEGER NOT NULL,
    "papersInYear" INTEGER NOT NULL,
    "weightagePct" DOUBLE PRECISION NOT NULL,
    "changePct" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamChapterYearStat_pkey" PRIMARY KEY ("examChapterId","year")
);

-- CreateTable
CREATE TABLE "QuestionErrorReport" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "kind" "QuestionReportKind" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "QuestionReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionErrorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSubject_subjectId_idx" ON "ExamSubject"("subjectId");

-- CreateIndex
CREATE INDEX "ExamUnit_examId_subjectId_order_idx" ON "ExamUnit"("examId", "subjectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ExamUnit_examId_subjectId_slug_key" ON "ExamUnit"("examId", "subjectId", "slug");

-- CreateIndex
CREATE INDEX "ExamChapter_examId_subjectId_order_idx" ON "ExamChapter"("examId", "subjectId", "order");

-- CreateIndex
CREATE INDEX "ExamChapter_unitId_order_idx" ON "ExamChapter"("unitId", "order");

-- CreateIndex
CREATE INDEX "ExamChapter_status_deletedAt_idx" ON "ExamChapter"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamChapter_examId_subjectId_slug_key" ON "ExamChapter"("examId", "subjectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Question_publicId_key" ON "Question"("publicId");

-- CreateIndex
CREATE INDEX "Question_examChapterId_status_publishedAt_idx" ON "Question"("examChapterId", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Question_questionPaperId_subjectId_number_idx" ON "Question"("questionPaperId", "subjectId", "number");

-- CreateIndex
CREATE INDEX "Question_status_deletedAt_idx" ON "Question"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionPaperId_number_key" ON "Question"("questionPaperId", "number");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_order_idx" ON "QuestionOption"("questionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_label_key" ON "QuestionOption"("questionId", "label");

-- CreateIndex
CREATE INDEX "QuestionAnswer_provenance_idx" ON "QuestionAnswer"("provenance");

-- CreateIndex
CREATE INDEX "QuestionAnswer_reviewedById_idx" ON "QuestionAnswer"("reviewedById");

-- CreateIndex
CREATE INDEX "ExamChapterYearStat_year_idx" ON "ExamChapterYearStat"("year");

-- CreateIndex
CREATE INDEX "QuestionErrorReport_status_createdAt_idx" ON "QuestionErrorReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionErrorReport_questionId_idx" ON "QuestionErrorReport"("questionId");

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamUnit" ADD CONSTRAINT "ExamUnit_examId_subjectId_fkey" FOREIGN KEY ("examId", "subjectId") REFERENCES "ExamSubject"("examId", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamChapter" ADD CONSTRAINT "ExamChapter_examId_subjectId_fkey" FOREIGN KEY ("examId", "subjectId") REFERENCES "ExamSubject"("examId", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamChapter" ADD CONSTRAINT "ExamChapter_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ExamUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "QuestionPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examChapterId_fkey" FOREIGN KEY ("examChapterId") REFERENCES "ExamChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamChapterYearStat" ADD CONSTRAINT "ExamChapterYearStat_examChapterId_fkey" FOREIGN KEY ("examChapterId") REFERENCES "ExamChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionErrorReport" ADD CONSTRAINT "QuestionErrorReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CHECK constraints. Prisma cannot express these and does not introspect
-- them, so they cause no drift. Each one turns a data-entry slip into an
-- error at write time instead of a wrong number on a page.
-- ---------------------------------------------------------------------------

-- A question's position in its paper starts at 1.
ALTER TABLE "Question" ADD CONSTRAINT "Question_number_positive_check"
  CHECK ("number" > 0);

-- Marks for a right answer are positive; marks for a wrong one are a penalty
-- (negative) or nothing. A positive marksWrong is always a sign slip.
ALTER TABLE "Question" ADD CONSTRAINT "Question_marks_sign_check"
  CHECK ("marksRight" > 0 AND "marksWrong" <= 0);

-- A tolerance is a distance, and only means something next to a value.
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_tolerance_check"
  CHECK ("numericTolerance" IS NULL OR ("numericTolerance" >= 0 AND "numericValue" IS NOT NULL));

-- A chapter cannot hold more of a subject's questions than the subject had,
-- and a year with no questions in the subject has no stat row at all.
ALTER TABLE "ExamChapterYearStat" ADD CONSTRAINT "ExamChapterYearStat_counts_check"
  CHECK (
    "questions" >= 0
    AND "subjectQuestions" > 0
    AND "questions" <= "subjectQuestions"
    AND "papersInYear" > 0
    AND "weightagePct" >= 0 AND "weightagePct" <= 100
  );
