# SchoolToCareer Project Completion Status

**Validated:** 2026-09-04  
**Branch:** `feat/semantic-fact-engine`  
**Purpose:** authoritative handoff describing what is complete, what is verified, what is blocked, and what must happen before V1 is complete.

## Executive Summary

The foundation and semantic trust machinery are implemented. The project is no longer in an architecture-building phase.

The remaining work is product activation and content execution:

```text
human fact review
    -> activate verified exam identities
    -> verify first useful indexable pages
    -> execute major exam product cohort
    -> build real paper product
    -> complete results and lifecycle
    -> expand boards
    -> finish universal search
    -> build editorial operations
    -> measure SEO and student journeys
    -> complete V1 audit
```

**SchoolToCareer V1 is not complete.** The immediate blocker is six pending fact changes plus missing verified identity/content for the first exams.

## Current Status At A Glance

```text
Source monitoring                 COMPLETE
Source snapshots                  COMPLETE
Fact extraction                   COMPLETE
ExtractedFact / FactChange        COMPLETE
Canonical ownership               COMPLETE
Reviewer authentication           COMPLETE
Approval API                      COMPLETE
Atomic canonical update           COMPLETE
Audit and reviewer attribution    COMPLETE
Outbox and revalidation           COMPLETE
Integrity gate                    COMPLETE
Sitemap/indexability safeguards   COMPLETE
Master Search Product Map         COMPLETE
Evidence-rich review command      COMPLETE

Pending fact changes              6
Human dispositions                PENDING
First exam activation             NOT COMPLETE

Admin console                     NOT IMPLEMENTED
Paper importer                    NOT IMPLEMENTED
Paper product                    NOT COMPLETE
Results/lifecycle product         PARTIAL
Board expansion                  PARTIAL
Universal search UI              INCOMPLETE
SEO scale and measurement         NOT COMPLETE
V1 completion audit              NOT STARTED
```

## What Has Been Completed

### Source and ingestion foundation

- Official source registry and source-to-exam bindings.
- `Source` and `SourceSnapshot` persistence.
- Historical changed bodies and fetch outcomes.
- Robots policy handling, including explicit disallow versus unavailable robots data.
- ETag and Last-Modified conditional requests.
- Normalization and SHA-256 content hashing.
- UTF-8-safe body truncation with truncated-body extraction refusal.
- Failure tracking, cadence, backoff, and source reporting.
- Existing worker and periodic-task architecture preserved.

### Semantic fact engine

- Immutable `ExtractedFact` observations.
- Reviewable `FactChange` semantic differences.
- Fact types for exam dates, application windows, result dates, and official URLs.
- Deterministic versioned extractor: `exam-dates-v1`.
- Raw value, normalized value, evidence, confidence, tentative state, and extractor version.
- Idempotent extraction and pending-change refresh.
- `HIGH`, `MEDIUM`, and `LOW` extraction confidence.
- Independent publication risk classification.
- Invalid dates and truncated bodies rejected before canonical writes.

### Canonical trust boundary

The canonical owner is `ExamEvent`, as documented in [CANONICAL-FACT-OWNERSHIP.md](CANONICAL-FACT-OWNERSHIP.md).

The approved flow is:

```text
Source
  -> SourceSnapshot
  -> ExtractedFact
  -> FactChange
  -> named human decision
  -> ExamEvent
  -> Outbox
  -> cache/page revalidation
```

The approval service:

- requires an authenticated reviewer;
- re-reads and locks the canonical event inside a transaction;
- rejects stale approvals;
- writes both date endpoints for a single-point date;
- records reviewer and reason;
- supersedes rival pending changes;
- emits `CACHE_REVALIDATE` in the same transaction;
- invalidates the affected cache after commit.

No fact has been manually written outside this workflow.

### Authentication and review access

- `POST /api/v1/auth/login` issues access tokens using the existing authentication middleware.
- `GET /api/v1/auth/me` exposes the authenticated principal and permissions.
- Password hashing uses the built-in Node `scrypt` implementation.
- Login failures use a consistent response and dummy-hash comparison for unknown accounts.
- Authentication rate limiting is wired.
- Staff password setup is operational through `pnpm admin:set-password`.
- Fact routes are authenticated and permission-gated.

### Fact review API and operator command

Existing API routes:

```text
GET  /api/v1/admin/fact-changes
GET  /api/v1/admin/fact-changes/:id
GET  /api/v1/admin/fact-changes/metrics
POST /api/v1/admin/fact-changes/:id/approve
POST /api/v1/admin/fact-changes/:id/reject
POST /api/v1/admin/fact-changes/:id/ignore
```

Added operational command:

```text
pnpm facts:review
```

