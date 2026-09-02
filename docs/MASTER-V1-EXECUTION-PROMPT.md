# SchoolToCareer Master V1 Execution Prompt

## Purpose

Use this document as the authoritative implementation prompt for SchoolToCareer.

It combines:

- the verified repository baseline
- the completed Phase 0 work
- the product-first V1 direction
- the remaining implementation requirements
- the safeguards needed to preserve accuracy and provenance
- the finite acceptance gates that prevent an endless project loop

This is an execution prompt, not a request to redesign the whole system.

## Mission

Build SchoolToCareer into a trusted, search-first education platform for Indian students.

A student should be able to arrive from Google, find an accurate answer about an exam, board, paper, result, syllabus, application, eligibility, date, or official update, trust the information, and complete the next action.

The objective is not to maximize:

- database models
- URLs
- infrastructure
- AI features
- abstractions
- services
- page count

The objective is to own deliberately selected, high-value student search intents with useful, accurate, fast, and maintainable products.

## Product Principle

Every major feature must follow:

```text
Student search intent
    -> student problem
    -> search opportunity
    -> useful page
    -> reliable data
    -> official source
    -> editorial trust
    -> SEO measurement
    -> product improvement
```

Before implementing a feature, answer:

1. What student problem does this solve?
2. What search intent does this serve?
3. What authoritative data does it require?
4. What is the page, API, or workflow output?
5. How will success be measured?
6. What is the stop condition?

## Non-Negotiable Rules

### Rule 1: Preserve existing systems

This repository is not greenfield. Inspect before modifying and extend existing abstractions.

Do not rebuild a working:

- source-acquisition system
- source registry
- source-fetch task
- robots implementation
- conditional-request implementation
- normalization or hashing implementation
- snapshot history
- worker
- outbox
- logger
- validation system
- authentication system
- authorization system
- API module pattern
- Prisma architecture
- search provider abstraction
- metadata or revalidation system

### Rule 2: Never overwrite important history

Do not destroy or rewrite historical source snapshots, source outcomes, fact observations, changes, approvals, or audit records.

When a correction is required:

- preserve the original record
- add a migration or append-only correction where appropriate
- record the reason
- keep the old and new values auditable
- never use destructive Git operations
- never revert unrelated user changes

### Rule 3: Do not create duplicate concepts

Before adding any model, enum, route, service, task, permission, event, or abstraction:

1. search the repository
2. search Prisma schemas
3. search constants
4. search existing modules
5. search worker tasks
6. search tests
7. identify the canonical existing concept
8. extend it when possible

### Rule 4: Accuracy beats freshness theater

Never invent:

- exam dates
- application dates
- result dates
- eligibility requirements
- fees
- cutoffs
- official URLs
- notifications
- announcements
- expected dates presented as facts

When official information is unavailable, show an honest state such as:

```text
Not officially announced yet.
```

Missing information is not automatically an official `NOT_ANNOUNCED` fact.

### Rule 5: Source change does not equal fact change

A changed HTML page is not automatically a changed educational fact.

The system must distinguish:

```text
content hash changed
    !=
semantic fact changed
```

### Rule 6: Important facts require review

Critical and high-risk facts must not be automatically published without editorial approval.

### Rule 7: Avoid speculative infrastructure

Do not add Redis, Kafka, Elasticsearch, Meilisearch, vector databases, embeddings, microservices, a second event bus, a second queue, or a second crawler unless a measured production requirement proves the existing architecture cannot satisfy the need.

### Rule 8: Do not mass-generate thin pages

A route is not automatically an indexable page. Every page needs meaningful search intent, useful content, appropriate canonicalization, correct index/noindex behavior, and a clear student purpose.

### Rule 9: Keep product and trust work connected

The trust engine must support useful student-facing pages. It must not become an isolated infrastructure project with no end-to-end product acceptance test.

### Rule 10: Finish defined V1

Once the agreed V1 acceptance criteria pass, declare V1 complete. Future work becomes maintenance, content operations, V1.1, V2, expansion, or optimization.

