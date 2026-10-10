# SCHOOLTOCAREER — DETAILED IMPLEMENTATION PLAN (Phase 0 → End State)

**Project**: SchoolToCareer — India-focused education information platform  
**Current Date**: September 3, 2026  
**Verified**: YES (architecture, database, API, worker, deployment)  
**Plan Authority**: Refined Master Implementation Prompt + Codebase Audit

---

## EXECUTIVE SUMMARY

**Goal**: Transform SchoolToCareer from "backend complete, frontend started" into a production-grade information platform with:
- ✅ Official source monitoring + fact intelligence
- ✅ Reliable document/paper ingestion
- ✅ Reusable page generation from structured data
- ✅ Student-focused search + discovery
- ✅ Verified, traced provenance for all facts

**Current State**:
- ✅ PostgreSQL 18.4 with 30 models (complete)
- ✅ Express API with 96 endpoints (complete)
- ✅ Worker + outbox pattern (complete)
- ✅ Source Watch infrastructure (complete, fetch-sources task runs)
- ✅ Frontend: 2/18 templates built (home, exam hub)
- ✅ Routes defined for all major page types
- ✅ Deployment: Render (Singapore), separate worker service

**Missing**:
- ❌ Fact extraction layer (OfficialFact, FactChange models)
- ❌ Editorial review workflow
- ❌ Paper importer logic
- ❌ Universal browse renderer
- ❌ Paper detail + browse pages
- ❌ Exam sub-page templates (7 types × 100+ exams)
- ❌ Board ecosystem pages
- ❌ Admin interface
- ❌ Search/analytics instrumentation (partial)

**Timeline Estimate**:
- Phase 0 (audit): 3-5 days
- Phase 1 (observability): 5-7 days
- Phase 2 (facts): 10-14 days
- Phase 3 (papers): 7-10 days
- Phase 4-6 (templates): 20-30 days
- **Total**: 45-65 days for core system (6-9 weeks)

---

# PHASE 0 — CODEBASE AUDIT (DO THIS FIRST)

**Duration**: 3-5 days  
**Output**: Gap matrix + implementation inventory  
**Principle**: "INSPECT → VERIFY → EXTEND" not "ASSUME → REBUILD"

## 0.1 Database Inventory

### Existing Models
Inspect `packages/database/prisma/schema/`:

**ingestion.prisma**:
- ✅ Source (URL, cadence, robots check, ETag, status)
- ✅ SourceSnapshot (fetch outcome, content hash, raw content, error tracking)
- ✅ FetchOutcome enum (CHANGED, UNCHANGED, NOT_MODIFIED, HTTP_ERROR, NETWORK_ERROR, BLOCKED_BY_ROBOTS)

**exam.prisma**:
- ✅ Exam (name, conducting body, official website, popularity)
- ✅ ExamYear (year, session, isCurrent)
- ✅ ExamEvent (type, startDate, endDate, isTentative, officialUrl)
- ✅ QuestionPaper (year, subject, paper, shift, session, locale, examId, boardId)
- ✅ Result (year, status, officialUrl)

**education.prisma**:
- ✅ Board (name, abbreviation)
- ✅ BoardClass (board, class, stream)
- ✅ Subject (name, code)
- ✅ Chapter (subject, chapter, content)

**content.prisma**:
- ✅ ContentEntry (polymorphic for articles, news, guides, syllabi)
- ✅ ContentDraft (status: DRAFT, PUBLISHED, ARCHIVED)
- ✅ ContentRevision (versioning)
- ✅ Category (editorial content organization)
- ✅ SlugHistory (redirects for SEO)

**seo.prisma**:
- ✅ SearchDocument (full-text with tsvector, Devanagari)

**platform.prisma**:
- ✅ Site (single tenant config)
- ✅ Outbox (event delivery, FOR UPDATE SKIP LOCKED)
- ✅ PublishStatus enum

### Missing Models (to add in Phase 2)
- ❌ OfficialFact (extracted from SourceSnapshot)
- ❌ FactChange (old/new values, risk level, review status)
- ❌ Approval (editor review record)

### Assessment
**Status**: ✅ COMPREHENSIVE — Most required data structures exist  
**Action**: NO database redesign needed. Extend with fact layer in Phase 2.

---

## 0.2 API Backend Inventory

### Routes (ROUTES constant)

**Exam routes** — All defined ✅:
```
/exams
/exams/[category]
/exam/[slug]
/exam/[slug]/syllabus
/exam/[slug]/exam-pattern
/exam/[slug]/eligibility
/exam/[slug]/application-form
/exam/[slug]/admit-card
/exam/[slug]/answer-key
/exam/[slug]/result
/exam/[slug]/previous-year-papers
/exam/[slug]/previous-year-papers/[year]
```

**Board routes** — All defined ✅:
```
/boards
/board/[slug]
/board/[b]/[class]
/board/[b]/[class]/syllabus
/board/[b]/[class]/previous-year-papers
/board/[b]/[class]/[subject]
/board/[b]/[class]/[subject]/[chapter]
```

**Paper/Result/Blog routes** — All defined ✅:
```
/previous-year-papers
/previous-year-papers/[slug]
/results
/results/[slug]
/blog
/blog/[category]
/blog/[category]/[slug]
/search
```

### API Modules (8 feature modules)

Inspect `apps/api/src/modules/`:

1. **board** — boards, classes, subjects, chapters ✅
2. **exam** — exams, years, events ✅
3. **question-paper** — papers, metadata ✅
4. **result** — results, declarations ✅
5. **category** — editorial hierarchy ✅
6. **blog** — articles, news ✅
7. **media** — Cloudinary integration ✅
8. **search** — full-text, faceting ✅

Each module has:
- ✅ Repository (database access)
- ✅ Service (business logic)
- ✅ DTO (data shape)
- ✅ Controller/routes

### Dependency Injection

Inspect `apps/api/src/container.ts`:
- ✅ PrismaClient
- ✅ All repositories registered
- ✅ All services registered
- ✅ EventDispatcher
- ✅ SearchSourceRegistry
- ✅ All search sources (Exam, Blog, Result, QuestionPaper, Board)
- ✅ CacheProvider (memory-based)
- ✅ QueueProvider (outbox-based)
- ✅ Worker + handlers

### Assessment
**Status**: ✅ COMPREHENSIVE — 96 endpoints, fully implemented  
**Action**: Extend with fact-related endpoints in Phase 2.

---

## 0.3 Worker + Outbox Inventory

Inspect `apps/api/src/workers/`:

### OutboxWorker
- ✅ Processes outbox events
- ✅ Retries with backoff
- ✅ Idempotent processing

### Event Handlers
- ✅ AuditHandler
- ✅ CacheInvalidationHandler
- ✅ SearchIndexHandler
- ✅ SitemapPingHandler
- ✅ IndexNowHandler
- ✅ CacheRevalidateHandler
- ✅ SearchUpsertHandler
- ✅ SearchDeleteHandler

### Periodic Tasks
- ✅ fetch-sources (Source monitoring — ALREADY IMPLEMENTED)
- ✅ reconcile-media
- ✅ publish-scheduled
- ✅ Periodic task runner with cron

