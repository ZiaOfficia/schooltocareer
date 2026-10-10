/**
 * Mirrors of the Prisma enums as plain literal unions.
 *
 * WHY NOT import them from @stc/database?
 * This package must be importable from edge middleware, workers, the Next.js
 * client bundle and the admin app. Importing the generated Prisma client to
 * get a string union would drag the query engine into all of them.
 *
 * Parity with prisma/schema/schema.prisma is verified in CI by
 * tooling/scripts/check-enum-parity.ts — if you add a value there, add it here
 * or the build fails.
 */

export const PUBLISH_STATUS = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type PublishStatus = (typeof PUBLISH_STATUS)[number];

export const CONTENT_TYPE = [
  'ARTICLE',
  'NEWS',
  'NOTE',
  'SYLLABUS',
  'GUIDE',
  'STATIC_PAGE',
] as const;
export type ContentType = (typeof CONTENT_TYPE)[number];

export const OWNER_TYPE = [
  'BOARD',
  'BOARD_CLASS',
  'BOARD_CLASS_SUBJECT',
  'CHAPTER',
  'SUBJECT',
  'EXAM',
  'EXAM_YEAR',
  'QUESTION_PAPER',
  'RESULT',
  'CONTENT_ENTRY',
  'CATEGORY',
  'COLLEGE',
  'COURSE',
  'CAREER',
  'SCHOLARSHIP',
  'JOB',
  'MEDIA_ASSET',
  'QUESTION',
  'EXAM_CHAPTER',
] as const;
export type OwnerType = (typeof OWNER_TYPE)[number];

export const LOCALE = ['EN', 'HI'] as const;
export type Locale = (typeof LOCALE)[number];

export const EDUCATION_LEVEL = [
  'SCHOOL',
  'CERTIFICATE',
  'DIPLOMA',
  'UNDERGRADUATE',
  'POSTGRADUATE',
  'DOCTORATE',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVEL)[number];

export const BOARD_TYPE = ['CENTRAL', 'STATE', 'INTERNATIONAL', 'OPEN_SCHOOLING'] as const;
export type BoardType = (typeof BOARD_TYPE)[number];

export const SCHOOL_STAGE = ['PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'] as const;
export type SchoolStage = (typeof SCHOOL_STAGE)[number];

export const STREAM_TYPE = ['SCIENCE', 'COMMERCE', 'ARTS', 'VOCATIONAL'] as const;
export type StreamType = (typeof STREAM_TYPE)[number];

export const EXAM_LEVEL = [
  'NATIONAL',
  'STATE',
  'UNIVERSITY',
  'BOARD',
  'INTERNATIONAL',
] as const;
export type ExamLevel = (typeof EXAM_LEVEL)[number];

export const EXAM_MODE = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;
export type ExamMode = (typeof EXAM_MODE)[number];

export const EXAM_FREQUENCY = [
  'ANNUAL',
  'BIANNUAL',
  'QUARTERLY',
  'MULTIPLE_SESSIONS',
  'ONE_TIME',
] as const;
export type ExamFrequency = (typeof EXAM_FREQUENCY)[number];

export const EXAM_EVENT_TYPE = [
  'NOTIFICATION',
  'APPLICATION_START',
  'APPLICATION_END',
  'CORRECTION_WINDOW',
  'ADMIT_CARD',
  'EXAM_DATE',
  'ANSWER_KEY',
  'RESULT',
  'COUNSELLING',
] as const;
export type ExamEventType = (typeof EXAM_EVENT_TYPE)[number];

export const PAPER_TYPE = ['PREVIOUS_YEAR', 'SAMPLE', 'MODEL', 'MOCK', 'PRACTICE'] as const;
export type PaperType = (typeof PAPER_TYPE)[number];

export const PAPER_FILE_ROLE = ['PAPER', 'SOLUTION', 'ANSWER_KEY'] as const;
export type PaperFileRole = (typeof PAPER_FILE_ROLE)[number];

export const RESULT_TYPE = ['EXAM', 'BOARD', 'MERIT_LIST', 'SCORECARD'] as const;
export type ResultType = (typeof RESULT_TYPE)[number];

