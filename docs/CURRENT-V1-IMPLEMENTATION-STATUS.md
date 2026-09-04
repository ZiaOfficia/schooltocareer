# SchoolToCareer Current V1 Implementation Status

> **Authoritative current handoff:** See [PROJECT-COMPLETION-STATUS-2026-09-04.md](./PROJECT-COMPLETION-STATUS-2026-09-04.md) for the validated queue, checks, and remaining path to V1. This document retains the broader implementation history.

## Report Purpose

This document consolidates the current implementation status of SchoolToCareer against the master V1 execution prompt.

It distinguishes:

- completed implementation
- partial implementation
- planned work
- verified checks
- remaining limitations
- the next finite implementation steps

The repository is not greenfield. Existing infrastructure must be preserved and extended.

## Status at a glance (2026-09-04)

```text
Source monitoring                  COMPLETE
Semantic fact extraction           COMPLETE
ExtractedFact                      COMPLETE
FactChange                         COMPLETE
Fact review API                    COMPLETE
Reviewer authentication            COMPLETE
Atomic approval                    COMPLETE
Audit                              COMPLETE
Outbox/revalidation                COMPLETE
Integrity gate                     COMPLETE
Sitemap audit                      COMPLETE
Publish-time fixture protection    COMPLETE
Master Search Product Map          COMPLETE

Pending fact changes               6
Human dispositions                 PENDING
Exam activation                    IN PROGRESS

Admin UI                           NOT IMPLEMENTED
Paper importer                     NOT IMPLEMENTED
Board expansion                    FUTURE
Lifecycle product                  FUTURE
Universal search execution         FUTURE
```

## The review queue, after the GATE extractor fix

Extraction and semantic comparison were re-run against the stored snapshots.
Five of the six values changed or were confirmed; one is now orphaned.

| # | Exam | Fact | Value | Conf. | Recommended |
|---|---|---|---|---|---|
| 1 | JEE Advanced | `EXAM_DATE` | `2026-05-17` | HIGH | **approve** |
| 2 | GATE | `RESULT_DATE` | `2026-03-19` | HIGH | **approve** |
| 3 | GATE | `EXAM_DATE` | `2026-02-07/2026-02-15` | MEDIUM | **approve** — was `2026-02-07` |
| 4 | GATE | `APPLICATION_END` | `2025-10-07` | MEDIUM | **verify, then approve if confirmed** — was `2025-09-25/2025-10-07` |
| 5 | GATE | `APPLICATION_START` | `2025-08-28` | MEDIUM | **verify, then approve if confirmed** — was `2025-08-25/2025-08-28` |
| 6 | CUET UG | `EXAM_DATE` | `2026-05-30` | HIGH | **reject** — orphaned |

Every value agrees with the official page, including the weekday column it
prints beside each date.

**#6 is orphaned on purpose.** The corrected extractor no longer produces that
observation — it came from a rescheduling notice, not a schedule — so nothing
refreshes it and nothing will re-propose it. It stands as a stale proposal
awaiting a human rejection.

Note that rejection alone does not suppress a bad fact: a `REJECTED` row is not
`PENDING`, so the next detection pass would create a fresh change for the same
value. The extractor has to stop producing it, which is why the CUET fix is in
the parser rather than only in the queue.

All six still await a named human. Nothing here has been approved.

## Executive Verdict

The trust foundation is built. **The student-facing product is not, and it is
blocked on human review rather than on engineering.**

Complete and verified: source acquisition and history, the semantic fact engine,
canonical ownership, reviewer authentication, atomic approval with stale-version
protection, outbox revalidation, data-integrity and indexability safeguards, and
the search/product map.

Six pending `FactChange` rows await a named human decision, and nothing moves
until they are resolved.

**Resolving them does not by itself make any page indexable.** That framing
appeared in an earlier draft of this document and was wrong. Approving a date
populates `ExamEvent`; it does not supply `conductingBody`, `officialWebsite` or
an overview, and `evaluateIndexability` requires those. A page becomes
indexable only after identity, canonical event data, page completeness,
provenance and the indexability gate all pass — each on its own evidence.

The fact review is the first gate of several, not the last.

```text
six facts reviewed by a human
    -> exam identities verified and completed (separate evidence)
    -> page completeness and provenance
    -> indexability gate
    -> first indexable pages
    -> universal exam product across the cohort
    -> paper product
    -> results/lifecycle
    -> boards
    -> universal search
    -> editorial operations
    -> SEO measurement
    -> V1 completion audit
```