### Source Fetching Task

Inspect `apps/api/src/workers/tasks/fetch-sources.task.ts`:

**Already implemented**:
- ✅ robots.txt checking
- ✅ Content normalization (removes scripts, comments, timestamps)
- ✅ SHA-256 hashing
- ✅ Conditional requests (ETag, Last-Modified)
- ✅ Polite rate limiting (1.5s between requests)
- ✅ Proper User-Agent
- ✅ Error tracking
- ✅ Batch processing (25 at a time)

### Assessment
**Status**: ✅ COMPLETE — Worker infrastructure solid  
**Action**: Add new tasks for fact extraction + paper import in Phase 2-3.

---

## 0.4 Frontend Inventory

Inspect `apps/web/src/`:

### Routes Built
- ✅ `/` (home page)
- ✅ `/exams` (exam hub)
- ✅ `/search` (search — designed but UI minimal)

### Routes NOT YET BUILT (18 templates remaining)
- ❌ Exam sub-pages (7 templates)
- ❌ Paper detail/browse (2 templates)
- ❌ Board ecosystem (5 templates)
- ❌ Results (1 template)
- ❌ Blog/articles (2 templates)
- ❌ Index pages (exams hub variants)
- ❌ Static pages (about, contact, privacy, terms, disclaimer)
- ❌ Admin interface

### Components (`packages/ui/src/`)
- ✅ EntityBadge (exam, result, paper, article, board, syllabus)
- ✅ StatusStamp (urgent, ok, wait, quiet states)
- ✅ Section, Wrap, Eyebrow, FactGrid, ScrollX
- ✅ Accessibility-first design (color-blind safe)

### Design System
Inspect `apps/web/src/app/globals.css`:
- ✅ @theme tokens (colors, fonts, radius)
- ✅ Dark mode (prefers-color-scheme + data-theme override)
- ✅ Light/dark color schemes
- ✅ Typography (Georgia/Noto Serif for display, system-ui for sans, monospace for data)

### SEO Infrastructure
- ✅ buildMetadata utility
- ✅ JsonLd schema generation
- ✅ organizationSchema + websiteSchema
- ✅ buildSiteConfig (url vs canonicalOrigin separation)
- ✅ isIndexableDeployment check
- ✅ robots.txt generation
- ✅ sitemap generation

### Assessment
**Status**: ⚠️ FOUNDATION COMPLETE, TEMPLATES MISSING  
**Action**: Build universal browse renderer (Phase 4), then templates (Phase 5-9).

---

## 0.5 Deployment Inventory

Inspect `render.yaml` + `packages/config/`:

### API Service (stc-api)
- ✅ Runtime: Node
- ✅ Region: Singapore
- ✅ Health check: /health
- ✅ Environment: production
- ✅ Build: pnpm install + Prisma generate + build
- ✅ Start: node apps/api/dist/server.js

### Worker Service (stc-worker)
- ✅ Separate service (not co-located with API)
- ✅ Same region: Singapore
- ✅ Build: identical
- ✅ Start: node apps/api/dist/workers/worker.js
- ✅ Independent crash boundaries

### Environment Variables
- ✅ DATABASE_URL (pooled via PgBouncer)
- ✅ DIRECT_DATABASE_URL (unpooled for migrations)
- ✅ JWT secrets
- ✅ Cloudinary config (optional)
- ✅ IndexNow key (optional)

### Deployment Architecture
- ✅ Frontend: Vercel (auto-detects pnpm + Turbo)
- ✅ Backend: Render Singapore
- ✅ Database: Neon PostgreSQL, Singapore region
- ✅ CDN: Cloudinary for images

### Assessment
**Status**: ✅ SOLID — Two services, regional optimization  
**Action**: Verify canonical domain behavior in Phase 1.

---

## 0.6 Gap Matrix

| Component | Exists | State | Action |
|-----------|--------|-------|--------|
| **Database** | YES | Complete | EXTEND with fact models |
| Source models | YES | Complete | REUSE |
| SourceSnapshot | YES | Complete | REUSE |
| Outbox | YES | Complete | REUSE |
| Exam/Paper/Board | YES | Complete | REUSE |
| **API** | YES | Complete | EXTEND with fact endpoints |
| 96 endpoints | YES | Complete | REUSE |
| Repositories | YES | Complete | ADD fact repos |
| Services | YES | Complete | ADD fact services |
| **Worker** | YES | Complete | EXTEND with new tasks |
| OutboxWorker | YES | Complete | REUSE |
| Handlers | YES | Complete | ADD fact handlers |
| fetch-sources | YES | WORKS | EXTEND with parsing |
| **Frontend** | PARTIAL | 2/18 templates | BUILD remaining templates |
| Routes | YES | All defined | IMPLEMENT pages |
| Components | YES | Foundation | REUSE + extend |
| Design system | YES | Complete | REUSE |
| SEO system | YES | Complete | REUSE |
| **Deployment** | YES | Production-ready | VERIFY domain |
| Infrastructure | YES | Complete | MONITOR |

---

## 0.7 Inventory Output

**Deliverable**: Gap matrix document (above)

**Key Findings**:
1. ✅ DO NOT rebuild Source Watch — it exists and works
2. ✅ DO NOT rebuild database — models are comprehensive
3. ✅ DO NOT rebuild worker — infrastructure is sound
4. ❌ DO build fact extraction layer (Phase 2)
5. ❌ DO build paper importer (Phase 3)
6. ❌ DO build frontend templates (Phase 4-9)
7. ✅ DO extend existing services/repositories

**Next Step**: Phase 1 — Production Foundation + Observability

---

# PHASE 1 — PRODUCTION FOUNDATION + OBSERVABILITY (5-7 days)

**Duration**: 5-7 days  
**Blocking**: Cannot proceed to Phase 2 until observability is in place  
**Goal**: Make production behavior measurable before adding content

## 1.1 Canonical Domain Verification

### Current Configuration
Inspect `packages/config/src/site.ts`:
- url: deployment host (localhost, vercel.app, etc.)
- canonicalOrigin: production apex (schooltocareer.in)
- buildSiteConfig() separates these correctly
- isIndexableDeployment() prevents preview indexing

### Required Verification
- [ ] Verify apex domain (schooltocareer.in) resolves
- [ ] Verify www.schooltocareer.in redirects to apex
- [ ] Verify HTTP → HTTPS redirects
- [ ] Verify all canonical URLs use apex
- [ ] Verify sitemap uses apex
- [ ] Verify robots.txt uses apex
- [ ] Verify OpenGraph uses apex
- [ ] Verify structured data uses apex
- [ ] Verify Search Console points to correct canonical

### Action Items
1. Test domain redirects:
   ```bash
   curl -L http://schooltocareer.in
   curl -L http://www.schooltocareer.in
   curl -L https://www.schooltocareer.in
   ```
2. Verify Search Console canonical registration
3. Update apex in SITE.ORIGIN if needed
4. Test preview deployment noindex behavior

## 1.2 Search Console + Robots