Do not reopen V1 merely because more pages or features could theoretically be built.

## Verified Repository Baseline

The following Phase 0 work is already implemented and must be preserved.

### Source acquisition

- `Source` model
- `SourceSnapshot` model
- source registry and seed configuration
- source repository
- source-fetch worker task
- robots.txt evaluation
- explicit disallow versus unavailable robots classification
- ETag and Last-Modified conditional requests
- content normalization
- SHA-256 hashing
- historical snapshots
- source status and failure tracking
- sequential polling and request delays
- source reports
- manual `pnpm sources:fetch`
- corrected official source URLs
- convergent source seeding
- retired sources marked `DEAD` without deleting history
- UTF-8-safe byte-based truncation
- 4 MB stored-body limit

### Platform infrastructure

- PostgreSQL and Prisma
- Express API
- authentication and authorization
- permission constants and shared authorization helper
- worker process
- periodic task framework
- outbox/event infrastructure
- structured logging
- request validation
- error handling
- metadata and revalidation foundations
- Exam, ExamYear, ExamEvent, Result, QuestionPaper, and QuestionPaperFile models
- content draft and revision models
- search provider abstraction
- existing API module conventions
- Next.js application architecture
- deployment configuration
- architecture checks

### Verified Phase 0 checks

The verified baseline includes:

- focused source-fetch tests: 17/17 passed
- full API tests: 139/139 passed
- direct package typechecks: all packages with typecheck scripts passed
- architecture checks: 5/5 passed
- Prisma schema validation: passed
- database constraints: 17 applied, 0 failed
- PostgreSQL version: 18
- Prisma migration status: up to date
- current source report: 0 sources genuinely disallowed by robots.txt

Root Turbo wrappers may have a Windows/Corepack package-manager resolution limitation. Do not claim Turbo passed unless it actually passes. Run direct package commands through Corepack pnpm and report the wrapper limitation separately.

## Current Gaps

The following work remains incomplete:

- master search/product map
- final Tier A/B/C exam prioritization
- final V1 page inventory
- universal exam product completion
- semantic fact observation model
- FactChange model
- deterministic fact extraction
- normalization and validation for extracted facts
- canonical comparison
- confidence and risk classification
- idempotent semantic processing
- editorial review workflow
- approval, rejection, and ignore operations
- atomic canonical updates
- fact-related outbox events
- stale approval protection
- fact observability metrics
- JEE Advanced end-to-end trust flow
- reusable paper importer
- paper browse and download product
- results and exam lifecycle product
- priority board product
- universal search and search analytics
- minimal editorial/admin operations UI
- SEO scale and measurement
- final V1 completion audit

## V1 Phase Structure