V1 must not be declared complete until the selected high-value student search
intents are served by useful, trustworthy, measurable pages and workflows.

## Current Git State

Current branch:

```text
feat/semantic-fact-engine
```

Two commits ahead of `main`:

```text
50df140  fix(web): stop linking to exam pages that do not exist
9f9d1cd  feat(facts): semantic fact engine, with the login needed to reach it
```

**The database is ahead of `main`.** The `20260904090000_semantic_facts`
migration has been applied and six `FactChange` rows exist. A checkout of
pre-merge `main` will find tables its code knows nothing about. Additive, so
harmless — but it is the reverse of the deploy-ordering lesson recorded in
`0d3435f`, so merge rather than leaving the branch parked.

## Completed Work

### 1. Phase 0 source acquisition

Completed and committed through the ingestion changes.

Implemented capabilities:

- `Source` model
- `SourceSnapshot` model
- source registry and seed configuration
- source repository
- source-fetch worker task
- robots.txt evaluation
- distinction between explicit robots disallow and unavailable robots.txt
- `ROBOTS_UNAVAILABLE` outcome
- verbatim robots/transport error recording
- ETag and Last-Modified conditional requests
- content normalization
- SHA-256 hashing
- historical source snapshots
- source status and failure tracking
- sequential polling and request delays
- source reports
- manual `pnpm sources:fetch`
- corrected official source URLs
- convergent source seeding
- obsolete sources retired as `DEAD`
- historical records preserved
- UTF-8-safe byte-based truncation
- 4 MB stored-body limit

The earlier false claim that several official sites had disallowed crawling was corrected. The system now distinguishes:

```text
robots.txt explicitly disallows us
    !=
robots.txt could not be read
```

### 2. Data-integrity protection

Implemented protections against fabricated or placeholder data.

The integrity checks cover:

- fake dates
- fake official URLs
- fake conducting bodies
- placeholder domains
- fabricated fallback facts
- unintentionally indexed incomplete content
- fake sitemap URLs

Latest integrity result:

```text
Fake dates:                  0
Fake official URLs:          0
Fake conducting bodies:      0
Placeholder domains:         0
Fabricated fallback facts:   0
Unintentionally indexed:     0
Sitemap fake URLs:            0

GATE PASSED
```

This is a completed trust improvement and must remain in the V1 pipeline.

### 3. SEO and indexability safeguards

Implemented:

- noindex behavior for incomplete exam records
- noindex behavior for exam cluster pages
- checks preventing unavailable pages from being advertised in the sitemap
- indexability validation
- safer handling of thin or incomplete content
- canonical and metadata foundations
- robots and sitemap generation

A route is not automatically considered indexable merely because it exists.

### 4. Revalidation architecture

Implemented:

```text
POST /api/revalidate
```

The endpoint supports:

- shared-secret validation
- tag revalidation
- path revalidation
- worker-to-Next.js communication
- cache/page invalidation integration

This closes the earlier gap where the worker expected a revalidation endpoint that did not exist.

### 5. Production-only AdSense loading

Implemented:

- AdSense loader component
- production-only loading
- SEO constants/configuration for advertising

Advertising does not load in non-production environments.

### 6. API and worker architecture

Existing and preserved:

- Express API
- feature modules
- repositories and services
- worker process
- periodic task framework
- outbox/event infrastructure
- structured logging
- validation
- authentication
- authorization
- error handling
- cache provider
- search provider abstraction

Existing modules include:

- blog
- board
- category
- exam
- health
- media
- question-paper
- result
- revision
- search
- slug
- source

### 7. Existing database foundation

Existing models include:

- `Exam`
- `ExamYear`
- `ExamEvent`
- `QuestionPaper`
- `QuestionPaperFile`
- `Result`
- `ContentEntry`
- `ContentDraft`
- `ContentRevision`
- `Source`
- `SourceSnapshot`
- `Outbox`
- authentication and user models

The existing canonical models must be inspected before adding new fields or duplicate models.

## Partially Completed Work

### 1. Frontend exam product

Current route surfaces include:

- `/`
- `/exams`
- `/exam/[slug]`
- `/exam/[slug]/[section]`
- `/blog`
- `/boards`
- `/previous-year-papers`
- `/results`
- `/api/revalidate`

The exam cluster exists, but the complete V1 exam product is not yet demonstrated for selected priority exams.

