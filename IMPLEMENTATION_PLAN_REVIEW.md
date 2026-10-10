# SchoolToCareer Implementation Plan Review

**Review date:** September 18, 2026  
**Repository:** SchoolToCareer  
**Verdict:** The plan is directionally correct, but it is not an accurate current-state report. It combines completed infrastructure, future design, and unchecked success criteria.

## Executive Verdict

The repository has a strong platform foundation:

- Source monitoring and source snapshots are implemented.
- PostgreSQL, Prisma, exam, paper, result, content, search, and outbox infrastructure exist.
- API modules and worker infrastructure exist.
- The local repository typechecks successfully across all packages.
- The production web build completes.
- The public site is live, but product activation is still partial.

The product is **not yet complete**. The main remaining work is verified source-backed content, student-facing page templates, fact review, search UX, analytics, and editorial/admin workflows.

## Verified Foundation

### Backend and data

Implemented areas include:

- `Source` and `SourceSnapshot` models.
- Robots handling and classification.
- ETag and Last-Modified conditional requests.
- Content normalization and SHA-256 hashing.
- Historical source snapshots.
- Exam, exam-year, exam-event, question-paper, result, board, content, revision, search, and outbox models.
- API repositories, services, validation, authentication, authorization, and structured logging.
- Outbox worker and periodic task framework.

The source worker currently supports source fetching, scheduled publishing, and media reconciliation. It does not yet run fact extraction or paper importing.

### Frontend and deployment

Implemented or partially implemented:

- Homepage.
- Exam index and exam hub pages.
- Generic exam section route.
- Boards, blog, papers, and results index pages.
- Metadata, canonical URL, robots, sitemap, JSON-LD, provenance, and noindex safeguards.
- Vercel web deployment and Render API/worker deployment.

The site currently indexes only a small set of verified hub/listing URLs. Unverified exam pages correctly remain `noindex`.

### Validation

The following checks were successful during the repository audit:

- `pnpm typecheck`: 11/11 packages successful.
- `pnpm build`: completed successfully.
- API and web packages compile successfully.

The build emitted `ECONNREFUSED` warnings during static generation when the API was not running locally. This means the build is technically successful, but API-backed page generation was not fully exercised in that run.

## Missing Work

### 1. Fact intelligence

Not implemented:

- `OfficialFact` or `ExtractedFact` model.
- `FactChange` model.
- Evidence text and extractor versioning.
- Canonical entity/value representation.
- Idempotency keys.
- Deterministic fact extraction.
- Semantic comparison of extracted facts.
- Risk classification.
- Editorial review, approval, rejection, and ignore workflow.
- Fact-related API endpoints.
- Fact worker task and outbox events.
- Canonical `ExamEvent` updates after approval.

The existing repository documentation correctly identifies this as unfinished. See [docs/PHASE-1-ASSESSMENT.md](docs/PHASE-1-ASSESSMENT.md).

### 2. Paper importer

Not implemented:

- Paper source configuration.
- Paper discovery from official HTML/PDF indexes.
- PDF signature and corruption validation.
- PDF metadata extraction.
- SHA-256 deduplication workflow.
- Import task and import status reporting.
- Duplicate review workflow.
- Paper import tests.

The plan should first reconcile its proposed `storageMode`, `officialUrl`, and `hostedUrl` fields with the existing versioned `QuestionPaperFile` and `MediaAsset` design.

### 3. Frontend templates

Still missing or incomplete:

- Paper detail pages.
- Year-specific paper pages.
- Board hub, class, subject, chapter, syllabus, and paper pages.
- Result detail pages.
- Blog category and article pages.
- Exam category pages.
- Search results UI and complete search interactions.
- Legal pages: privacy, terms, disclaimer, and contact.
- Admin/editorial UI.
- Complete static generation and indexing policy for content-backed pages.

The generic exam section route exists, but it does not mean all planned page types are complete.

### 4. Analytics and observability

Search analytics exist at the API level, but the requested product event instrumentation is incomplete.

Still needed:

- Search performed events.
- Zero-result search events.
- Search result click events.
- Paper download events.
- Official-link click events.
- Result-view events.
- Filter events.
- Reliable production analytics storage or provider integration.
- Dashboard and alerting for 404s, 500s, worker failures, retries, and API latency.
- Core Web Vitals field data.

## Problems In The Current Plan

### Phase numbering is inconsistent

The repository documentation treats source acquisition as Phase 0 and fact intelligence as Phase 1. The supplied plan calls observability Phase 1 and facts Phase 2.

Choose one numbering system and use it everywhere.

### Future work is marked as complete