The command is intentionally **read-only**. It displays the source URL, snapshot, fetch time, evidence, raw and normalized values, extractor version, canonical event, risk, confidence, and FactChange ID. Decisions remain exclusively behind the authenticated API.

### Product and SEO foundation

- Reusable exam route and section structure exists.
- Exam pages have honest missing-value behavior.
- Indexability is evaluated instead of assumed from route existence.
- Incomplete exam clusters are protected with `noindex, follow`.
- Sitemap generation excludes incomplete or fabricated exam pages.
- Canonical and metadata foundations exist.
- `/api/revalidate` exists and is connected to the outbox flow.
- Internal exam links were repaired to avoid linking to nonexistent pages.
- Production-only AdSense loading exists.

### Fixture safety

Synthetic paper, result, and content rows remain isolated as draft performance fixtures. They are not treated as student content.

- Fixture rows are `DRAFT`.
- Publish-time checks reject synthetic seed namespaces.
- Placeholder URLs are rejected.
- The integrity gate audits anything that becomes publishable.

This preserves the query-plan baseline without allowing fabricated pages to be published.

### Planning and product definition

- The Master Search Product Map exists and contains mapped student intents, product decisions, canonical owners, source strategies, indexability rules, acceptance tests, and dependencies.
- Cohorts are explicitly provisional because repository evidence measures fetchability, not search demand.
- The universal exam product direction and phase completion contract are documented.

## Current Pending Fact Changes

The live database currently contains six `PENDING_REVIEW` rows:

| Exam | Fact | Proposed value | Confidence | Recommended disposition |
|---|---|---:|---|---|
| JEE Advanced | `EXAM_DATE` | `2026-05-17` | HIGH | Review evidence, then approve if confirmed |
| GATE | `RESULT_DATE` | `2026-03-19` | HIGH | Review evidence, then approve if confirmed |
| GATE | `EXAM_DATE` | `2026-02-07/2026-02-15` | MEDIUM | Review the four listed exam dates and approve only if the window is intended |
| GATE | `APPLICATION_END` | `2025-10-07` | MEDIUM | Review the four candidate dates and confirm the deadline meaning |
| GATE | `APPLICATION_START` | `2025-08-28` | MEDIUM | Review the two candidate dates and confirm the opening meaning |
| CUET UG | `EXAM_DATE` | `2026-05-30` | HIGH | Review the evidence; the earlier proposal is now orphaned by extractor correction |

Important: the report can recommend a disposition, but it cannot approve one. A named authorized human must inspect the official evidence and use the API.

The CUET row is retained as audit history because the corrected extractor no longer produces that observation. GATE application values must not be guessed from competing statements.

## Validation Results

The following checks were run against the current repository and configured database on 2026-09-04:

```text
API tests                         238/238 passed
API typecheck                     passed
Web typecheck                     passed
Database typecheck                passed
Architecture checks               5/5 passed
Prisma schema validation           passed
Database migration status          up to date (6 migrations)
Integrity gate                    PASSED
Live integrity/sitemap audit      PASSED
Incomplete cluster pages          60/60 verified noindex
Live sitemap exam URLs            0 fake; 6 real-data URLs
Fake dates                        0
Fake official URLs                0
Fake conducting bodies            0
Placeholder domains               0
Fabricated fallback facts         0
```

### Validation limitation

The repository lint command is currently not runnable:

```text
ESLint couldn't find an eslint.config.(js|mjs|cjs)
```

`tooling/eslint-config/` contains the older shared configuration, but no tracked ESLint flat-config entry point exists. This predates the current work and is a separate maintenance task. Architecture checks and typechecks pass, but lint should be repaired before declaring the engineering baseline fully green.

The root Turbo wrappers are unreliable in this Windows/Corepack environment. Direct package commands through Corepack were used for the checks above.

## What Is Not Complete

### First real exam activation

JEE Advanced, GATE, and CUET UG still need verified identity data:

- conducting body;
- official website;
- concise factual overview;
- current cycle presentation;
- source/provenance display;
- useful next actions.

Approving dates alone does not make a useful page. Identity and minimum content must be verified before indexability can change.

### Exam product depth

The reusable route exists, but the product needs demonstrated, useful content for the priority cohort:

- overview;
- important dates;
- syllabus;
- exam pattern;
- eligibility;
- application;
- admit card;
- answer key;
- result;
- previous-year papers;
- official links;
- FAQs where evidence supports them.

Do not create thin subpages merely because the route is available.

### Paper product

Not complete:

- official document discovery;
- metadata extraction and validation;
- hashing and deduplication;
- permitted storage/reference strategy;
- paper browse/detail pages;
- verified download actions;
- paper SEO and tests.