Remaining quality requirements include:

- complete official data
- current lifecycle state
- authoritative dates
- official action links
- source/provenance display
- useful content depth
- page-specific tests
- mobile student journey
- production route verification
- search-intent validation

### 2. Backend search

The API has a search module and search-provider abstraction.

However, the current web route inventory does not show a dedicated:

```text
apps/web/src/app/search/page.tsx
```

Therefore:

```text
Search backend: present
Universal student-facing search product: incomplete
```

### 3. Results and lifecycle

The result module and results page exist, but a complete lifecycle product has not yet been proven across priority exams.

Still needed:

- lifecycle state handling
- authoritative result status
- official result action
- release-state presentation
- provenance display
- result-specific tests
- complete student journey validation

### 4. Board product

The board module and boards route exist, but the full board product is incomplete.

Still needed:

- priority board coverage
- classes
- subjects
- syllabus
- papers
- results
- notices
- meaningful chapter resources
- content-based indexability
- board-specific SEO validation

### 5. Editorial foundation

The repository already has:

- authentication
- authorization
- permissions
- content drafts
- revisions
- publishing concepts
- scheduling concepts
- audit/event foundations

The fact-review API and read-only `pnpm facts:review` operation now exist. A
complete operational editorial console does not yet exist.

## Completed in Phase 1 + 2A (2026-09-04)

### 1. Master search/product map — DONE

[`SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP.md`](./SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP.md)
now carries all required columns for 15 mapped intents, each with a product
decision (including explicit *no page* decisions), canonical owner, source
strategy, index/noindex rule, acceptance test and named blocking dependency.

### 2. Tier A/B/C prioritization — DONE (provisional)

Cohorts are selected on **measured source fetchability**, the one axis for which
evidence exists. No search-volume data is present in this repository, so the
ranking is labelled:

```text
PROVISIONAL — repository/product evidence
Validation required: Search Console or analytics
```

```text
Tier A  GATE, JEE Advanced, CUET UG      readable source, facts extracted
Tier B  SBI PO, CAT                      source fetches, yields nothing usable
Tier C  JEE Main, NEET UG, UPSC, SSC ...  no readable body — blocked on fetch
```

The headline finding: **JEE Main and NEET UG have no readable official source
today.** Their NTA subdomains have never returned a body. GATE, with far lower
search demand, is the most productive page on the watch list because it
publishes a labelled `IMPORTANT DATES` table in server-rendered HTML. A cohort
picked on assumed demand would have started with a page that has nothing on it.

### 3. Semantic fact engine — DONE

Implemented in `packages/database/prisma/schema/facts.prisma` and
`apps/api/src/modules/fact/`:

- `ExtractedFact` (observation) and `FactChange` (semantic difference)
- `FactType`, `FactConfidence`, `FactRisk`, `FactChangeKind`, `FactReviewStatus`
- deterministic extractor, versioned `exam-dates-v1`, no LLM
- raw + normalised value, evidence with every rival candidate, extractor version
- confidence (extraction certainty) kept **separate** from risk (publication impact)
- idempotency via `@@unique([snapshotId, ownerId, factType])`
- stale-approval protection via `canonicalVersion` re-checked inside the transaction

The system can now answer the question it could not before:

```text
The exam date changed from 23 June to 24 June.
```

Canonical ownership was resolved by reading the schema and is documented in
[CANONICAL-FACT-OWNERSHIP.md](./CANONICAL-FACT-OWNERSHIP.md). **No column was
added to store a fact.** `Exam.examDate` was explicitly rejected and does not
exist.

### 4. Fact extraction pipeline — DONE

```text
newest CHANGED SourceSnapshot (bound to exactly one exam)
    -> refuse if truncated / no body / JS shell
    -> label-anchored deterministic extraction, both directions
    -> validate (impossible dates rejected and counted)
    -> normalise to ISO
    -> compare against the canonical ExamEvent
    -> FactChange, only where the value actually differs
```

Verified against real stored snapshots. An unchanged normalised value produces
no change however much the surrounding markup moved; a truncated body is refused
outright rather than parsed as complete.

### 5. Fact review workflow — DONE (API); admin UI still absent

The API exposes the queue, evidence, old/proposed values, confidence, risk,
reviewer identity, decision reason and timestamps. There is still **no admin
console UI** — review is currently done through the API and `pnpm facts:report`.