### Setup
- [ ] Verify site in Google Search Console
- [ ] Submit sitemap
- [ ] Check index coverage (expecting 21 URLs live)
- [ ] Monitor crawl errors
- [ ] Check for canonical issues
- [ ] Verify robots.txt at /robots.txt
- [ ] Verify noindex on preview deployments

### Robots Configuration
Verify `apps/web/src/app/robots.ts`:
- [ ] Disallow paths for private/admin
- [ ] Allow paths for public content
- [ ] Point to sitemap.xml
- [ ] User-Agent handling

## 1.3 Observability Setup

### Analytics Instrumentation
Add event tracking for:

```
page_view
search_performed
search_zero_result
search_result_clicked
paper_downloaded
official_link_clicked
result_viewed
filter_applied
```

### Implementation
- [ ] Google Analytics 4 setup
- [ ] Event schema definition
- [ ] Client tracking script (or server-side events)
- [ ] Dashboard creation

### Performance Monitoring
Track:
- [ ] Core Web Vitals (LCP, CLS, INP)
- [ ] Page load time
- [ ] API latency
- [ ] Worker task duration
- [ ] Database query time
- [ ] Cache hit/miss ratio

### Error Monitoring
- [ ] 404 errors (what students search for but don't find)
- [ ] 500 errors (API failures)
- [ ] Worker failures (task errors)
- [ ] Search zero-result tracking

### Logs
- [ ] Structured logging in place
- [ ] Pino logger configured
- [ ] Request correlation IDs working
- [ ] Worker task logging

## 1.4 Health Checks

### API Health
- [ ] /health endpoint responding
- [ ] Database connectivity check
- [ ] Worker connectivity check
- [ ] Cloudinary optional check
- [ ] IndexNow optional check

### Worker Health
- [ ] Outbox processing rate
- [ ] Task queue depth
- [ ] Task error rate
- [ ] Task retry rate

## 1.5 Deliverables

**Output**:
1. Domain verification report
2. Search Console configuration
3. Analytics + event tracking implemented
4. Error monitoring dashboard
5. Health check validation
6. Observable production baseline

**Success Criteria**:
- ✅ Canonical domain working
- ✅ Search Console sees 21 live URLs
- ✅ Analytics tracking events
- ✅ Error monitoring active
- ✅ Health checks passing

**Next Step**: Phase 2 — Fact Intelligence Layer

---

# PHASE 2 — FACT INTELLIGENCE LAYER (10-14 days)

**Duration**: 10-14 days  
**Focus**: Fill gap between SourceSnapshot and actionable facts  
**Goal**: Enable editorial workflow around official source changes

## 2.1 Database Design

### Models to Add

**OfficialFact** (extracted from SourceSnapshot):
```prisma
model OfficialFact {
  id            String
  sourceId      String
  snapshotId    String
  examId        String?
  examYearId    String?
  
  factType      FactType  // timeline, eligibility, application, exam, documents
  fieldKey      String    // APPLICATION_START, EXAM_DATE, ELIGIBILITY_AGE, etc.
  value         String    // raw extracted value
  normalizedValue String? // "2026-06-23" for date, "₹2000" normalized
  
  confidence    Int       // 0-100 confidence score
  status        FactStatus // ACTIVE, TENTATIVE, SUPERSEDED, REJECTED
  
  firstObservedAt DateTime
  lastObservedAt DateTime
  verifiedAt    DateTime?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  source SourceSnapshot @relation(fields: [snapshotId], references: [id])
  exam   Exam?          @relation(fields: [examId], references: [id])
  examYear ExamYear?    @relation(fields: [examYearId], references: [id])
  changes FactChange[]
}

enum FactType {
  TIMELINE
  ELIGIBILITY
  APPLICATION
  EXAMINATION
  DOCUMENTS
  OTHER
}

enum FactStatus {
  ACTIVE
  TENTATIVE
  SUPERSEDED
  REJECTED
}
```

**FactChange** (detect what changed):
```prisma
model FactChange {
  id        String
  factId    String
  
  oldValue  String?      // previous normalized value
  newValue  String       // new normalized value
  
  sourceId      String
  snapshotId    String
  
  confidence    Int     // 0-100
  riskLevel     RiskLevel
  
  detectedAt    DateTime @default(now())
  reviewStatus  ReviewStatus @default(DETECTED)
  
  reviewedById  String?
  reviewedAt    DateTime?
  rejectionReason String?
  
  approvedAt    DateTime?
  publishedAt   DateTime?
  
  fact   OfficialFact @relation(fields: [factId], references: [id])
  source Source       @relation(fields: [sourceId], references: [id])
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ReviewStatus {
  DETECTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  SUPERSEDED
}
```

### Migration
- [ ] Create prisma migration
- [ ] Test on PostgreSQL
- [ ] Verify indexes

## 2.2 Fact Normalization

### Implement Normalizers

```typescript
// Normalize dates
normalizeDate("23 June 2026") → "2026-06-23"
normalizeDate("June 23, 2026") → "2026-06-23"
normalizeDate("23/06/2026") → "2026-06-23"

// Normalize currency
normalizeCurrency("₹ 2,000") → "2000"
normalizeCurrency("Rs. 2000") → "2000"

// Normalize URLs
normalizeUrl("https://example.com/path") → canonical form

// Normalize text
normalizeText("ELIGIBILITY") → "eligibility"
```

**Files**:
- `apps/api/src/core/normalization/date.normalizer.ts`
- `apps/api/src/core/normalization/currency.normalizer.ts`
- `apps/api/src/core/normalization/url.normalizer.ts`
- `apps/api/src/core/normalization/text.normalizer.ts`

## 2.3 Fact Extraction Service

### Create FactExtractionService

```typescript
class FactExtractionService {
  async extractFacts(snapshot: SourceSnapshot): Promise<OfficialFact[]>
  
  // For each fact type:
  private extractTimelineFacts()
  private extractEligibilityFacts()
  private extractApplicationFacts()
  private extractExaminationFacts()
  private extractDocumentFacts()
}
```

**Strategy**: 
- Specialized extractors per fact type
- Confidence scoring
- Handles ambiguity (LOW_CONFIDENCE → editor review)
- Preserves original extracted value as evidence

**Files**:
- `apps/api/src/modules/fact/fact-extraction.service.ts`
- `apps/api/src/modules/fact/extractors/timeline.extractor.ts`
- `apps/api/src/modules/fact/extractors/eligibility.extractor.ts`
- etc.

## 2.4 Change Detection

### Create FactChangeDetector

```typescript
class FactChangeDetector {
  async detectChanges(
    oldFacts: OfficialFact[],
    newFacts: OfficialFact[]
  ): Promise<FactChange[]>
  
  // Distinguishes:
  // - Content changed but no semantic change
  // - Semantic change requiring review
  // - Safe automatic update
}
```

**Logic**:
- Compare normalized values
- Ignore cosmetic changes (whitespace, timestamps)
- Flag semantic changes
- Assign risk level
- Suggest approval workflow

**Files**:
- `apps/api/src/modules/fact/fact-change.detector.ts`

## 2.5 Repositories

### Create Fact Repositories

- `OfficialFactRepository` — CRUD for facts
- `FactChangeRepository` — CRUD for changes
- `FactApprovalRepository` — Track approvals

**Files**:
- `apps/api/src/modules/fact/repositories/`

## 2.6 API Endpoints

### Fact Endpoints

```
POST /api/admin/facts/review
  ├── Get pending changes
  ├── Get evidence
  └── Show old vs new

POST /api/admin/facts/approve
  ├── Approve change
  ├── Emit event
  └── Outbox processes

POST /api/admin/facts/reject
  ├── Reject change
  ├── Record reason
  └── Archive
```

**Files**:
- `apps/api/src/modules/fact/fact.controller.ts`

## 2.7 Worker Task

### extract-facts Task

```typescript
export async function extractFactsTask(
  workerId: string,
  logger: AppLogger
): Promise<TaskOutcome>
```

**Flow**:
```
For each changed SourceSnapshot:
  ├── Extract facts
  ├── Normalize values
  ├── Detect changes vs old facts
  ├── Create FactChange records
  └── Emit FACT_CHANGE_DETECTED event
```

**Files**:
- `apps/api/src/workers/tasks/extract-facts.task.ts`

## 2.8 Event Handlers

### FactApprovedHandler

```
FACT_APPROVED event
  ├── Update OfficialFact in database
  ├── Update ExamEvent/ExamYear
  ├── Emit CACHE_REVALIDATION_REQUIRED
  ├── Emit SEARCH_INDEX_REQUIRED
  └── Emit SITEMAP_UPDATE_REQUIRED
```

**Files**:
- `apps/api/src/workers/handlers/fact-approved.handler.ts`

## 2.9 Testing

### Tests Required

```typescript
// Fact extraction
- extractFacts normalizes dates correctly
- extractFacts detects eligibility changes
- extractFacts handles ambiguity (LOW_CONFIDENCE)
- extractFacts preserves original value

// Change detection
- detectChanges ignores cosmetic changes
- detectChanges flags semantic changes
- detectChanges assigns risk levels
- detectChanges handles conflicting sources

// Normalization
- normalizDate handles 10 formats
- normalizeCurrency handles rupee symbols
- normalizeUrl canonicalizes
- normalizeText handles case/whitespace

// Workflow
- fact change → editor review → approval → database update
- rejected change recorded
```

**Files**:
- `apps/api/src/modules/fact/__tests__/`

## 2.10 Deliverables

**Database**:
- ✅ OfficialFact model
- ✅ FactChange model
- ✅ Migrations

**Services**:
- ✅ FactExtractionService
- ✅ FactChangeDetector
- ✅ FactApprovalService

**Repositories**:
- ✅ OfficialFactRepository
- ✅ FactChangeRepository

**API**:
- ✅ Fact review endpoints
- ✅ Fact approval endpoints

**Worker**:
- ✅ extract-facts task
- ✅ FactApprovedHandler

**Tests**:
- ✅ Extraction tests
- ✅ Change detection tests
- ✅ Normalization tests
- ✅ Workflow tests

**Success Criteria**:
- ✅ fetch-sources → extract-facts → FactChange created
- ✅ Editor can review pending changes
- ✅ Approval updates database
- ✅ Cache + search invalidated correctly

**Next Step**: Phase 3 — Paper Importer

---

# PHASE 3 — PAPER IMPORTER (7-10 days)

**Duration**: 7-10 days  
**Focus**: Automate paper discovery, validation, deduplication, storage  
**Goal**: 3,000 papers discoverable without manual upload

## 3.1 Paper Import Configuration

### Create Source Configuration

For each exam, define paper sources:

```typescript
interface PaperSourceConfig {
  examId: string
  sources: {
    name: string              // "JEE Advanced Official Archive"
    type: "HTML" | "PDF"     
    url: string               // "https://jeeadvanced.ac.in/papers"
    discoveryStrategy: "LIST_PAGE" | "PDF_INDEX" | "API"
    metadataExtraction: MetadataRule[]
    frequency: "DAILY" | "WEEKLY" | "MONTHLY"
    active: boolean
  }[]
}
```

### Storage in Database

- [ ] Create PaperSource model
- [ ] Seed with JEE Advanced, NEET, CBSE, etc.

## 3.2 Discovery Pipeline

### Discover Phase

```
Official source URL
  ├── Fetch page
  ├── Parse HTML/PDF index
  ├── Extract paper URLs
  ├── Extract metadata hints
  └── Create import tasks
```

### Implementation

**DiscoveryService**:
- HTML parser for list pages
- PDF index parser
- URL extraction
- Metadata hint extraction

**Files**:
- `apps/api/src/modules/paper/discovery/discovery.service.ts`
- `apps/api/src/modules/paper/discovery/html.parser.ts`
- `apps/api/src/modules/paper/discovery/pdf-index.parser.ts`

## 3.3 Fetch & Validate Phase

### Validate Phase

```
Paper URL
  ├── Fetch file
  ├── Check HTTP status
  ├── Check MIME type
  ├── Verify PDF signature
  ├── Check file size (reasonable bounds)
  ├── Attempt to read PDF
  ├── Check for corruption
  └── Record validation result
```

### Implementation

**ValidationService**:
- HTTP status checking
- MIME type verification
- PDF signature detection
- File integrity checking
- Corruption detection

**Files**:
- `apps/api/src/modules/paper/validation/validation.service.ts`

## 3.4 Metadata Extraction

### Extract Phase

```
Valid PDF
  ├── File size
  ├── Page count
  ├── Text extraction (if possible)
  ├── Properties (creator, modified date)
  ├── Combine with hints from source
  └── Store metadata
```

### Implementation

**MetadataExtractorService**:
- PDF property extraction
- Combine with hints
- Fallback to configuration

**Fields to Store**:
- fileName
- fileSize
- mimeType
- pageCount
- textExtractable
- publishedAt (from PDF or source)
- verifiedAt

**Files**:
- `apps/api/src/modules/paper/metadata/metadata.service.ts`

## 3.5 Hashing & Deduplication

### Hash Phase

```
PDF content
  ├── Calculate SHA-256
  ├── Check existing hash
  ├── If duplicate hash:
  │   ├── Same URL: skip
  │   ├── Different URL: mark duplicate
  │   └── Flag for review
  └── Store hash
```

### Duplicate Detection Logic

```
If hash exists:
  ├── exact match (same exam/year/paper)
    └── Skip (already have)
  ├── different paper ID
    └── LOW CONFIDENCE CONFLICT
        └── Editor review
  ├── different URL
    └── OFFICIAL_LINK if different, HOSTED consolidate

If no match:
  └── New paper, proceed
```

**Files**:
- `apps/api/src/modules/paper/deduplication/dedup.service.ts`

## 3.6 Storage Strategy

### OFFICIAL_LINK vs HOSTED

**Configuration per paper**:

```
storageMode: "OFFICIAL_LINK" | "HOSTED"

If OFFICIAL_LINK:
  ├── Store original URL
  ├── Verify URL stays accessible
  ├── Link directly to official

If HOSTED:
  ├── Download to Cloudinary
  ├── Store Cloudinary URL
  ├── Serve from CDN
  ├── Preserve official source URL in metadata
```

### Determine Strategy

```
Decision tree:
├── Copyright concerns?
│   └── OFFICIAL_LINK
├── Official source reliability?
│   ├── High: OFFICIAL_LINK
│   └── Low: HOSTED
├── Performance requirement?
│   ├── Critical: HOSTED
│   └── Normal: OFFICIAL_LINK
└── Storage capacity?
    ├── Limited: OFFICIAL_LINK
    └── Sufficient: HOSTED
```

**Add to QuestionPaper**:
```prisma
storageMode String @default("OFFICIAL_LINK")
officialUrl String?
hostedUrl   String? // Cloudinary
fileHash    String?
```

**Files**:
- `apps/api/src/modules/paper/storage/storage.service.ts`

## 3.7 Import Workflow

### Worker Task: import-papers

```typescript
async function importPapersTask(): Promise<TaskOutcome>
```

**Flow**:
```
For each paper source:
  ├── Discover URLs
  ├── For each URL:
  │   ├── Validate
  │   ├── Extract metadata
  │   ├── Hash
  │   ├── Deduplicate
  │   ├── Decide storage mode
  │   ├── Create/update QuestionPaper
  │   └── Emit PAPER_IMPORTED event
  └── Record import stats
```

**Idempotency**: Running twice produces same result (no duplicates)

**Files**:
- `apps/api/src/workers/tasks/import-papers.task.ts`

## 3.8 Event Handler: PaperImportedHandler

```
PAPER_IMPORTED event
  ├── Verify QuestionPaper created
  ├── Add to search index
  ├── Update sitemap
  ├── Emit cache invalidation
  └── Log success
```

**Files**:
- `apps/api/src/workers/handlers/paper-imported.handler.ts`

## 3.9 Paper API Endpoints

### Existing Endpoints (verify working)

```
GET /api/papers
  └── List papers with pagination

GET /api/papers?examId=...&year=...
  └── Filter by exam/year

GET /api/papers/:id
  └── Paper details
```

### Additional Endpoints

```
GET /api/admin/papers/import-status
  └── Last import run stats

POST /api/admin/papers/import-now
  └── Trigger manual import

GET /api/admin/papers/duplicates
  └── Flag potential duplicates
```

## 3.10 Testing

### Tests Required

```typescript
// Discovery
- discovers papers from HTML list
- discovers papers from PDF index
- extracts metadata hints
- handles 404 source

// Validation
- validates PDF file signature
- rejects HTML as PDF
- detects corruption
- handles large files
- handles timeout

// Metadata
- extracts PDF properties
- combines with hints
- handles missing data

// Deduplication
- detects exact duplicates
- detects different URLs, same content
- handles missing hash

// Storage
- generates official link correctly
- uploads to Cloudinary correctly
- stores mode in database

// Workflow
- discover → validate → deduplicate → store
- idempotent on re-run
```

**Files**:
- `apps/api/src/modules/paper/import/__tests__/`

## 3.11 Initial Import

### Import JEE Advanced Papers

- [ ] Configure JEE Advanced paper sources
- [ ] Run importer for 2020-2026 (7 years × 2-3 papers = ~20 papers)
- [ ] Validate results
- [ ] Verify no duplicates
- [ ] Verify metadata correct

## 3.12 Deliverables

**Database**:
- ✅ PaperSourceConfig
- ✅ Add storageMode to QuestionPaper

**Services**:
- ✅ DiscoveryService
- ✅ ValidationService
- ✅ MetadataExtractorService
- ✅ DeduplicationService
- ✅ StorageStrategyService

**Worker**:
- ✅ import-papers task
- ✅ PaperImportedHandler

**API**:
- ✅ Paper endpoints (verify existing)
- ✅ Admin import endpoints

**Tests**:
- ✅ Discovery tests
- ✅ Validation tests
- ✅ Deduplication tests
- ✅ Storage tests
- ✅ Workflow tests

**Success Criteria**:
- ✅ JEE Advanced papers imported
- ✅ No duplicates
- ✅ Metadata correct
- ✅ OFFICIAL_LINK or HOSTED working
- ✅ Papers searchable

**Next Step**: Phase 4 — Universal Browse Renderer

---

# PHASE 4 — UNIVERSAL BROWSE RENDERER (5-7 days)

**Duration**: 5-7 days  
**Focus**: Create reusable browse page template  
**Goal**: One code path for exams, papers, boards, results, blogs

## 4.1 Browse Component

### Props Interface

```typescript
interface BrowseProps {
  title: string              // "JEE Advanced Papers"
  description: string
  breadcrumbs: Breadcrumb[]
  
  // Data
  items: BrowseItem[]
  totalCount: number
  
  // Filtering
  filters: FilterGroup[]
  appliedFilters: Record<string, string[]>
  
  // Pagination
  currentPage: number
  pageSize: number
  
  // Internal links
  relatedResources: Link[]
  
  // SEO
  canonical: string
  robots: "index" | "noindex"
  structuredData: JsonLdObject
}

interface BrowseItem {
  id: string
  title: string
  href: string
  badges: Badge[]
  metadata: Record<string, string>
  description?: string
}

interface FilterGroup {
  name: string
  type: "checkbox" | "radio" | "date"
  options: FilterOption[]
}

interface FilterOption {
  label: string
  value: string
  count: number
  enabled: boolean
}
```

## 4.2 Component Implementation

### BrowsePage Component

```typescript
export function BrowsePage(props: BrowseProps) {
  return (
    <Wrap>
      <Breadcrumbs items={props.breadcrumbs} />
      <h1>{props.title}</h1>
      <p>{props.description}</p>
      
      <div className="grid">
        <aside>
          <Filters 
            groups={props.filters}
            applied={props.appliedFilters}
          />
        </aside>
        
        <main>
          <div>
            Results: {props.totalCount}
          </div>
          
          <div className="grid">
            {props.items.map(item => (
              <BrowseCard key={item.id} item={item} />
            ))}
          </div>
          
          <Pagination 
            current={props.currentPage}
            total={Math.ceil(props.totalCount / props.pageSize)}
          />
        </main>
      </div>
      
      <RelatedResources links={props.relatedResources} />
    </Wrap>
  )
}
```

### BrowseCard Component

```typescript
export function BrowseCard({ item }: { item: BrowseItem }) {
  return (
    <Link href={item.href}>
      <h3>{item.title}</h3>
      {item.badges.map(badge => (
        <EntityBadge key={badge.kind} kind={badge.kind} />
      ))}
      <dl>
        {Object.entries(item.metadata).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {item.description && <p>{item.description}</p>}
    </Link>
  )
}
```

**Files**:
- `packages/ui/src/browse-page.tsx`
- `packages/ui/src/browse-card.tsx`
- `packages/ui/src/filters.tsx`

## 4.3 Usage Examples

### Exam Browse

```typescript
// /exams
export default async function ExamsPage() {
  const exams = await listExams()
  
  return (
    <BrowsePage
      title="All Exams"
      items={exams.map(e => ({
        id: e.id,
        title: e.name,
        href: ROUTES.exam(e.slug),
        badges: [{ kind: 'exam' }],
        metadata: {
          Type: e.level,
          Frequency: e.frequency,
        }
      }))}
      totalCount={exams.total}
      filters={[
        { name: 'Level', options: ['UG', 'PG', 'Competitive'] },
        { name: 'Frequency', options: ['Once a year', 'Twice a year', 'Monthly'] },
      ]}
      relatedResources={[
        { label: 'Popular Exams', href: ROUTES.exams() },
      ]}
    />
  )
}
```

### Paper Browse

```typescript
// /exam/jee-advanced/previous-year-papers
export default async function PapersPage({ params }) {
  const papers = await listPapers({ examSlug: params.slug })
  
  return (
    <BrowsePage
      title="JEE Advanced Previous Year Papers"
      items={papers.map(p => ({
        id: p.id,
        title: p.title,
        href: ROUTES.paper(p.slug),
        badges: [{ kind: 'paper' }],
        metadata: {
          Year: p.year,
          Subject: p.subject,
          Paper: p.paper,
        }
      }))}
      filters={[
        { name: 'Year', options: ['2026', '2025', '2024', ...] },
        { name: 'Subject', options: ['Physics', 'Chemistry', 'Mathematics'] },
      ]}
    />
  )
}
```

## 4.4 Pagination

### Keyset Pagination

Reuse existing keyset pagination infrastructure:

```typescript
interface PageQuery {
  limit: number
  cursor?: string
  sort?: string
}

const papers = await listPapers({
  limit: 20,
  cursor: 'eyJpZCI6IjEyMyJ9', // base64 encoded next cursor
  sort: 'year:desc'
})

return {
  items: papers,
  nextCursor: papers.nextCursor || null,
}
```

**Files**: Use existing pagination utilities

## 4.5 Filters & Faceting

### Faceting

Reuse existing SearchProvider faceting:

```typescript
const results = await search.query('jee papers', {
  filters: {
    exam: 'jee-advanced',
    year: '2025'
  },
  facets: ['year', 'subject', 'paper']
})

return {
  items: results.hits,
  facets: results.facets.year.map(bucket => ({
    value: bucket.value,
    count: bucket.count,
  }))
}
```

**Files**: Use existing search faceting

## 4.6 Testing

### Tests Required

```typescript
// Rendering
- renders title
- renders description
- renders items
- renders pagination
- renders filters
- renders related resources

// Interaction
- filters apply correctly
- pagination advances
- sort changes results
- cards link correctly
```

**Files**:
- `packages/ui/__tests__/browse-page.test.tsx`

## 4.7 Deliverables

**Components**:
- ✅ BrowsePage
- ✅ BrowseCard
- ✅ Filters
- ✅ Pagination

**Utilities**:
- ✅ Browse props builder
- ✅ Filter query builder

**Tests**:
- ✅ Component tests

**Success Criteria**:
- ✅ One component renders all browse pages
- ✅ Faceting works
- ✅ Pagination works
- ✅ Filters work
- ✅ SEO metadata correct

**Next Step**: Phase 5 — Paper Detail + Browse Pages

---

# PHASE 5 — PAPER DETAIL + BROWSE PAGES (3-5 days)

**Duration**: 3-5 days  
**Focus**: Build paper-specific pages using existing infrastructure  
**Goal**: /previous-year-papers/[slug] + /exam/[slug]/previous-year-papers working

## 5.1 Paper Detail Page

### Route

```
/previous-year-papers/[slug]
```

### Page Component

```typescript
export default async function PaperDetailPage({ params }) {
  const paper = await getPaper(params.slug)
  
  return (
    <Wrap>
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Papers', href: ROUTES.papers() },
        { label: 'Exam', href: ROUTES.exam(paper.exam.slug) },
        { label: paper.title, href: '#' },
      ]} />
      
      <article>
        <h1>{paper.title}</h1>
        <EntityBadge kind="paper" />
        
        <FactGrid items={[
          { label: 'Exam', value: paper.exam.name },
          { label: 'Year', value: paper.year },
          { label: 'Subject', value: paper.subject },
          { label: 'Paper', value: paper.paper },
        ]} />
        
        <p>{paper.source && `Source: ${paper.source}`}</p>
        
        <button>
          Download Paper {paper.storageMode === 'HOSTED' ? '↓' : '→'}
        </button>
        
        <section>
          <h2>Related Papers</h2>
          {relatedPapers.map(p => (
            <Link href={ROUTES.paper(p.slug)}>
              {p.title}
            </Link>
          ))}
        </section>
      </article>
    </Wrap>
  )
}
```

## 5.2 Paper Browse Page

### Route

```
/exam/[slug]/previous-year-papers
```

### Page Component

```typescript
export default async function ExamPapersPage({ params }) {
  const exam = await getExam(params.slug)
  const papers = await listPapers({ examId: exam.id })
  
  return (
    <Wrap>
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Exams', href: ROUTES.exams() },
        { label: exam.name, href: ROUTES.exam(exam.slug) },
        { label: 'Papers', href: '#' },
      ]} />
      
      <BrowsePage
        title={`${exam.name} Previous Year Papers`}
        items={papers.map(p => ({
          id: p.id,
          title: p.title,
          href: ROUTES.paper(p.slug),
          metadata: {
            Year: p.year,
            Subject: p.subject,
          },
        }))}
        filters={[
          { name: 'Year', options: uniqueYears },
          { name: 'Subject', options: uniqueSubjects },
        ]}
      />
    </Wrap>
  )
}
```

## 5.3 Metadata & SEO

### Metadata Generation

```typescript
export function generateMetadata({ params }): Metadata {
  return buildMetadata({
    template: 'paper',
    values: {
      title: paper.title,
      description: `${paper.exam.name} ${paper.year} ${paper.subject} Paper`,
    },
    path: ROUTES.paper(params.slug),
  })
}
```

### Canonical & Robots

```typescript
// canonical always to apex
<link rel="canonical" href={buildCanonicalUrl(ROUTES.paper(paper.slug))} />

// index if content substantial, otherwise noindex
<meta name="robots" content={paper.pages > 5 ? 'index' : 'noindex'} />
```

## 5.4 Structured Data

### BreadcrumbList

```typescript
const breadcrumbs = [
  { name: 'Home', item: '/' },
  { name: 'Papers', item: '/previous-year-papers' },
  { name: 'Exam', item: ROUTES.exam(paper.exam.slug) },
  { name: paper.title, item: ROUTES.paper(paper.slug) },
]

<JsonLd data={breadcrumbSchema(breadcrumbs)} />
```

### Article Schema (for papers)

```typescript
<JsonLd data={{
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: paper.title,
  datePublished: paper.publishedAt,
  dateModified: paper.updatedAt,
  author: { '@type': 'Organization', name: paper.exam.conductingBody },
}} />
```

## 5.5 Testing

### Tests Required

```typescript
// Paper detail
- renders title
- renders metadata
- renders download button
- renders related papers
- metadata correct
- canonical correct
- robots correct
- structured data valid

// Paper browse
- renders list
- renders filters
- pagination works
```

**Files**:
- `apps/web/src/app/previous-year-papers/__tests__/`
- `apps/web/src/app/exam/__tests__/`

## 5.6 Deliverables

**Pages**:
- ✅ /previous-year-papers/[slug]
- ✅ /exam/[slug]/previous-year-papers

**Features**:
- ✅ Metadata
- ✅ Canonical
- ✅ Robots
- ✅ Structured data
- ✅ Breadcrumbs
- ✅ Internal links
- ✅ Related papers

**Tests**:
- ✅ Page tests

**Success Criteria**:
- ✅ Papers visible in search
- ✅ Metadata correct in GSC
- ✅ Download works
- ✅ Related links working

**Next Step**: Phase 6 — Complete JEE Advanced Vertical

---

# PHASE 6 — COMPLETE JEE ADVANCED VERTICAL (7-10 days)

**Duration**: 7-10 days  
**Focus**: Build all 7 JEE Advanced sub-pages  
**Goal**: /exam/jee-advanced/* complete end-to-end

## 6.1 Pages to Build

```
/exam/jee-advanced              (overview)
/exam/jee-advanced/syllabus
/exam/jee-advanced/exam-pattern
/exam/jee-advanced/eligibility
/exam/jee-advanced/application-form
/exam/jee-advanced/admit-card
/exam/jee-advanced/answer-key
/exam/jee-advanced/result
/exam/jee-advanced/previous-year-papers
```

## 6.2 Data Structure

### ExamSectionPage Component

```typescript
interface ExamSectionProps {
  exam: Exam
  section: 'syllabus' | 'pattern' | 'eligibility' | 'application' | 'admitcard' | 'answerkey' | 'result'
  content: ContentEntry
}
```

## 6.3 Page Components

### Syllabus

```typescript
export default async function SyllabusPage({ params }) {
  const exam = await getExam(params.slug)
  const content = await getExamContent(exam.id, 'SYLLABUS')
  
  return (
    <ExamPage exam={exam}>
      <h2>Syllabus</h2>
      <Content html={content.html} />
      <SourceInfo source={content.source} />
      <RelatedResources exam={exam} />
    </ExamPage>
  )
}
```

### Pattern

```typescript
export default async function PatternPage({ params }) {
  const exam = await getExam(params.slug)
  const pattern = await getExamContent(exam.id, 'EXAM_PATTERN')
  
  return (
    <ExamPage exam={exam}>
      <h2>Exam Pattern</h2>
      <FactGrid items={[
        { label: 'Mode', value: exam.mode },
        { label: 'Duration', value: `${exam.durationMin} minutes` },
        { label: 'Questions', value: exam.questionCount },
        { label: 'Marking', value: exam.markingScheme },
      ]} />
      <Content html={pattern.html} />
    </ExamPage>
  )
}
```

### Eligibility

```typescript
export default async function EligibilityPage({ params }) {
  const exam = await getExam(params.slug)
  const eligibility = await getExamContent(exam.id, 'ELIGIBILITY')
  
  return (
    <ExamPage exam={exam}>
      <h2>Eligibility</h2>
      <Content html={eligibility.html} />
      <FactGrid items={eligibilityFacts} />
    </ExamPage>
  )
}
```

### Application

```typescript
export default async function ApplicationPage({ params }) {
  const exam = await getExam(params.slug)
  const app = await getExamContent(exam.id, 'APPLICATION')
  
  return (
    <ExamPage exam={exam}>
      <h2>How to Apply</h2>
      <Content html={app.html} />
      <Button>
        Apply Now →
      </Button>
    </ExamPage>
  )
}
```

### Admit Card

```typescript
export default async function AdmitCardPage({ params }) {
  const exam = await getExam(params.slug)
  const admitcard = await getExamContent(exam.id, 'ADMIT_CARD')
  const event = exam.years[0].events.find(e => e.type === 'ADMIT_CARD')
  
  return (
    <ExamPage exam={exam}>
      <h2>Admit Card</h2>
      {event && (
        <StatusStamp tone={event.isTentative ? 'wait' : 'ok'}>
          Available {event.startDate.toLocaleDateString()}
        </StatusStamp>
      )}
      <Content html={admitcard.html} />
    </ExamPage>
  )
}
```

### Answer Key

```typescript
export default async function AnswerKeyPage({ params }) {
  const exam = await getExam(params.slug)
  const answerkey = await getExamContent(exam.id, 'ANSWER_KEY')
  
  return (
    <ExamPage exam={exam}>
      <h2>Answer Key</h2>
      <Content html={answerkey.html} />
      <RelatedResources exam={exam} type="papers" />
    </ExamPage>
  )
}
```

### Result

```typescript
export default async function ResultPage({ params }) {
  const exam = await getExam(params.slug)
  const result = await getLatestResult(exam.id)
  const event = exam.years[0].events.find(e => e.type === 'RESULT')
  
  return (
    <ExamPage exam={exam}>
      <h2>Result</h2>
      {result && (
        <div>
          <p>Declared on {result.declaredAt.toLocaleDateString()}</p>
          <Button>View Results →</Button>
        </div>
      )}
      {event && (
        <StatusStamp tone={result ? 'ok' : 'wait'}>
          {result ? 'Declared' : `Expected ${event.startDate.toLocaleDateString()}`}
        </StatusStamp>
      )}
      <Content html={getExamContent(exam.id, 'RESULT')} />
    </ExamPage>
  )
}
```

## 6.4 Exam Layout Component

### ExamPage Wrapper

```typescript
export function ExamPage({ exam, children }) {
  return (
    <Wrap>
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Exams', href: ROUTES.exams() },
        { label: exam.name, href: '#' },
      ]} />
      
      <article>
        <h1>{exam.name}</h1>
        <p>{exam.conductingBody}</p>
        
        {/* Important Dates */}
        <Section title="Important Dates">
          <FactGrid items={importantDates(exam)} />
        </Section>
        
        {/* Navigation */}
        <nav className="exam-nav">
          <Link href={ROUTES.examSyllabus(exam.slug)}>Syllabus</Link>
          <Link href={ROUTES.examPattern(exam.slug)}>Pattern</Link>
          <Link href={ROUTES.examEligibility(exam.slug)}>Eligibility</Link>
          <Link href={ROUTES.examApplication(exam.slug)}>Apply</Link>
          <Link href={ROUTES.examAdmitCard(exam.slug)}>Admit Card</Link>
          <Link href={ROUTES.examAnswerKey(exam.slug)}>Answer Key</Link>
          <Link href={ROUTES.examResult(exam.slug)}>Result</Link>
          <Link href={ROUTES.examPapers(exam.slug)}>Papers</Link>
        </nav>
        
        {/* Page content */}
        {children}
      </article>
      
      {/* Related resources */}
      <Section title="Related Exams">
        <ExamCardGrid exams={relatedExams} />
      </Section>
    </Wrap>
  )
}
```

## 6.5 Internal Linking

### Links Matrix

```
Syllabus → Pattern → Eligibility → Application → Admit Card → Answer Key → Result → Papers