The 3,000 draft fixture papers must not be published.

### Results and lifecycle

The result module and routes exist, but the complete student lifecycle is not proven across the priority cohort. Needed:

- authoritative result state;
- official result action;
- release-state presentation;
- lifecycle transitions for application, admit card, answer key, and result;
- provenance and route tests.

### Boards

Board routes and models exist, but priority coverage and useful content are incomplete. The first board cohort needs verified board, class, subject, syllabus, paper, result, date-sheet, and notice content before scale expansion.

### Universal search

Search backend infrastructure exists. The student-facing search experience, empty-state behavior, real indexed content, analytics, and zero-result feedback loop are not complete enough for V1.

### Editorial operations

The API supports fact review, but there is no complete admin console for facts, sources, papers, results, content, revisions, and audit history. The CLI is sufficient for the immediate fact activation; a console is a later product requirement.

### SEO measurement

Technical metadata and sitemap foundations exist. V1 still needs production measurement for crawl status, index coverage, Core Web Vitals, representative search journeys, and search demand validation.

## Exact Path To V1 Completion

### Phase 2: Production activation

Exit criteria:

1. A named reviewer decides all six pending FactChanges.
2. Approved values are written only through the approval API.
3. Rejected or ignored values retain audit reasons.
4. JEE Advanced, GATE, and CUET UG receive verified identity fields.
5. Each activated page has useful minimum content and source links.
6. Indexability is evaluated by the existing logic.
7. Integrity and live sitemap checks pass.
8. Representative routes return correct status, metadata, canonical, robots, structured data, and internal links.

### Phase 3: Major exam product cohort

Execute the existing Product Map, beginning with a bounded cohort rather than every exam.

For each selected exam, complete the data contract, page, API response, source/provenance, SEO behavior, tests, and student next action. Use Search Console or analytics to revise the provisional fetchability-based priority ranking.

Source-access blockers for JEE Main, NEET, SSC, CAT, NTA, and other JS/WAF/oversized sources should be tracked as a separate acquisition backlog and must not block work on accessible exams.

### Phase 4: Paper product

Build the real importer and student workflow:

```text
official discovery
    -> identify document
    -> normalize metadata
    -> validate source and ownership
    -> download or reference lawfully
    -> hash
    -> deduplicate
    -> store
    -> expose browse/detail/download product
```

Acceptance condition: no fixture paper is publishable, and every live paper has verified metadata and a working legitimate access path.

### Phase 5: Results and lifecycle

Make exam information lifecycle-driven. Validate application, admit card, answer key, result, and important-date states from authoritative sources, with honest unavailable and tentative states.

### Phase 6: Board product

Start with a small verified board cohort. Build board, class, subject, syllabus, papers, results, date sheet, notices, and useful internal navigation. Do not mass-generate chapter pages without content.

### Phase 7: Universal search

Complete the student-facing search page, index real entities, implement useful facets and empty states, and record zero-result queries. Validate search from the student journey, not only from the API.

### Phase 8: Editorial operations

Build the operator workspace around existing APIs and permissions. Prioritize fact queue, source/snapshot evidence, content review, publishing, revisions, and audit history.

### Phase 9: SEO expansion and measurement

Expand only pages with real demand and useful verified content. Measure indexing, crawl errors, Core Web Vitals, search impressions, clicks, and student completion of official actions.

### Phase 10: V1 completion audit

Declare V1 only when all selected commitments pass:

- major exam intents covered;
- board intents covered;
- paper searches work;
- result searches work;
- lifecycle information works;
- universal search works;
- provenance is visible;
- important changes require review;
- canonical updates are atomic;
- sitemap, robots, canonicals, structured data, and internal links work;
- thin pages remain controlled;
- editors can maintain the system;
- representative students can find an answer, verify it, take the official next action, and reach related content.

## Immediate Next Actions

1. Assign an authorized human reviewer.
2. Run `pnpm facts:review`.
3. Verify the six official evidence records.
4. Approve only confirmed values through the fact API.
5. Reject or ignore unresolved values with written reasons.
6. Add verified identity content for JEE Advanced, GATE, and CUET UG through the existing content workflow.
7. Run `pnpm gate:integrity --live` again.
8. Verify the three representative exam URLs manually on desktop and mobile.
9. Start the first bounded exam-product cohort from the existing Product Map.

## Final Decision

The architecture should now be frozen for this phase. Do not add another crawler, queue, event bus, search engine, fact model, ownership model, or AI layer.

The project has reached the transition point from **machinery** to **student product**. The next meaningful milestone is not another backend feature; it is three verified, useful exam pages that survive the integrity, indexability, and student-journey checks.