### 6. Approval integration — DONE

One transaction: lock and re-check the canonical row's version → refuse on
mismatch → write `ExamEvent` → record reviewer and reason → supersede rivals →
enqueue `CACHE_REVALIDATE`. A stale approval is rejected and the change is left
`PENDING_REVIEW` so the next pass re-diffs it against current truth.

### 7. Fact API — DONE

```text
GET  /api/v1/admin/fact-changes
GET  /api/v1/admin/fact-changes/:id
GET  /api/v1/admin/fact-changes/metrics
POST /api/v1/admin/fact-changes/:id/approve
POST /api/v1/admin/fact-changes/:id/reject
POST /api/v1/admin/fact-changes/:id/ignore
```

Uses the existing authenticate/authorize/validate/DTO conventions. Two new
permissions: `fact:review` and `fact:approve`, split for the same reason as
`exam:manage` / `exam:publish`. **No public route exists by design** — a pending
change is an unverified claim. All endpoints verified returning 401 unauthenticated.

### 8. Fact worker task — DONE

`extract-facts` registered as a second **stage on the existing
`PeriodicTaskRunner`**, alongside `fetch-sources`. No second worker process, no
second queue, no new transport.

### 9. JEE Advanced end-to-end trust flow — DONE

`fact.service.test.ts` drives the mandated fixture from two different page
bodies (23 June → 24 June, application deadline untouched) and asserts the whole
chain: two snapshot bodies → observation → critical pending `FactChange` → **no
change for the unchanged deadline** → approval → canonical `ExamEvent` write →
exactly one outbox event.

The same pipeline has been run against production data and produced six real
pending changes from official sources.

### 10. Paper importer

The existing paper models are present, but the reusable importer is missing.

Required future flow:

```text
discover
    -> identify
    -> extract metadata
    -> validate
    -> download or reference
    -> hash
    -> deduplicate
    -> store
    -> expose to frontend
```

### 11. Paper product UX

The paper browse/download product is not complete.

Still needed:

- year/session/shift/subject navigation
- verified metadata
- official source display
- permitted storage strategy
- reliable access action
- paper search discoverability
- paper page SEO

### 12. Complete editorial/admin console

No complete operational console currently exists for:

- sources
- facts
- fact changes
- papers
- results
- content
- revisions
- audit history

### 13. Fact observability metrics — DONE

`GET /api/v1/admin/fact-changes/metrics` and `pnpm facts:report` report
observations by type, changes by status, pending by risk, and the age of the
oldest pending CRITICAL change. The extraction task reports per pass:
observations, changes, critical, invalid, truncated, silent.

Kept deliberately **separate** from `pnpm sources:report`: that answers "which
pages change, and how often" (a crawling question); this answers "which facts
changed, and who has not looked at them" (an editorial one).

## Reviewer authentication — added as a prerequisite, not a phase

The fact-review API was correctly gated behind `authenticate()`, and **nothing
in the codebase could issue a token**: there was no auth module, nothing was
mounted at `/api/v1/auth`, and the only user row carries
`SEED_PLACEHOLDER_NOT_A_VALID_HASH` — its own seed comment says it exists "so
authored content has an author, not so anyone can sign in with it". The approval
path was unreachable by any human.

The smallest slice that fixes that, and nothing more:

```text
POST /api/v1/auth/login    credentials -> access token
GET  /api/v1/auth/me       token       -> principal and permissions
```

- Signs the token the **existing** `authenticate()` middleware verifies; the
  `can()` / `permissionsForRole` system is untouched.
- Passwords hashed with `node:crypto` **scrypt** (N=32768, r=8, p=1). No native
  dependency added — argon2 and bcrypt would have put a compiler in the deploy
  for one endpoint. The stored format carries its own parameters
  (`scrypt$N$r$p$salt$hash`) so the cost can be raised later without
  invalidating existing hashes.
- One error for every failure mode, plus a dummy hash comparison for unknown
  accounts, so the endpoint is not a user-enumeration oracle. Verified live:
  unknown account and the seeded admin both return 401, identically.
- `rateLimitPresets.auth` (10 attempts / 15 min) already existed for this
  endpoint and had no caller. Now wired. Verified live: 401 ×7 then 429.

**Deliberately absent:** registration, password reset, refresh tokens, logout,
OAuth, MFA, admin UI. `Session` and `refreshSchema` remain unused — an access
token is enough to reach the review queue, and a session store is a revocation
design, not a login one.

