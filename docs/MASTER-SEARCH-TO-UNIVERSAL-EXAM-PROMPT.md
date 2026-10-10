# SchoolToCareer Master Search-to-Universal-Exam Implementation Prompt

## Role

You are the lead engineer implementing the next product phase of SchoolToCareer.

Work inside the existing repository. This is not a greenfield project.

Your responsibility is:

```text
inspect -> decide -> preserve -> implement -> test -> verify -> document -> close the phase
```

Do not keep the project in an endless planning or infrastructure loop.

## Mission

Build the smallest complete, useful, trustworthy V1 product for Indian students searching for exam, board, paper, result, syllabus, application, eligibility, date, and official-update information.

A feature is complete only when it provides:

```text
data + API + page + SEO + source/trust + student usefulness
```

A model, route, API, or test by itself is not a completed product capability.

## Source Documents

Read these documents before changing code:

1. `docs/SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP.md`
2. `docs/MASTER-V1-EXECUTION-PROMPT.md`
3. `docs/CURRENT-V1-IMPLEMENTATION-STATUS.md`
4. `docs/V1-PRODUCT-DIRECTION.md`
5. `docs/MASTER-PROMPT-REVIEW.md`
6. relevant project status and architecture documents

Also inspect the actual repository. Documentation is evidence of intended behavior, not a substitute for source-code verification.

## Existing Baseline to Preserve

Phase 0 source acquisition and production safeguards already exist. Preserve them.

Do not rebuild or replace:

- `Source`
- `SourceSnapshot`
- source registry
- source-fetch task
- robots handling
- `ROBOTS_UNAVAILABLE` classification
- ETag and Last-Modified requests
- normalization
- SHA-256 hashing
- historical snapshots
- source reporting
- manual `pnpm sources:fetch`
- convergent source seeding
- retired source handling
- UTF-8-safe truncation
- worker architecture
- outbox architecture
- existing authentication and authorization
- existing validation and error handling
- existing API module conventions
- existing Prisma conventions
- existing search provider abstraction
- existing SEO and revalidation infrastructure
- existing data-integrity gates

Only fix a baseline feature if inspection identifies a real defect. A bug fix does not reopen Phase 0.

## Verified Baseline

The repository has verified work including:

- source monitoring and historical snapshots
- protection against fabricated exam facts
- indexability safeguards for incomplete exam content
- sitemap protection
- `/api/revalidate`
- production-gated AdSense loading
- PostgreSQL and Prisma setup
- API, worker, outbox, and deployment infrastructure
- existing exam, event, result, paper, and content models
- architecture checks

Previously verified checks include:

```text
focused source-fetch tests: 17/17
full API tests: 139/139
architecture checks: 5/5
Prisma validation: passed
database constraints: 17 applied, 0 failed
PostgreSQL: 18
migrations: up to date
integrity gate: passed
fabricated dates: 0
fabricated official URLs: 0
```

Run current checks again where relevant. Do not assume an old result still holds.

## Non-Negotiable Rules

### Accuracy

Never invent:

- exam dates
- application dates
- result dates
- eligibility rules
- fees
- cutoffs
- official URLs
- notifications
- source evidence

When official information is unavailable, represent that honestly. Missing data is not proof of an official `NOT_ANNOUNCED` statement.

### No duplicate ownership

Before adding a field or model:

1. search the repository
2. inspect the Prisma schema
3. inspect migrations
4. inspect API contracts
5. inspect consumers
6. identify the canonical owner
7. document why a new field is necessary

Do not add `Exam.examDate` automatically. The canonical owner may already be `ExamEvent`, `ExamYear`, `Result`, or another existing model.

### No duplicate infrastructure

Do not add another crawler, worker, queue, event bus, logger, search engine, cache, or authorization system.

Do not add Redis, Kafka, Elasticsearch, Meilisearch, embeddings, vector databases, microservices, or LLM extraction unless an actual measured requirement proves the current architecture cannot satisfy V1.

### No thin-page scale

A route is not automatically an indexable page. Every page must have:

- a real student intent
- meaningful content
- correct canonicalization
- correct index/noindex behavior
- source/trust information where relevant
- useful internal links
- a clear next action

### No silent behavior changes

Preserve existing public APIs and behavior unless the change is required by the selected product intent. Update tests and documentation for intentional changes.

### No destructive changes

Do not delete historical source data, user changes, audit history, or unrelated work. Do not use destructive Git commands.

## Phase 1 Objective: Master Search/Product Map

Finalize:

```text
SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP
```