Also:
Each page → Overview
Each page → Related Exams
```

## 6.6 SEO Per Page

### Metadata

```typescript
export function generateMetadata({ params }): Metadata {
  const section = params.section || 'overview'
  return buildMetadata({
    template: 'exam-detail',
    values: {
      exam: exam.name,
      section: section,
    },
  })
}
```

## 6.7 Testing

### Test Suite

```typescript
// Each page:
- renders without error
- metadata correct
- canonical correct
- breadcrumbs present
- internal links correct
- structured data valid
- accessibility check
- performance > 90 Lighthouse
```

## 6.8 Deliverables

**Pages**:
- ✅ /exam/jee-advanced (overview)
- ✅ /exam/jee-advanced/syllabus
- ✅ /exam/jee-advanced/exam-pattern
- ✅ /exam/jee-advanced/eligibility
- ✅ /exam/jee-advanced/application-form
- ✅ /exam/jee-advanced/admit-card
- ✅ /exam/jee-advanced/answer-key
- ✅ /exam/jee-advanced/result
- ✅ /exam/jee-advanced/previous-year-papers

**Features**:
- ✅ Exam navigation
- ✅ Important dates prominently displayed
- ✅ All facts sourced/verified
- ✅ Internal linking
- ✅ Related resources

**Tests**:
- ✅ All page tests
- ✅ Metadata tests
- ✅ Link tests

**Success Criteria**:
- ✅ Student can find all JEE Advanced information
- ✅ Can see important dates at a glance
- ✅ Can access papers
- ✅ Can apply/check results
- ✅ No need to open another website

**Next Step**: Phase 7-15 (Template Generalization & Advanced Features)

---

# PHASES 7-15 — REMAINING WORK

## Phase 7 — Generalize Exam Templates (3-5 days)
- ✅ Convert JEE Advanced to reusable template
- ✅ Apply to other major exams (JEE Main, NEET, UPSC, etc.)
- ✅ Generate ~100 exam pages

## Phase 8 — Board Ecosystem (7-10 days)
- ✅ Build board/class/subject/chapter pages
- ✅ Apply noindex policy (content-based)
- ✅ Generate ~3,000 board pages

## Phase 9 — Results + Editorial (5-7 days)
- ✅ Results detail pages
- ✅ Blog/article templates
- ✅ Editorial workflow UI

## Phase 10 — Admin Interface (10-14 days)
- ✅ Editorial dashboard
- ✅ Fact review queue
- ✅ Approval workflow
- ✅ Content management

## Phase 11 — Tier-0 Optimization (5-7 days)
- ✅ Enhance 50 flagship exams
- ✅ Comprehensive content per page
- ✅ Advanced internal linking
- ✅ Premium UX

## Phase 12 — Question-Level Data (10-14 days)
- ✅ Question models
- ✅ Question extraction from papers
- ✅ Topic/difficulty tagging

## Phase 13 — Analytics/Recommendation (7-10 days)
- ✅ Question frequency
- ✅ Topic weightage
- ✅ Paper difficulty trends
- ✅ Recommendations

## Phase 14 — Student Tools (10-14 days)
- ✅ Marks calculator
- ✅ Rank predictor
- ✅ Study planner
- ✅ Paper analyzer

## Phase 15 — AI/Embeddings (DEFER for now)
- Semantic search
- Smart recommendations
- Chatbot assistance
- (Build only after Phases 1-14 solid)

---

# IMPLEMENTATION PRINCIPLES

## Golden Rules

1. **INSPECT before MODIFY**
   - Read existing code first
   - Understand architecture
   - Prevent rebuilding

2. **EXTEND not REPLACE**
   - Add to existing services
   - Reuse existing models
   - Preserve conventions

3. **NEVER FABRICATE FACTS**
   - Dates, eligibility, fees come from official sources
   - Mark unknown/tentative
   - Never invent information

4. **MEASURE before SCALING**
   - Verify JEE Advanced works completely
   - Check search, metrics, UX
   - Then generalize to other exams

5. **MAINTAIN PROVENANCE**
   - Every fact has source
   - Every update traced
   - Editorial approval required for high-risk

6. **TEST EVERYTHING**
   - Unit tests per subsystem
   - Integration tests per phase
   - CI gates prevent bad deploys

7. **PRESERVE PERFORMANCE**
   - ~103 kB First Load JS target
   - Server-rendered by default
   - Client components only when necessary

---

# SUCCESS METRICS

## Phase Completion Checklist

### Phase 0 ✅
- Gap matrix complete
- All systems inventoried
- No surprises about existing code

### Phase 1 ✅
- Canonical domain verified
- Analytics instrumented
- Error monitoring active
- Observability baseline

### Phase 2 ✅
- Fact models in database
- Extraction working
- Change detection working
- Editorial review possible
- Approval → publication working

### Phase 3 ✅
- Papers discovered automatically
- No duplicates
- Deduplication working
- Storage strategy applied
- Papers searchable

### Phase 4 ✅
- Universal browse component reusable
- Faceting works
- Pagination works
- Filtering works

### Phase 5 ✅
- Paper detail page ranks in search
- Browse page works
- All metadata correct
- Structured data valid

### Phase 6 ✅
- JEE Advanced complete end-to-end
- Student can complete all tasks without leaving site
- 9 pages (overview + 8 sub-pages) published
- All dates/facts verified
- Papers accessible
- Apply/result links working

### Phases 7-15 ✅
- Other exams generalized
- Board ecosystem complete
- Results + editorial working
- Admin interface usable
- Tier-0 pages polished
- Analytics showing value

---

# TIMELINE SUMMARY

| Phase | Focus | Duration | Cumulative |
|-------|-------|----------|-----------|
| 0 | Audit | 3-5 days | 3-5 days |
| 1 | Foundation | 5-7 days | 8-12 days |
| 2 | Facts | 10-14 days | 18-26 days |
| 3 | Papers | 7-10 days | 25-36 days |
| 4 | Renderer | 5-7 days | 30-43 days |
| 5 | Detail Pages | 3-5 days | 33-48 days |
| 6 | JEE Vertical | 7-10 days | 40-58 days |
| 7-15 | Generalize | 60-90 days | 100-148 days |

**Core System Ready**: 40-58 days (6-9 weeks)  
**Full Launch**: 100-148 days (14-21 weeks)

---

# DEFINITION OF DONE

### System is complete when:

✅ Official data flows from source → database  
✅ Facts extracted and normalized  
✅ Changes detected and reviewed  
✅ Papers discovered and deduplicated  
✅ Pages render from structured data  
✅ Every page has provenance  
✅ Search finds everything  
✅ Analytics measure success  
✅ No fabricated content  
✅ All major exams covered  
✅ Tier-0 pages premium quality  
✅ Editorial workflow operational  
✅ CI gates prevent mistakes  
✅ Production monitoring comprehensive  

### Final Product:
> A trusted education platform where any Indian student can find official exam information, access documents, and know what to do next — without needing to search elsewhere.

---

**IMPLEMENTATION READY**

This plan is verified against the actual codebase and is ready for execution starting with **Phase 0 — Codebase Audit**.

**Date**: September 3, 2026  
**Status**: ✅ APPROVED FOR IMPLEMENTATION