Staff passwords are set operationally with `pnpm admin:set-password`, which
reads from the TTY with echo off — never argv, never an environment variable,
never stdin from a pipe — and writes only the hash. The seed placeholder stays
invalid.

## Seeded fixtures: isolated, not deleted

`QuestionPaper` holds 3,000 fabricated rows ("Question Paper 1582 — 2026") with
media on `cdn.example.test`, plus 200 fabricated `Result` rows and 300
`ContentEntry` rows. All are `DRAFT`, and the integrity gate cannot see them
because it only inspects what a student could read.

**They are kept deliberately.** They are the dataset the index design was
measured against — `001_raw_constraints.sql` sizes `idx_paper_live_year` against
"all 3,000 seeded rows", and `pnpm db:plans` reads them. Deleting them would
throw away the performance baseline. This is the brief's "isolate it explicitly
as test/fixture data" case, not its "remove it" case.

Isolation is now three layers deep:

1. every fixture row is `DRAFT`, so no student can reach one
2. **`assertPublishable` refuses them at the moment of publish** (new)
3. the integrity gate audits whatever did become published

Layer 2 was the missing one, and it closes a real landmine: a bulk publish would
have put 3,000 pages live promising downloads that resolve to a reserved TLD,
with nothing warning anyone first.

The check is by **id namespace**, not by URL. Every synthetic row carries
`seed_<kind>_<key>` and nothing an editor creates can. That distinction is
load-bearing: `pnpm data:purge-placeholder` has already NULLed the fabricated
`officialUrl`s, so a URL-only guard caught **0 of 200** seeded results when
measured against the live database. By id: **200 of 200**, and **3,000 of
3,000** papers. `isPlaceholderUrl` is retained alongside it to catch a bad link
pasted by hand into a genuine row.

Verified against the live database after the change:

```text
DRAFT papers  3000: blocked 3000, would publish 0
DRAFT results  200: blocked  200, would publish 0
```

## Recommended V1 Roadmap

```text
Phase 0  Verify and preserve foundation
Phase 1  Student search intent and product map
Phase 2  Universal exam product
Phase 2A Semantic trust and fact engine
Phase 3  Previous-year paper product
Phase 4  Results and exam lifecycle
Phase 5  Priority board product
Phase 6  Universal search and discovery
Phase 7  Editorial and operations
Phase 8  SEO scale and measurement
Phase 9  V1 completion audit
V1      Declare completion
V1.1+   Tools, intelligence, expansion, optimization
```

Do not create more foundational phases without a concrete blocker and explicit approval.

## Recommended Next Steps

### Step 1: Create the search/product map

Create:

```text
SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP
```

Start with student questions, not URLs.

Examples:

- JEE Main exam date
- JEE Main application form
- JEE Main syllabus
- JEE Main eligibility
- JEE Main previous-year papers
- JEE Main result
- NEET syllabus
- UPSC eligibility
- SSC CGL application form
- CBSE Class 10 Maths syllabus

For each intent, decide whether it needs:

- an existing page
- a section
- a dedicated page
- a tool
- a download
- editorial content
- no page

### Step 2: Define priority cohorts

Select a limited first group of Tier A exams and boards based on evidence.

Do not make every exam equally deep on day one.

### Step 3: Define final V1 page inventory

For each selected intent, specify:

- URL
- page type
- required fields
- source strategy
- canonical owner
- index/noindex
- internal links
- SEO requirements
- acceptance test

### Step 4: Verify canonical ownership

Before building fact comparison, determine the actual owner of each fact:

| Fact | Canonical owner to verify |
|---|---|
| Exam date | `ExamEvent`, `ExamYear`, or equivalent |
| Application window | event or exam-year record |
| Result date | `Result` or equivalent |
| Application URL | existing exam/source/link field |
| Result URL | result or official-link field |

Do not automatically add `Exam.examDate`.

### Step 5: Build the universal exam product

Implement reusable exam templates and put the first 3-5 priority exams through them.

A completed page must combine:

```text
data
+ API
+ page
+ SEO
+ source/trust
+ student usefulness
```

### Step 6: Implement the fact engine

Implement:

1. fact observation schema
2. FactChange schema
3. deterministic extractors
4. value normalization
5. validation
6. canonical comparison
7. confidence and risk
8. idempotency
9. extraction worker stage
10. approval transaction
11. outbox/revalidation integration
12. JEE Advanced end-to-end test