Use these finite phases:

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
V1.1+   Tools, intelligence, expansion, and optimization
```

Do not create additional foundational phases without a concrete blocker and explicit approval.

## Phase 0: Foundation

### Objective

Lock the existing foundation and fix only real defects.

### Required behavior

- preserve all source-monitoring changes
- preserve historical source snapshots
- preserve source error classifications
- preserve the manual fetch command
- preserve UTF-8-safe truncation
- preserve migration ordering
- preserve worker and outbox ownership

### Stop condition

Phase 0 is closed when the existing verification baseline passes. Improvements after that are maintenance or bug fixes, not a reopened foundation phase.

## Phase 1: Master Search Product Map

### Objective

Define what students search for before generating large numbers of pages.

Create:

```text
SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP
```

### Required fields

Every map record should contain:

- exam, board, result, paper, or resource
- category
- student search intent
- priority: P0, P1, P2, or P3
- Tier A/B/C classification where applicable
- target URL
- page type
- required data
- canonical data owner
- official source strategy
- fact dependencies
- index/noindex decision
- SEO value
- CTR opportunity
- student value
- implementation status
- owner or next action

### Priority model

- `P0` — critical, high-intent student need
- `P1` — important supporting intent
- `P2` — useful long-tail intent
- `P3` — conditional, only when sufficient content exists

### Example intents

For a major exam, evaluate:

- exam date
- important dates
- notification
- application form
- registration
- application deadline
- application fee
- eligibility
- age limit
- attempts
- exam pattern
- syllabus
- admit card
- answer key
- result
- cutoff
- counselling
- admission
- previous-year papers
- question papers
- official website
- official notification
- information bulletin
- preparation
- FAQs

For each intent, decide whether it deserves:

- an existing page
- a section on another page
- a dedicated page
- a tool
- a document/download
- editorial content
- no page

### Stop condition

Phase 1 is complete only when:

- major exam families are mapped
- priority board families are mapped
- major intents are mapped
- every selected intent has a URL or explicit no-page decision
- every selected page has a type and data contract
- source strategy is defined
- index/noindex strategy is defined
- priorities are assigned
- the first implementation backlog is derived from the map

Do not start mass page generation before this map exists.

## Phase 2: Universal Exam Product

### Objective

Build one reusable exam product that supports many exams without special-case architecture.

The system should support, where justified:

- overview
- important dates
- syllabus
- exam pattern
- eligibility
- application
- admit card
- answer key
- result
- previous-year papers
- notification
- cutoff
- counselling
- FAQs and resources

### Tier A standard

Each selected Tier A exam should have, where applicable:

- useful overview
- current lifecycle state
- important dates
- syllabus
- pattern
- eligibility
- application
- admit card
- answer key
- result
- papers
- official links
- provenance
- internal links
- structured data
- mobile-friendly UX
- fast performance

### Product acceptance

A page is complete only when it combines:

```text
data
+ API
+ page
+ SEO
+ source/trust
+ student usefulness
```

A database row or API endpoint alone is not a completed product feature.

### Rollout

Use JEE Advanced as a reference implementation, then validate the reusable architecture across a small first cohort such as:

- JEE Main
- JEE Advanced
- NEET
- UPSC Civil Services
- SSC CGL
- CUET

The final order must come from the search/product map, not arbitrary preference.

## Phase 2A: Semantic Trust and Fact Engine

### Objective

Extend the existing source system so the platform can answer:

```text
What important educational fact changed?
```

### Required pipeline

```text
Official source
    -> existing SourceSnapshot
    -> changed and complete snapshot
    -> deterministic extraction
    -> ExtractedFact
    -> canonical comparison
    -> FactChange
    -> confidence and risk classification
    -> editorial review
    -> approve, reject, or ignore
    -> atomic canonical update
    -> outbox event
    -> cache/page/search revalidation