The map must begin with student questions, not route patterns.

### Required map columns

Each row must include:

- entity
- category
- student search intent
- priority
- Tier A/B/C classification
- target URL
- page/product type
- required data
- canonical data owner
- official source
- fact dependencies
- index/noindex decision
- SEO value
- CTR opportunity
- student value
- implementation status
- next engineering action
- acceptance test
- evidence or rationale

### Initial intent set

At minimum evaluate:

1. JEE Main exam date
2. JEE Main application form
3. JEE Main syllabus
4. JEE Main eligibility
5. JEE Main previous-year papers
6. JEE Main result
7. NEET syllabus
8. UPSC eligibility
9. SSC CGL application form
10. CBSE Class 10 Maths syllabus

Expand the map to cover the selected V1 cohorts, but do not add rows merely to increase URL count.

### Priority rules

Use:

- `P0` — critical high-intent need
- `P1` — important supporting intent
- `P2` — useful long-tail intent
- `P3` — conditional; build only with sufficient content

If search-volume evidence is unavailable, do not invent numbers. Use:

```text
PROVISIONAL — repository/product evidence
Validation required: Search Console or analytics
```

A priority is not final until the evidence or rationale is recorded.

### Phase 1 stop condition

Close Phase 1 only when:

- selected exams and boards are mapped
- Tier A/B/C cohorts are bounded
- every selected intent has a page, section, tool, download, editorial, or explicit no-page decision
- every selected page has a data contract
- canonical ownership is identified
- official source strategy is identified
- index/noindex is decided
- acceptance tests are written
- the next implementation backlog is derived

## Canonical Ownership Investigation

Inspect the actual schema and document ownership for:

| Information | Owner to verify |
|---|---|
| Exam date | `ExamEvent`, `ExamYear`, or existing equivalent |
| Application start | event, exam-year, or existing lifecycle record |
| Application end | event, exam-year, or existing lifecycle record |
| Application URL | existing exam/source/link field |
| Result date | `Result` or existing lifecycle record |
| Result URL | `Result` or existing official-link field |
| Syllabus | existing content, subject, or document model |
| Eligibility | existing content or structured canonical model |
| Previous-year papers | `QuestionPaper` / `QuestionPaperFile` |

Do not create duplicate canonical fields for convenience.

## Initial Cohort Selection

Select a bounded provisional first cohort of 3-5 exam products using repository evidence.

Evaluate:

- existing implementation maturity
- official source availability
- source accessibility
- lifecycle recurrence
- student value
- paper availability
- result availability
- application information availability
- content readiness
- likely editorial effort
- search evidence when available

If evidence is insufficient, explicitly state:

- what is missing
- which provisional cohort is being used
- why it is reasonable for engineering validation
- how it will be validated later

Do not present a provisional cohort as a proven market ranking.

## Phase 2 Objective: Universal Exam Product

Build one data-driven exam product. Do not create separate hard-coded architectures for each exam.

The reusable product should support where meaningful:

- overview
- current lifecycle state
- important dates
- application
- official application action
- eligibility
- syllabus
- exam pattern
- admit card
- answer key
- result
- previous-year papers
- notification
- cutoff
- counselling
- FAQs and related actions
- official sources and provenance

Only render sections with meaningful data. Do not create empty sections to fill a template.

### Suggested page composition

```text
exam identity
    -> concise useful overview
    -> current lifecycle/status
    -> important dates
    -> application and official action
    -> eligibility
    -> syllabus
    -> exam pattern
    -> admit card
    -> answer key
    -> result
    -> previous-year papers
    -> official sources/provenance
    -> related student actions
```

The exact composition must follow the search map and existing design system.

### Product contract

For every selected intent, define:

- API data shape
- page component or route
- required canonical fields
- source/provenance display
- SEO metadata
- index/noindex rule
- loading/error/empty states
- mobile behavior
- next student action
- acceptance test

Do not duplicate source-of-truth logic in the frontend.

## Trust and Fact Engine Boundary

The current source system reports:

```text
source changed
```

The semantic layer, when required by a selected product intent, must determine:

```text
important fact changed
```

Do not build the entire fact engine before the product contract and canonical owners are understood. Build the minimum trust slice required for the first real factual pages.

Use:

- `ExtractedFact` for an observation from one source snapshot
- `FactChange` for a semantic difference requiring handling
- existing exam/event/result models for canonical published values

Do not create both `OfficialFact` and `ExtractedFact` without separately documented responsibilities.

Initial fact types:

- `EXAM_DATE`
- `APPLICATION_START`
- `APPLICATION_END`
- `RESULT_DATE`
- `OFFICIAL_APPLICATION_URL`
- `OFFICIAL_RESULT_URL`

Required trust rules:

- changed source does not automatically mean changed fact
- deterministic extraction comes before AI
- raw value and normalized value are both retained
- evidence and snapshot provenance are retained
- extractor version is retained
- confidence and risk are separate
- low-confidence observations cannot silently update canonical data
- critical and high-risk changes require review
- truncated snapshots are not parsed as complete
- invalid values cannot update canonical truth
- stale approvals cannot overwrite newer canonical values
- repeated processing is idempotent
- extraction failures leave canonical data unchanged

The fact engine is complete only after a real end-to-end test proves:

```text
source A
    -> snapshot A
    -> extracted fact

source B
    -> changed snapshot B
    -> semantic FactChange
    -> risk classification
    -> pending review
    -> approval
    -> atomic canonical update
    -> outbox/revalidation
```

## Paper Product Boundary

Use existing `QuestionPaper` and `QuestionPaperFile` models where they are canonical.

The later paper phase should implement:

```text
discover
    -> identify
    -> metadata
    -> validate
    -> link or permitted storage
    -> hash
    -> deduplicate
    -> expose to frontend
```

Do not build the full paper importer during the initial search-map phase unless inspection proves it is a trivial, required dependency for the selected page.

Do not assume that a public PDF may be re-hosted.

## Results and Board Boundaries

Result and board modules/routes may already exist, but they are not complete merely because the route exists.

For each selected result or board intent verify:

- canonical data
- official source
- useful content
- provenance
- indexability
- student action
- tests

Do not mass-generate board chapter pages without sufficient content.

## SEO Requirements

Inspect the existing SEO system before changing it.

Every selected indexable page must have where appropriate:

- intent-aligned title
- useful meta description
- canonical URL
- correct robots directive
- correct sitemap behavior
- structured data only when supported and accurate
- breadcrumbs
- internal links
- source/provenance
- meaningful above-the-fold answer
- mobile-friendly performance

Do not index incomplete or thin pages merely because a route exists.

## Security and Performance

Preserve:

- authentication
- authorization
- permissions
- validation
- error handling
- safe HTML handling
- secret management
- existing cache and revalidation paths

Do not expose credentials or add client-side secrets.

Prefer server rendering and existing caching architecture. Add infrastructure only after measuring a real need.

## Testing Requirements

### Map and planning tests

Verify:

- every selected intent has an acceptance test
- every selected page has a data contract
- every fact has a canonical owner
- every source dependency is documented
- every page has an index/noindex decision

### Universal exam product tests

Verify:

- overview renders from canonical data
- sections render only when data exists
- official links are correct
- missing data renders an honest unavailable state
- no fabricated dates or URLs appear
- provenance is visible where required
- multiple exams use the same reusable components
- mobile layout does not overlap or overflow
- API errors are distinguishable from genuinely empty data

### Trust tests when implemented

Verify:

- source change without fact change creates no semantic change
- same normalized value creates no duplicate change
- changed exam date creates a critical pending change
- application deadline remains unchanged when the fixture leaves it unchanged
- low confidence cannot update canonical data
- invalid values are rejected
- extraction failure leaves canonical truth unchanged
- duplicate processing is idempotent
- duplicate approval is safe
- stale approval is rejected or sent back for review
- provenance is retained
- outbox/revalidation event is created atomically with approval

### Required JEE Advanced fixture

Use a deterministic fixture proving:

```text
Initial source:
Exam Date: 23 June 2026
Application ends: 27 April 2026

Second source:
Exam Date: 24 June 2026
Application ends: 27 April 2026
```

Expected:

- two source snapshots
- changed content hash
- extracted exam date change
- critical pending `FactChange`
- no change for the unchanged application deadline
- approval updates the correct canonical owner
- outbox/revalidation signal exists

## Verification Matrix

Run relevant checks after implementation:

### Code

- focused tests
- full API tests
- worker tests
- frontend tests
- typechecks for all configured packages
- lint where configured
- architecture checks

### Database

- Prisma validation
- migration status
- foreign keys
- unique constraints
- indexes
- enum values
- idempotency constraints
- query plans where relevant

### Product

- production build
- route checks
- API checks
- manual student journey
- official-link action
- paper access where selected
- result access where selected
- loading/error/empty states

### SEO

- metadata
- canonical URLs
- robots
- sitemap
- structured data
- index/noindex behavior
- redirects
- thin-page controls