export const MEDIA_TYPE = ['IMAGE', 'PDF', 'DOCUMENT', 'VIDEO', 'OTHER'] as const;
export type MediaType = (typeof MEDIA_TYPE)[number];

export const USER_ROLE = ['ADMIN', 'EDITOR', 'AUTHOR'] as const;
export type UserRole = (typeof USER_ROLE)[number];

export const USER_STATUS = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const REVISION_TYPE = ['MANUAL', 'PUBLISHED', 'ROLLBACK', 'IMPORT'] as const;
export type RevisionType = (typeof REVISION_TYPE)[number];

export const SLUG_CHANGE_REASON = [
  'MANUAL_RENAME',
  'NORMALIZATION',
  'MERGE',
  'SOFT_DELETE',
  'RESTORE',
  'IMPORT_CORRECTION',
] as const;
export type SlugChangeReason = (typeof SLUG_CHANGE_REASON)[number];

export const OUTBOX_EVENT_TYPE = [
  'SEARCH_UPSERT',
  'SEARCH_DELETE',
  'CACHE_REVALIDATE',
  'SITEMAP_PING',
] as const;
export type OutboxEventType = (typeof OUTBOX_EVENT_TYPE)[number];

export const OUTBOX_STATUS = ['PENDING', 'PROCESSING', 'DONE', 'FAILED', 'DEAD'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUS)[number];

// ── Semantic facts ──────────────────────────────────────────────────────────
// Mirrors of the enums in packages/database/prisma/schema/facts.prisma.
// Restated here for the same reason as every other enum in this file: the
// validation package and the admin UI must not import Prisma to know what a
// valid fact type is.

export const FACT_TYPE = [
  'EXAM_DATE',
  'APPLICATION_START',
  'APPLICATION_END',
  'RESULT_DATE',
  'OFFICIAL_APPLICATION_URL',
  'OFFICIAL_RESULT_URL',
] as const;
export type FactType = (typeof FACT_TYPE)[number];

/** Extraction certainty. Says nothing about how much the value matters. */
export const FACT_CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type FactConfidence = (typeof FACT_CONFIDENCE)[number];

/** Publication impact. Fixed per fact type, independent of confidence. */
export const FACT_RISK = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type FactRisk = (typeof FACT_RISK)[number];

export const FACT_CHANGE_KIND = ['ADDED', 'CHANGED', 'REMOVED'] as const;
export type FactChangeKind = (typeof FACT_CHANGE_KIND)[number];

export const FACT_REVIEW_STATUS = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'IGNORED',
  'SUPERSEDED',
] as const;
export type FactReviewStatus = (typeof FACT_REVIEW_STATUS)[number];

// ── Question bank ───────────────────────────────────────────────────────────
// Mirrors of the enums in packages/database/prisma/schema/questions.prisma.

export const QUESTION_TYPE = ['MCQ_SINGLE', 'MCQ_MULTI', 'NUMERICAL'] as const;
export type QuestionType = (typeof QUESTION_TYPE)[number];

/** Where a shown answer comes from. Never OFFICIAL_* without an official key. */
export const ANSWER_PROVENANCE = [
  'OFFICIAL_FINAL',
  'OFFICIAL_PROVISIONAL',
  'EDITORIAL',
  'DROPPED',
] as const;
export type AnswerProvenance = (typeof ANSWER_PROVENANCE)[number];

export const SYLLABUS_STATUS = ['IN_SYLLABUS', 'REDUCED', 'REMOVED'] as const;
export type SyllabusStatus = (typeof SYLLABUS_STATUS)[number];

export const QUESTION_DIFFICULTY = ['EASY', 'MEDIUM', 'HARD'] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTY)[number];

export const QUESTION_REPORT_KIND = [
  'WRONG_ANSWER',
  'SOLUTION_ERROR',
  'TYPO',
  'MISSING_FIGURE',
  'OTHER',
] as const;
export type QuestionReportKind = (typeof QUESTION_REPORT_KIND)[number];

export const QUESTION_REPORT_STATUS = ['OPEN', 'FIXED', 'REJECTED'] as const;
export type QuestionReportStatus = (typeof QUESTION_REPORT_STATUS)[number];