```

### Observation model

Use one clearly defined observation model:

```text
ExtractedFact
```

It represents an observation extracted from one source snapshot.

It should retain, according to repository conventions:

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
- created/extracted timestamp

Do not add both `OfficialFact` and `ExtractedFact` unless their responsibilities are explicitly different.

### FactChange model

`FactChange` represents a semantic difference that needs handling.

Support:

- `ADDED`
- `CHANGED`
- `REMOVED`

Support review states:

- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `IGNORED`
- `SUPERSEDED` where required by the final workflow

Retain:

- source and snapshot provenance
- entity identity
- fact type
- old value
- new value
- change type
- confidence
- risk
- evidence
- status
- reviewer
- reviewed timestamp
- decision reason
- audit timestamps

Do not create `UNCHANGED` rows unless there is a specific audit reason.

### Initial fact types

Begin with the smallest useful set:

- `EXAM_DATE`
- `APPLICATION_START`
- `APPLICATION_END`
- `RESULT_DATE`
- `OFFICIAL_APPLICATION_URL`
- `OFFICIAL_RESULT_URL`

Add other types only after the first flow is reliable:

- notification date
- admit-card date
- answer-key date
- application fee
- eligibility
- age limit
- attempts
- duration
- mode
- paper count
- counselling dates
- information bulletin

### Value representation

Use semantic types where appropriate:

- ISO dates for dates
- validated canonical URLs for URLs
- non-negative numbers for amounts, counts, and durations
- booleans for boolean facts
- structured JSON only where a structured value is genuinely required

Retain raw values and evidence separately from normalized values.

### Deterministic extraction

Do not add an LLM dependency in this phase.

Use:

- explicit labels
- headings
- tables
- nearby semantic context
- structured HTML
- JSON-LD
- known official notice structures
- validated URL patterns
- deterministic date parsing

Every extraction must identify its rule or extractor version.

### Confidence

Use:

- `HIGH`
- `MEDIUM`
- `LOW`

Confidence describes extraction certainty. It does not describe the danger of publishing the fact.

- high confidence: compare normally; high-risk changes still require review
- medium confidence: store and review
- low confidence: store the observation, but never update canonical truth automatically

### Risk

Risk describes the impact of an incorrect publication.

`CRITICAL`:

- exam date
- application deadline
- result date
- eligibility
- age or attempts
- official application URL
- official result URL
- major syllabus or pattern changes

`HIGH`:

- admit card
- answer key
- counselling
- application fee

`MEDIUM`:

- duration
- mode
- paper count

`LOW`:

- descriptive or non-material metadata

Critical and high-risk changes require editorial approval.

### Canonical ownership

Do not assume a field such as `Exam.examDate`.

Inspect the existing schema and document the actual owner for each fact type. It may be:

- `Exam`
- `ExamYear`
- `ExamEvent`
- `Result`
- an existing source/link field
- another canonical model

Do not add duplicate canonical fields merely to simplify the extractor.

### Comparison

If the normalized value equals the canonical value:

```text
no FactChange
```

If the value differs:

```text
canonical: 2026-06-23
extracted: 2026-06-24

FactChange:
  changeType: CHANGED
  oldValue: 2026-06-23
  newValue: 2026-06-24
  risk: CRITICAL
  status: PENDING_REVIEW
```

### Truncated snapshots

A snapshot with `rawTruncated = true` must not be parsed as complete.

It may be retained for audit, flagged for retry, or routed to another acquisition strategy.

### Idempotency

Repeated processing must not create duplicate:

- extracted facts
- fact changes
- review items
- canonical updates
- outbox invalidation events

Cover:

- worker retries
- repeated extraction
- duplicate change detection
- duplicate approval requests
- concurrent approval requests
- repeated event handling

Use database constraints and transactional checks wherever possible.

### Failure isolation

If fetching succeeds but extraction fails:

```text
SourceSnapshot stored
canonical truth unchanged
failure recorded
retry possible
```

If extraction produces an invalid value:

```text
observation rejected
canonical truth unchanged
```

### Atomic approval

Approval must:

1. verify the change is still pending
2. verify the expected old canonical value or version
3. update the correct canonical record
4. record reviewer, timestamp, and reason
5. mark the change approved
6. create the outbox event

These operations must succeed together or fail together.

### Stale approval protection

If the canonical record changes after a `FactChange` is created, an old approval must not overwrite the newer value.

Require re-review or reject the stale approval.

### Fact engine acceptance

The trust engine is not complete until the mandatory JEE Advanced fixture proves:

```text
source version A
    -> SourceSnapshot A
    -> extracted exam date
    -> canonical comparison

source version B
    -> changed SourceSnapshot B
    -> changed EXAM_DATE
    -> CRITICAL FactChange
    -> PENDING_REVIEW
    -> approval
    -> canonical update
    -> outbox/revalidation event