### Phase 0 regression

Keep verifying:

- robots allow
- robots disallow
- robots unavailable
- HTTP 403/WAF
- DNS failure
- TLS failure
- malformed URL
- conditional requests
- unchanged source
- changed source
- historical source preservation
- UTF-8-safe truncation
- fabricated-data integrity gate

### Windows/Corepack rule

If root Turbo commands fail because Turbo cannot resolve pnpm through Corepack on Windows:

1. run direct package commands through Corepack pnpm
2. record direct results
3. record the Turbo wrapper failure separately
4. never claim Turbo passed unless it passed

If the web build needs the API for sitemap prerendering, either run the API during the build verification or document and fix the build dependency. Do not hide the failure.

## Documentation Requirements

Update only the documentation needed for the implemented scope:

- master search/product map
- selected cohort and rationale
- canonical ownership decisions
- V1 page specification
- API contract changes
- schema/migration changes
- source dependencies
- implementation status
- unresolved data dependencies
- next phase

Do not mark a document complete while required decisions remain `TBD` without a documented provisional policy.

## Phase Completion Contract

A phase is complete only when:

```text
input
    -> implementation
    -> tests
    -> verification
    -> documentation
    -> acceptance criteria pass
```

After completion:

- bug fixes are maintenance
- content updates are operations
- new features belong to a later phase or version
- optional improvements do not reopen the phase

## V1 Boundaries

V1 does not require:

- every exam in India
- every board
- every chapter page
- every possible fact type
- every possible paper
- AI
- embeddings
- RAG
- vector search
- Redis
- Kafka
- microservices
- mass page generation
- college/career/job ecosystem
- question-level intelligence
- rank prediction
- study planning

These may become V1.1, V2, expansion, or optimization work after the defined V1 is complete.

## Final V1 Gate

Declare:

```text
SCHOOLTOCAREER V1 COMPLETE
```

only after the bounded V1 commitments are satisfied:

### Student product

- selected exam intents work
- selected board intents work
- selected paper intents work
- selected result intents work
- universal search works
- students can complete the intended next action

### Trust

- important facts have source and snapshot provenance
- semantic changes are distinguishable from source changes
- critical changes require review
- canonical updates are atomic
- stale approvals are protected
- outbox/revalidation works
- failures cannot corrupt canonical truth
- retries are idempotent

### SEO

- metadata works
- canonicalization works
- robots and sitemap work
- structured data is accurate
- internal linking works
- thin pages are controlled
- measurement is available

### Operations

- editors can review and maintain selected data
- audit history is available
- sources and important content are manageable

### Production

- required tests pass
- typechecks pass
- database checks pass
- architecture checks pass
- production build works with its documented dependencies
- manual student journeys pass

## Required Final Report

At the end of the phase, report:

1. What was inspected
2. What already existed and was reused
3. What canonical owners were found
4. What duplicate fields/models were avoided
5. Which exams and boards were selected
6. Whether the selection is proven or provisional
7. What files were created or changed
8. Database changes and migrations
9. API changes
10. Frontend changes
11. SEO changes
12. Source/provenance changes
13. Tests run and exact results
14. Build result and dependencies
15. Unresolved data dependencies
16. Provisional decisions
17. Student-facing capabilities now available
18. Exact next phase
19. Whether the phase is closed

Never claim completion because scaffolding exists. Demonstrate the working product contract.

## Immediate Execution Order

```text
1. Read this prompt and the source documents
2. Inspect the actual repository
3. Verify current Phase 0 and integrity behavior
4. Finalize the master search/product map
5. Resolve canonical ownership
6. Select a bounded provisional or evidence-backed cohort
7. Define the V1 page and API contracts
8. Build the reusable universal exam product
9. Implement only the minimum fact/trust slice needed by selected factual pages
10. Connect source, provenance, and honest unavailable states
11. Add focused and student-facing acceptance tests
12. Run code, database, architecture, production, SEO, and product checks
13. Fix real failures and rerun checks
14. Update documentation
15. Close the phase when acceptance criteria pass
16. Move to the exact next phase
```

## Final Instruction

Build SchoolToCareer as a finished student product, not an endless infrastructure project.

Preserve working systems. Do not invent facts. Do not duplicate ownership. Do not generate thin pages. Use real evidence. Make the V1 boundary explicit. Ship useful student-facing capabilities. Measure them. Close each phase when its acceptance criteria pass.

Finish the defined V1 first. Improve it forever afterward.
