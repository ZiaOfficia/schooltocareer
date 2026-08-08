-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ARTICLE', 'NEWS', 'NOTE', 'SYLLABUS', 'GUIDE', 'STATIC_PAGE');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('BOARD', 'BOARD_CLASS', 'BOARD_CLASS_SUBJECT', 'CHAPTER', 'SUBJECT', 'EXAM', 'EXAM_YEAR', 'QUESTION_PAPER', 'RESULT', 'CONTENT_ENTRY', 'CATEGORY', 'COLLEGE', 'COURSE', 'CAREER', 'SCHOLARSHIP', 'JOB', 'MEDIA_ASSET');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'HI');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('SCHOOL', 'CERTIFICATE', 'DIPLOMA', 'UNDERGRADUATE', 'POSTGRADUATE', 'DOCTORATE');

-- CreateEnum
CREATE TYPE "BoardType" AS ENUM ('CENTRAL', 'STATE', 'INTERNATIONAL', 'OPEN_SCHOOLING');

-- CreateEnum
CREATE TYPE "SchoolStage" AS ENUM ('PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY');

-- CreateEnum
CREATE TYPE "StreamType" AS ENUM ('SCIENCE', 'COMMERCE', 'ARTS', 'VOCATIONAL');

-- CreateEnum
CREATE TYPE "ExamLevel" AS ENUM ('NATIONAL', 'STATE', 'UNIVERSITY', 'BOARD', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "ExamMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ExamFrequency" AS ENUM ('ANNUAL', 'BIANNUAL', 'QUARTERLY', 'MULTIPLE_SESSIONS', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "ExamEventType" AS ENUM ('NOTIFICATION', 'APPLICATION_START', 'APPLICATION_END', 'CORRECTION_WINDOW', 'ADMIT_CARD', 'EXAM_DATE', 'ANSWER_KEY', 'RESULT', 'COUNSELLING');

-- CreateEnum
CREATE TYPE "PaperType" AS ENUM ('PREVIOUS_YEAR', 'SAMPLE', 'MODEL', 'MOCK', 'PRACTICE');

-- CreateEnum
CREATE TYPE "PaperFileRole" AS ENUM ('PAPER', 'SOLUTION', 'ANSWER_KEY');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('EXAM', 'BOARD', 'MERIT_LIST', 'SCORECARD');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'PDF', 'DOCUMENT', 'VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'AUTHOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "RevisionType" AS ENUM ('MANUAL', 'PUBLISHED', 'ROLLBACK', 'IMPORT');

-- CreateEnum
CREATE TYPE "SlugChangeReason" AS ENUM ('MANUAL_RENAME', 'NORMALIZATION', 'MERGE', 'SOFT_DELETE', 'RESTORE', 'IMPORT_CORRECTION');

-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('SEARCH_UPSERT', 'SEARCH_DELETE', 'CACHE_REVALIDATE', 'SITEMAP_PING');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "bio" TEXT,
    "designation" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'AUTHOR',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentEntry" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "excerpt" TEXT,
    "bodyHtml" TEXT,
    "bodyJson" JSONB,
    "attributes" JSONB,
    "readingMinutes" INTEGER,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT,
    "featuredImageId" TEXT,
    "publishedRevisionId" BIGINT,
    "examId" TEXT,
    "boardId" TEXT,
    "boardClassSubjectId" TEXT,
    "chapterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "heading" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "question" TEXT NOT NULL,
    "answerHtml" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "inSchema" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" BIGSERIAL NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "revisionType" "RevisionType" NOT NULL,
    "status" "PublishStatus" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedFields" TEXT[],
    "changeNote" TEXT,
    "rollbackOfVersion" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "region" TEXT,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "type" "BoardType" NOT NULL,
    "stateId" TEXT,
    "establishedYear" INTEGER,
    "headquarters" TEXT,
    "officialWebsite" TEXT,
    "logoId" TEXT,
    "description" TEXT,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "stage" "SchoolStage" NOT NULL,

    CONSTRAINT "ClassLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardClass" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "classLevelId" TEXT NOT NULL,
    "stream" "StreamType",
    "slug" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BoardClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "educationLevel" "EducationLevel" NOT NULL,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardClassSubject" (
    "id" TEXT NOT NULL,
    "boardClassId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BoardClassSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "boardClassSubjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "fullName" TEXT,
    "conductingBody" TEXT NOT NULL,
    "categoryId" TEXT,
    "boardId" TEXT,
    "level" "ExamLevel" NOT NULL,
    "mode" "ExamMode" NOT NULL,
    "frequency" "ExamFrequency" NOT NULL,
    "educationLevel" "EducationLevel" NOT NULL,
    "officialWebsite" TEXT,
    "logoId" TEXT,
    "overview" TEXT,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamYear" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sessionName" TEXT,
    "slug" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "applicationFee" JSONB,
    "notificationUrl" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExamYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamEvent" (
    "id" TEXT NOT NULL,
    "examYearId" TEXT NOT NULL,
    "type" "ExamEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isTentative" BOOLEAN NOT NULL DEFAULT false,
    "officialUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionPaper" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "paperType" "PaperType" NOT NULL,
    "year" INTEGER NOT NULL,
    "shift" TEXT,
    "setCode" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "examId" TEXT,
    "boardId" TEXT,
    "boardClassId" TEXT,
    "subjectId" TEXT,
    "totalQuestions" INTEGER,
    "totalMarks" INTEGER,
    "durationMin" INTEGER,
    "hasSolution" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionPaperFile" (
    "id" TEXT NOT NULL,
    "questionPaperId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "fileRole" "PaperFileRole" NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "changeNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "QuestionPaperFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "resultType" "ResultType" NOT NULL,
    "year" INTEGER NOT NULL,
    "examId" TEXT,
    "examYearId" TEXT,
    "boardId" TEXT,
    "boardClassId" TEXT,
    "isDeclared" BOOLEAN NOT NULL DEFAULT false,
    "declaredAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "officialUrl" TEXT,
    "links" JSONB,
    "statistics" JSONB,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'cloudinary',
    "publicId" TEXT NOT NULL,
    "version" TEXT,
    "secureUrl" TEXT NOT NULL,
    "folderPath" TEXT,
    "type" "MediaType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "format" TEXT,
    "bytes" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" DOUBLE PRECISION,
    "pageCount" INTEGER,
    "focalX" DOUBLE PRECISION DEFAULT 0.5,
    "focalY" DOUBLE PRECISION DEFAULT 0.5,
    "blurDataUrl" TEXT,
    "dominantColor" TEXT,
    "hasAlpha" BOOLEAN,
    "variants" JSONB,
    "originalFilename" TEXT,
    "checksum" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "credit" TEXT,
    "isDecorative" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "defaultLocale" "Locale" NOT NULL DEFAULT 'EN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "adsenseClient" TEXT,
    "gaMeasurementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" BIGSERIAL NOT NULL,
    "eventType" "OutboxEventType" NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoMeta" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ownerType" "OwnerType",
    "ownerId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "keywords" TEXT[],
    "canonicalUrl" TEXT,
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageId" TEXT,
    "twitterCard" TEXT DEFAULT 'summary_large_image',
    "schemaOverride" JSONB,
    "sitemapPriority" DOUBLE PRECISION DEFAULT 0.5,
    "changeFrequency" TEXT DEFAULT 'weekly',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SeoMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlugHistory" (
    "id" TEXT NOT NULL,
    "entityType" "OwnerType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "newSlug" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "redirectType" INTEGER NOT NULL DEFAULT 301,
    "reason" "SlugChangeReason" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchDocument" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "keywords" TEXT[],
    "entityLabel" TEXT NOT NULL,
    "imageUrl" TEXT,
    "facets" JSONB,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "boost" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceHash" TEXT,
    "searchVector" tsvector,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQueryLog" (
    "id" BIGSERIAL NOT NULL,
    "rawQuery" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "resultCount" INTEGER NOT NULL,
    "clickedPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "ContentEntry_siteId_status_publishedAt_idx" ON "ContentEntry"("siteId", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "ContentEntry_siteId_type_status_publishedAt_idx" ON "ContentEntry"("siteId", "type", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "ContentEntry_categoryId_status_publishedAt_idx" ON "ContentEntry"("categoryId", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "ContentEntry_examId_type_status_idx" ON "ContentEntry"("examId", "type", "status");

-- CreateIndex
CREATE INDEX "ContentEntry_boardClassSubjectId_type_status_idx" ON "ContentEntry"("boardClassSubjectId", "type", "status");

-- CreateIndex
CREATE INDEX "ContentEntry_chapterId_type_status_idx" ON "ContentEntry"("chapterId", "type", "status");

-- CreateIndex
CREATE INDEX "ContentEntry_authorId_status_idx" ON "ContentEntry"("authorId", "status");

-- CreateIndex
CREATE INDEX "ContentEntry_isFeatured_status_publishedAt_idx" ON "ContentEntry"("isFeatured", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "ContentEntry_deletedAt_idx" ON "ContentEntry"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEntry_siteId_path_key" ON "ContentEntry"("siteId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEntry_siteId_type_slug_locale_key" ON "ContentEntry"("siteId", "type", "slug", "locale");

-- CreateIndex
CREATE INDEX "Category_siteId_type_order_idx" ON "Category"("siteId", "type", "order");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_siteId_slug_key" ON "Category"("siteId", "slug");

-- CreateIndex
CREATE INDEX "PageSection_ownerType_ownerId_locale_order_idx" ON "PageSection"("ownerType", "ownerId", "locale", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PageSection_siteId_ownerType_ownerId_key_locale_key" ON "PageSection"("siteId", "ownerType", "ownerId", "key", "locale");

-- CreateIndex
CREATE INDEX "FaqItem_ownerType_ownerId_locale_order_idx" ON "FaqItem"("ownerType", "ownerId", "locale", "order");

-- CreateIndex
CREATE INDEX "FaqItem_siteId_inSchema_idx" ON "FaqItem"("siteId", "inSchema");

-- CreateIndex
CREATE INDEX "ContentDraft_savedAt_idx" ON "ContentDraft"("savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentDraft_ownerType_ownerId_authorId_key" ON "ContentDraft"("ownerType", "ownerId", "authorId");

-- CreateIndex
CREATE INDEX "ContentRevision_ownerType_ownerId_createdAt_idx" ON "ContentRevision"("ownerType", "ownerId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevision_ownerType_ownerId_version_key" ON "ContentRevision"("ownerType", "ownerId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");

-- CreateIndex
CREATE UNIQUE INDEX "State_slug_key" ON "State"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "State_code_key" ON "State"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Board_slug_key" ON "Board"("slug");

-- CreateIndex
CREATE INDEX "Board_status_deletedAt_idx" ON "Board"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Board_stateId_type_status_idx" ON "Board"("stateId", "type", "status");

-- CreateIndex
CREATE INDEX "Board_popularityScore_idx" ON "Board"("popularityScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ClassLevel_name_key" ON "ClassLevel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLevel_slug_key" ON "ClassLevel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLevel_order_key" ON "ClassLevel"("order");

-- CreateIndex
CREATE INDEX "BoardClass_status_deletedAt_idx" ON "BoardClass"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "BoardClass_classLevelId_idx" ON "BoardClass"("classLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardClass_boardId_slug_key" ON "BoardClass"("boardId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE INDEX "Subject_educationLevel_deletedAt_idx" ON "Subject"("educationLevel", "deletedAt");

-- CreateIndex
CREATE INDEX "BoardClassSubject_subjectId_idx" ON "BoardClassSubject"("subjectId");

-- CreateIndex
CREATE INDEX "BoardClassSubject_status_deletedAt_idx" ON "BoardClassSubject"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BoardClassSubject_boardClassId_subjectId_key" ON "BoardClassSubject"("boardClassId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardClassSubject_boardClassId_slug_key" ON "BoardClassSubject"("boardClassId", "slug");

-- CreateIndex
CREATE INDEX "Chapter_boardClassSubjectId_order_idx" ON "Chapter"("boardClassSubjectId", "order");

-- CreateIndex
CREATE INDEX "Chapter_status_deletedAt_idx" ON "Chapter"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_boardClassSubjectId_slug_key" ON "Chapter"("boardClassSubjectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCategory_slug_key" ON "ExamCategory"("slug");

-- CreateIndex
CREATE INDEX "ExamCategory_parentId_order_idx" ON "ExamCategory"("parentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_slug_key" ON "Exam"("slug");

-- CreateIndex
CREATE INDEX "Exam_status_deletedAt_idx" ON "Exam"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Exam_categoryId_status_popularityScore_idx" ON "Exam"("categoryId", "status", "popularityScore" DESC);

-- CreateIndex
CREATE INDEX "Exam_level_educationLevel_status_idx" ON "Exam"("level", "educationLevel", "status");

-- CreateIndex
CREATE INDEX "Exam_boardId_status_idx" ON "Exam"("boardId", "status");

-- CreateIndex
CREATE INDEX "Exam_popularityScore_idx" ON "Exam"("popularityScore" DESC);

-- CreateIndex
CREATE INDEX "ExamYear_examId_year_idx" ON "ExamYear"("examId", "year" DESC);

-- CreateIndex
CREATE INDEX "ExamYear_year_isCurrent_idx" ON "ExamYear"("year" DESC, "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "ExamYear_examId_slug_key" ON "ExamYear"("examId", "slug");

-- CreateIndex
CREATE INDEX "ExamEvent_examYearId_startDate_idx" ON "ExamEvent"("examYearId", "startDate");

-- CreateIndex
CREATE INDEX "ExamEvent_type_startDate_idx" ON "ExamEvent"("type", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPaper_slug_key" ON "QuestionPaper"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPaper_dedupeKey_key" ON "QuestionPaper"("dedupeKey");

-- CreateIndex
CREATE INDEX "QuestionPaper_examId_year_status_idx" ON "QuestionPaper"("examId", "year" DESC, "status");

-- CreateIndex
CREATE INDEX "QuestionPaper_boardClassId_subjectId_year_idx" ON "QuestionPaper"("boardClassId", "subjectId", "year" DESC);

-- CreateIndex
CREATE INDEX "QuestionPaper_paperType_status_year_idx" ON "QuestionPaper"("paperType", "status", "year" DESC);

-- CreateIndex
CREATE INDEX "QuestionPaper_status_publishedAt_idx" ON "QuestionPaper"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "QuestionPaper_downloadCount_idx" ON "QuestionPaper"("downloadCount" DESC);

-- CreateIndex
CREATE INDEX "QuestionPaperFile_questionPaperId_fileRole_isCurrent_idx" ON "QuestionPaperFile"("questionPaperId", "fileRole", "isCurrent");

-- CreateIndex
CREATE INDEX "QuestionPaperFile_mediaId_idx" ON "QuestionPaperFile"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPaperFile_questionPaperId_fileRole_locale_version_key" ON "QuestionPaperFile"("questionPaperId", "fileRole", "locale", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Result_slug_key" ON "Result"("slug");

-- CreateIndex
CREATE INDEX "Result_year_isDeclared_status_idx" ON "Result"("year" DESC, "isDeclared", "status");

-- CreateIndex
CREATE INDEX "Result_examId_year_idx" ON "Result"("examId", "year" DESC);

-- CreateIndex
CREATE INDEX "Result_boardId_year_idx" ON "Result"("boardId", "year" DESC);

-- CreateIndex
CREATE INDEX "Result_status_declaredAt_idx" ON "Result"("status", "declaredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_publicId_key" ON "MediaAsset"("publicId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_createdAt_idx" ON "MediaAsset"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MediaAsset_folderPath_type_idx" ON "MediaAsset"("folderPath", "type");

-- CreateIndex
CREATE INDEX "MediaAsset_mimeType_idx" ON "MediaAsset"("mimeType");

-- CreateIndex
CREATE INDEX "MediaAsset_usageCount_idx" ON "MediaAsset"("usageCount");

-- CreateIndex
CREATE INDEX "MediaAsset_deletedAt_idx" ON "MediaAsset"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Site_key_key" ON "Site"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Site_domain_key" ON "Site"("domain");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_ownerType_ownerId_eventType_idx" ON "OutboxEvent"("ownerType", "ownerId", "eventType");

-- CreateIndex
CREATE INDEX "SeoMeta_ownerType_ownerId_idx" ON "SeoMeta"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "SeoMeta_siteId_robotsIndex_sitemapPriority_idx" ON "SeoMeta"("siteId", "robotsIndex", "sitemapPriority" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SeoMeta_siteId_path_key" ON "SeoMeta"("siteId", "path");

-- CreateIndex
CREATE INDEX "SlugHistory_entityType_entityId_createdAt_idx" ON "SlugHistory"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SlugHistory_isActive_idx" ON "SlugHistory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SlugHistory_entityType_oldSlug_locale_key" ON "SlugHistory"("entityType", "oldSlug", "locale");

-- CreateIndex
CREATE INDEX "Redirect_siteId_isActive_idx" ON "Redirect"("siteId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_siteId_fromPath_key" ON "Redirect"("siteId", "fromPath");

-- CreateIndex
CREATE INDEX "SearchDocument_siteId_path_idx" ON "SearchDocument"("siteId", "path");

-- CreateIndex
CREATE INDEX "SearchDocument_isActive_entityLabel_popularity_idx" ON "SearchDocument"("isActive", "entityLabel", "popularity" DESC);

-- CreateIndex
CREATE INDEX "SearchDocument_locale_isActive_idx" ON "SearchDocument"("locale", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDocument_siteId_ownerType_ownerId_locale_key" ON "SearchDocument"("siteId", "ownerType", "ownerId", "locale");

-- CreateIndex
CREATE INDEX "SearchQueryLog_normalizedQuery_createdAt_idx" ON "SearchQueryLog"("normalizedQuery", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SearchQueryLog_resultCount_createdAt_idx" ON "SearchQueryLog"("resultCount", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_featuredImageId_fkey" FOREIGN KEY ("featuredImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "ContentRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_boardClassSubjectId_fkey" FOREIGN KEY ("boardClassSubjectId") REFERENCES "BoardClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntry" ADD CONSTRAINT "ContentEntry_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardClass" ADD CONSTRAINT "BoardClass_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardClass" ADD CONSTRAINT "BoardClass_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardClassSubject" ADD CONSTRAINT "BoardClassSubject_boardClassId_fkey" FOREIGN KEY ("boardClassId") REFERENCES "BoardClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardClassSubject" ADD CONSTRAINT "BoardClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_boardClassSubjectId_fkey" FOREIGN KEY ("boardClassSubjectId") REFERENCES "BoardClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamCategory" ADD CONSTRAINT "ExamCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExamCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExamCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamYear" ADD CONSTRAINT "ExamYear_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_boardClassId_fkey" FOREIGN KEY ("boardClassId") REFERENCES "BoardClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaperFile" ADD CONSTRAINT "QuestionPaperFile_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "QuestionPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaperFile" ADD CONSTRAINT "QuestionPaperFile_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_boardClassId_fkey" FOREIGN KEY ("boardClassId") REFERENCES "BoardClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoMeta" ADD CONSTRAINT "SeoMeta_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoMeta" ADD CONSTRAINT "SeoMeta_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDocument" ADD CONSTRAINT "SearchDocument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