```

An unchanged application deadline in the same fixture must produce no change.

## Phase 3: Previous-Year Paper Product

### Objective

Build a reusable paper discovery and access product around the existing paper models.

### Import pipeline

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

### Required metadata

Where applicable:

- exam
- year
- session
- subject
- paper
- shift
- language
- paper type
- official source
- source URL
- file URL
- publication information
- verification status
- SHA-256 hash

### Rights and storage

Do not assume that a public PDF may be re-hosted.

Support:

- official link
- permitted hosted copy
- metadata-only representation

Always preserve source attribution.

### Product acceptance

A student should be able to find a paper, identify the exact year/session/shift/subject, and access the permitted file or official source quickly.

Do not create thin pages consisting only of a title and an unverified link.

## Phase 4: Results and Exam Lifecycle

Build results as a student product, not merely a database record.

Useful pages may include:

```text
/results/[exam]
/exam/[exam]/result
```

Only create both when they serve distinct search intents.

Support lifecycle states such as:

- `NOT_ANNOUNCED`
- `ANNOUNCED`
- `APPLICATION_OPEN`
- `APPLICATION_CLOSED`
- `ADMIT_CARD_AVAILABLE`
- `EXAM_COMPLETED`
- `ANSWER_KEY_AVAILABLE`
- `RESULT_AVAILABLE`
- `COUNSELLING`
- `COMPLETED`

Only display states and dates supported by official information.

## Phase 5: Priority Board Product

Start with a small priority set such as:

- CBSE
- UP Board
- ICSE

The final set must come from the search/product map.

Build reusable support for:

- board
- class
- subject
- syllabus
- exam pattern
- date sheet
- previous-year papers
- sample papers
- results
- notices
- resources
- useful chapters

Use content-based indexability:

```text
sufficient meaningful content -> INDEX
thin content                 -> NOINDEX, FOLLOW
```

## Phase 6: Universal Search and Discovery

Search across:

- exams
- boards
- papers
- results
- articles
- subjects
- approved resources

Start with the existing structured search provider. Add intent routing only as proven student behavior requires it.

Track:

- queries
- zero-result queries
- popular queries
- result clicks
- result position
- search-to-page transitions

## Phase 7: Editorial and Operations

Build a minimal operational console around existing content, permissions, authentication, validation, and revision systems.

Initial areas:

- sources
- facts
- fact changes
- content
- papers
- results
- revisions
- audit history

The fact review screen must show:

- entity
- fact
- old value
- proposed value
- risk
- confidence
- source
- snapshot
- fetched timestamp
- evidence
- reviewer actions

Provide approve, reject, and ignore operations with audit history.

Do not build a giant CMS before the narrow workflow is useful.

## Phase 8: SEO Scale and Measurement

Only scale after the core products are useful.

Every indexable page should have where appropriate:

- useful unique title
- useful meta description
- canonical URL
- correct heading structure
- breadcrumbs
- structured data
- internal links
- provenance
- meaningful content
- mobile performance
- correct index/noindex state

Measure:

- impressions
- clicks
- CTR
- average position
- indexed useful pages
- thin pages
- crawl errors
- 404s
- Core Web Vitals
- paper downloads
- official-link clicks
- application-link clicks
- result clicks
- internal searches
- zero-result searches

Do not use misleading clickbait.

## Phase 9: V1 Completion Audit

Perform a finite audit instead of opening another architecture phase.

### Exam checklist

For each selected priority exam, verify where applicable:

- overview
- dates
- syllabus
- pattern
- eligibility
- application
- admit card
- answer key
- result
- cutoff
- counselling
- papers
- official links
- provenance
- metadata
- internal links
- mobile performance
- indexability
- editorial review

### Paper checklist

- priority exams covered
- important years covered
- metadata correct
- sources verified
- duplicates controlled
- files validated
- access reliable
- search discoverability
- metadata and indexability correct

### Board checklist

- board page
- priority classes
- priority subjects
- syllabus
- papers
- results
- notices
- index/noindex control
- metadata
- internal links

### Trust checklist

- sources monitored
- snapshots preserved
- facts extracted
- changes detected
- confidence assigned
- risk assigned
- provenance available
- editorial approval works
- canonical updates atomic
- outbox emitted
- revalidation works
- audit trail works
- retries are idempotent
- failures do not corrupt canonical truth

### Student journey checklist

Manually verify that a student can:

- arrive from a representative Google search
- understand the page immediately
- locate the official source
- complete the next action
- navigate to related exam information
- find a paper or result
- use universal search
- distinguish confirmed, tentative, and unavailable information

## Explicitly Deferred Beyond V1

Unless the search/product map proves a requirement, defer:

- LLM extraction
- AI-generated content
- embeddings
- RAG
- vector databases
- Redis
- Kafka
- Meilisearch migration
- microservices
- multi-site architecture
- translation systems
- colleges
- courses
- careers
- scholarships
- jobs
- rank predictors
- personalized recommendations
- question-level analytics
- question intelligence
- large-scale chapter-page generation
- manual population of thousands of PDFs

These are future V2, V3, expansion, or optimization work. They are not reasons to delay V1.

## Required Implementation Discipline

For every phase, define:

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

Implement in this order inside each phase:

```text
1. Inspect
2. Identify reusable infrastructure
3. Confirm canonical ownership
4. Define the smallest data model
5. Define API and page contracts
6. Implement
7. Add focused tests
8. Add observability
9. Run migrations safely
10. Verify behavior
11. Measure
12. Close the phase when acceptance passes
```

## Required Verification

After each major phase, run relevant checks:

### Tests

- focused tests
- full API tests
- worker tests
- frontend tests where applicable
- mandatory end-to-end tests

### Typechecking

- all packages with typecheck scripts

### Database

- Prisma validation
- migration status
- migrations
- foreign keys
- unique constraints
- indexes
- enum values
- query plans where appropriate

### Architecture

- existing architecture checks

### Production

- build
- deployment checks
- route checks
- source checks
- API checks
- worker checks

### SEO

- metadata
- canonical URLs
- robots
- sitemap
- structured data
- indexability
- redirects

### Product

- manual student journey
- official-link action
- paper access
- result access
- internal search
- zero-result behavior

## Required Final Report

Every completed phase must end with a concise technical report containing:

1. What was built
2. What already existed and was reused
3. Exact files/modules changed
4. Database changes
5. API changes
6. Frontend changes
7. Worker changes
8. Source and provenance impact
9. SEO impact
10. Student impact
11. Performance impact
12. Tests and exact results
13. Remaining limitations
14. Exact next phase
15. Whether the phase is closed

Never claim completion based only on created models, routes, or tests.

## Anti-Loop Rule

This rule is mandatory:

```text
When a phase's acceptance criteria pass, mark the phase complete and move on.
```

Bug fixes, content updates, small improvements, and operational maintenance do not reopen a completed phase.

New requirements belong to:

- maintenance
- content operations
- V1.1
- V1.2
- V2
- expansion
- optimization

There will always be more possible pages, tools, exams, and infrastructure. That is not evidence that the defined V1 is unfinished.

## Immediate Next Deliverables

1. Create `SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP`.
2. Create the V1 page specification from that map.
3. Create the Tier A/B/C exam and board matrix.
4. Define canonical ownership for the first fact types.
5. Select the first 3-5 exam products.
6. Build the universal exam product against real student intents.
7. Implement the semantic trust engine with JEE Advanced as the reference fixture.
8. Connect one approved fact to one useful student-facing exam page.
9. Measure the student journey before expanding coverage.

## Final V1 Definition

Declare:

```text
SCHOOLTOCAREER V1 COMPLETE
```

only when:

- selected major exam intents are covered
- selected board intents are covered
- important paper searches work
- important result searches work
- universal search works
- important facts have provenance
- high-risk changes require review
- approval updates canonical truth atomically
- outbox and revalidation work
- editors can maintain the system
- SEO infrastructure is operational
- thin pages are controlled
- production is reliable
- real measurement is available
- the manual student journey succeeds

The final product is not “everything that could ever be built.” It is the smallest complete, useful, trustworthy, measurable SchoolToCareer product that serves the high-value intents deliberately chosen in the master search/product map.

## Final Command

Build SchoolToCareer as a student-search-first product, not as an infrastructure project.

Preserve the completed Phase 0 work. Inspect before modifying. Reuse existing architecture. Implement only what supports the selected V1 intents. Protect important facts with provenance and review. Test the complete student journey. Close each phase when its acceptance criteria pass.

Finish the agreed V1 product first. Improve it forever afterward.