### Step 7: Build papers, results, boards, search, and operations

Proceed in the defined phase order. Each phase must have a student-facing acceptance test.

## Semantic Trust Engine Requirements

### Observation model

Use one model named `ExtractedFact` unless repository inspection proves another name is more appropriate.

An observation should retain:

- source ID
- snapshot ID
- entity type
- entity ID
- fact type
- raw value
- normalized value
- confidence
- risk
- evidence
- extractor version
- extraction timestamp

### FactChange

A change should support:

- `ADDED`
- `CHANGED`
- `REMOVED`

Review states should support:

- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `IGNORED`
- `SUPERSEDED` where necessary

Do not persist unchanged rows unless audit requirements justify them.

### Initial fact types

Start with:

- `EXAM_DATE`
- `APPLICATION_START`
- `APPLICATION_END`
- `RESULT_DATE`
- `OFFICIAL_APPLICATION_URL`
- `OFFICIAL_RESULT_URL`

Add other types only after the first flow is reliable.

### Confidence and risk

Confidence means extraction certainty:

- `HIGH`
- `MEDIUM`
- `LOW`

Risk means publication impact:

- `CRITICAL`
- `HIGH`
- `MEDIUM`
- `LOW`

A high-confidence exam-date change is still critical and requires review.

### Required trust rules

- source change is not automatically a fact change
- deterministic extraction before AI
- evidence is retained
- provenance is complete
- truncated snapshots are not parsed as complete
- invalid values cannot update canonical truth
- low-confidence observations cannot silently publish
- high-risk changes require review
- stale approvals are rejected or re-reviewed
- repeated processing is idempotent
- extraction failure leaves canonical data unchanged

## What Must Not Be Added During V1

Do not add the following merely because they may be useful later:

- LLM extraction
- AI-generated content
- embeddings
- RAG
- vector databases
- Redis
- Kafka
- microservices
- second queue
- second event bus
- second crawler
- Meilisearch migration without evidence
- multi-site architecture
- translation platform
- college database
- careers/jobs ecosystem
- rank predictors
- question-level intelligence
- mass chapter-page generation
- manual entry of thousands of PDFs
- endless architecture refactoring

These belong to V1.1, V2, expansion, or optimization unless the search/product map proves otherwise.

## Phase Completion Contract

Every phase must define:

- input
- student problem
- target search intent
- output
- required data
- source strategy
- API requirements
- page requirements
- SEO requirements
- tests
- observability
- acceptance criteria
- stop condition
- exact next phase

A phase is complete when its acceptance criteria pass.

After completion:

- bug fixes are maintenance
- content updates are operations
- new product capabilities belong to a later version
- optional improvements do not reopen the phase

## V1 Completion Gate

Declare:

```text
SCHOOLTOCAREER V1 COMPLETE
```

only when all selected V1 commitments pass.

### Product

- selected major exam intents are covered
- selected board intents are covered
- important paper searches work
- important result searches work
- lifecycle information works where relevant
- universal search works

### Trust

- sources are monitored
- snapshots are preserved
- semantic facts are extracted
- changes are detected
- confidence is assigned
- risk is assigned
- provenance is visible
- important changes require review
- canonical updates are atomic
- outbox events are emitted
- revalidation works
- audit history is retained
- retries are idempotent
- failures do not corrupt canonical truth

### SEO

- metadata works
- canonical URLs work
- sitemap works
- robots works
- structured data works
- internal links work
- index/noindex strategy works
- thin pages are controlled
- crawl and 404 monitoring works
- Core Web Vitals are measured

### Operations

- editors can review facts
- editors can approve, reject, and ignore changes
- content can be maintained
- sources can be managed
- audit history is available

### Student journey

A student can:

- arrive from a representative search
- understand the answer immediately
- locate the official source
- complete the next action
- find a related page
- access a paper or result
- use search
- distinguish confirmed, tentative, and unavailable information

## Verification Matrix

After each major phase, run the applicable checks.

### Tests

- focused tests
- full API tests
- worker tests
- frontend tests
- mandatory end-to-end tests

### Typechecks

- all packages with typecheck scripts

### Database

- Prisma validation
- migration status
- foreign keys
- unique constraints
- indexes
- enum values
- idempotency constraints
- query plans where appropriate

### Architecture

- architecture checks
- dependency boundaries
- transaction rules

### Production

- build
- deployment checks
- route checks
- API checks
- worker checks
- source checks