The plan marks future deliverables and success metrics with `✅`, even though the corresponding code does not exist. These checkmarks should become unchecked task items until verified by code, tests, and production behavior.

### Fact terminology is unresolved

The project uses both `OfficialFact` and `ExtractedFact` in planning documents. Select one model or document clearly separate responsibilities, for example:

- `ExtractedFact`: an observation produced from a source snapshot.
- `CanonicalFact`: the approved value used by the product.
- `FactChange`: a proposed difference requiring review.

Do not create both names without a clear lifecycle distinction.

### API completeness is overstated

The API foundation is substantial, but existing API endpoints do not imply that all planned frontend workflows, ingestion pipelines, admin operations, or fact workflows are complete.

### Paper storage design is underspecified

The plan proposes new direct storage fields, while the current schema already models paper files as versioned records connected to media assets. The importer should extend the existing model rather than create a parallel storage path.

### Production status needs deployment verification

The website status document records canonical-host changes and dead-link fixes that still require deployment and production re-verification. The following must be checked after deployment:

- Canonical host and redirects.
- Vercel `NEXT_PUBLIC_SITE_URL`.
- Render `WEB_BASE_URL` and `CORS_ORIGINS`.
- Sitemap and robots host values.
- Production dead links.
- Revalidation webhook behavior.
- Indexability of the first verified exam cohort.

See [docs/WEBSITE-STATUS-2026-09-12.md](docs/WEBSITE-STATUS-2026-09-12.md).

## Recommended Execution Order

### Phase 0: Stabilize production configuration

- Deploy the canonical `www` configuration.
- Update Vercel and Render environment variables.
- Re-run production SEO and dead-link checks.
- Confirm revalidation webhook delivery.
- Keep unverified pages `noindex`.

### Phase 1: Activate verified content

- Complete the six fact decisions.
- Verify canonical `ExamEvent` values.
- Verify reviewer attribution and audit records.
- Verify outbox processing and cache revalidation.
- Activate the first evidence-backed exam cohort.
- Confirm sitemap inclusion only for indexable pages.

### Phase 2: Search and analytics

- Complete the search results interface.
- Add empty, error, loading, and zero-result states.
- Add result-click and zero-result tracking.
- Use search logs as the editorial backlog.
- Validate the student journey with real queries.

### Phase 3: Shared browse renderer

Build a reusable renderer for:

- Exams.
- Papers.
- Results.
- Boards.
- Articles.

Use existing pagination, filtering, search, metadata, and provenance conventions.

### Phase 4: Paper detail and browse

- Build paper detail pages.
- Build exam paper browse pages.
- Add official source links and download tracking.
- Add structured data and related resources.
- Validate all links and metadata.

### Phase 5: Fact intelligence

- Finalize fact terminology and schema.
- Add extraction observations and evidence.
- Add semantic comparison and risk classification.
- Add review and approval endpoints.
- Update canonical exam data only after approval.
- Add end-to-end tests from source snapshot to published value.

### Phase 6: Paper import

- Finalize storage and provenance design.
- Add source configurations.
- Implement discovery, validation, metadata, hashing, deduplication, and import reporting.
- Start with a bounded official-paper cohort.
- Validate idempotency and duplicate handling.

### Phase 7: Remaining templates and admin

- Board ecosystem.
- Results and articles.
- Legal pages.
- Admin/editorial interface.
- Fact review queue.
- Update reminders for stale pages.

### Defer

Keep these out of the immediate implementation scope:

- Question-level analytics.
- Recommendations.
- Rank predictors.
- Paper analysis.
- Embeddings and AI.

They require question-level data and stable content workflows first.

## Revised Definition Of Done

The system should not be considered complete until:

- Every published exam fact has official provenance.
- Source changes can become reviewable semantic changes.
- Approved changes update canonical data safely and idempotently.
- Paper ingestion is validated, deduplicated, and traceable.
- Search works for real student queries and records zero-result demand.
- Published pages have correct canonical, robots, sitemap, and structured data.
- No public page contains fabricated dates, links, or conducting-body data.
- Production revalidation and worker delivery are verified.
- Legal pages and basic admin/editorial workflows exist.
- Indexable pages are limited to pages with meaningful, verified content.

## Final Assessment

The implementation plan is a good strategic roadmap, but it should not be labeled “verified” or “implementation ready” without updating its current-state claims.

The repository is best described as:

> A production-deployed platform foundation with source monitoring, API infrastructure, SEO safeguards, and an early frontend. The fact workflow, paper importer, search experience, most content templates, analytics instrumentation, and admin workflow remain to be completed.