### SEO

- metadata
- canonicals
- robots
- sitemap
- structured data
- redirects
- indexability

### Product

- manual student journey
- application-link action
- official-link action
- paper access
- result access
- internal search
- zero-result behavior

### Phase 0 regression

Keep verifying:

- robots allowed
- robots disallowed
- robots unavailable
- WAF/403
- DNS failure
- TLS failure
- malformed URL
- conditional request
- unchanged source
- changed source
- historical source preservation
- UTF-8-safe truncation

## Current Verification Results (2026-09-04)

```text
Package typechecks (direct):       passed (API, web, database, tooling)
Full API tests:                   238/238 passed
Architecture checks:              5/5 passed
Prisma validation:                passed
Prisma migration status:          6 migrations, up to date
Database constraints:             18 applied, 0 failed  (was 17; +uq_factchange_open)
PostgreSQL:                       18.6
Integrity gate:                   PASSED — all seven counts zero
Web production build:             SUCCEEDED, including sitemap prerender
```

### The build dependency is resolved, not worked around

The previously reported `ECONNREFUSED` during sitemap prerender had two causes,
both now fixed:

1. `apps/web/.env` did not exist at all, so `API_BASE_URL` was unset.
2. The API must be running, because `sitemap.ts` deliberately does **not**
   try/catch its `listExams` call — a fallback that emitted a six-URL sitemap
   for a site with thousands would read to Google as mass removal.

Documented build procedure: start the API on :4000, then
`pnpm --filter @stc/web build`. Verified end to end; the build now emits all 12
routes including `/sitemap.xml`.

### Lint is NOT runnable — pre-existing

```text
pnpm --filter @stc/api lint  ->  ESLint couldn't find an eslint.config.(js|mjs|cjs)
```

`tooling/eslint-config/` ships `index.js` and `layers.js`, but **no package in
the repository has ever had an `eslint.config.js`** — confirmed against git;
none is tracked. This predates this phase and was not introduced by it. The
layer rules that config would enforce are separately covered by
`pnpm arch:check`, which passes 5/5. Fixing lint is its own task and would
likely surface pre-existing violations across 219 files.

### Windows/Corepack

Root Turbo wrappers are unreliable here (Turbo cannot resolve pnpm through
Corepack). Everything above was run as **direct package commands through Corepack
pnpm**, which is the authoritative fallback. No claim is made that any Turbo
wrapper passed.

## Final Status

```text
Phase 0 Foundation:                  Complete
Production/SEO safeguards:            Complete (3 dead-link defects fixed)
Phase 1 Search Product Map:           COMPLETE
Phase 2 Universal Exam Product:       Complete as ENGINEERING; awaiting data
Phase 2A Fact Engine:                 COMPLETE
Phase 3 Paper Product:                Not started
Phase 4 Results/Lifecycle:            Partial
Phase 5 Board Product:                Partial
Phase 6 Universal Search:             Partial backend, frontend incomplete
Phase 7 Editorial Operations:         API complete, admin console absent
Phase 8 SEO Scale:                    Foundation complete, scale blocked on data
Phase 9 V1 Audit:                     Not started
SchoolToCareer V1:                    NOT COMPLETE
```

### Why Phase 2 is "complete as engineering, awaiting data"

The reusable exam product renders overview, lifecycle dates, application,
admit card, answer key, result, papers, provenance and official-source blocks
from canonical data, for any exam, with honest unavailable states and correct
noindex gating. Every internal link resolves.

It currently displays almost nothing, because `ExamEvent` held **zero rows**
when this phase began and every exam's `conductingBody`, `officialWebsite` and
`overview` are NULL. That is a content and source problem, not a product one,
and no further engineering changes it. Six real official facts are now waiting
in the review queue; approving them plus completing three exams' identity fields
is what turns the first pages on.

## Final Conclusion

The project should now move from infrastructure preservation into finite, product-led delivery.

The highest-value next sequence is:

```text
Master search/product map
    -> priority exam and board cohorts
    -> reusable exam product
    -> semantic trust engine
    -> paper product
    -> results/lifecycle
    -> board product
    -> universal search
    -> editorial operations
    -> SEO measurement
    -> V1 completion audit
```

The project must not return to an endless foundation loop.

When the selected V1 acceptance criteria pass, declare V1 complete. More possible exams, pages, tools, or infrastructure belong to later maintenance or versions.
