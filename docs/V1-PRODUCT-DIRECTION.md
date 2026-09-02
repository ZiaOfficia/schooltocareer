# SchoolToCareer V1 Product Direction

## Decision

The latest product-first suggestion is accepted as the strategic direction for SchoolToCareer.

The project should be built toward a finite V1 product rather than an endless technical roadmap. The goal is to make SchoolToCareer a trusted, search-first destination for Indian students looking for exam, board, paper, result, syllabus, application, eligibility, and lifecycle information.

The existing technical review remains valid as an execution safeguard. This document combines both directions:

- the product roadmap defines **what should be built and why**
- the technical safeguards define **how it must be built safely**

## V1 Mission

A student should be able to arrive from Google, find an accurate answer to an important education question, trust the source, and complete the next action.

Examples include:

- finding an exam date
- opening an application form
- checking eligibility
- downloading a previous-year paper
- checking a result
- finding a syllabus
- locating an admit card or answer key
- navigating a board, class, subject, or chapter resource

The objective is not maximum URL count. The objective is ownership of valuable student search intents through genuinely useful pages.

## Product Principle

All major work should follow this chain:

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

Priority order:

1. Student search demand
2. Student usefulness
3. Accuracy and trust
4. SEO opportunity
5. CTR opportunity
6. Business value
7. Operational efficiency
8. Engineering elegance
9. Future scalability

Engineering work must answer two questions:

1. What student problem does this solve?
2. What search intent does this serve?

## V1 Finish Line

V1 is complete when the deliberately selected high-value student intents are served reliably across:

- major competitive and entrance exams
- major government, banking, railway, teaching, defence, management, and professional exams
- priority school boards
- previous-year papers
- exam results and lifecycle information
- universal search
- editorial operations
- SEO and measurement

V1 completion requires:

- useful pages, not merely database rows
- accurate and sourced important facts
- appropriate provenance and editorial review
- reliable paper and result access
- useful board coverage
- universal discovery
- controlled indexability
- production monitoring
- a usable maintenance workflow

Once these acceptance criteria pass, declare:

```text
SCHOOLTOCAREER V1 COMPLETE
```

After that, new work is classified as:

- bug fix
- content update
- V1.1
- V1.2
- V2
- expansion
- optimization

More possible pages or features do not reopen a completed V1.

## What Is Already Complete

Phase 0 source acquisition and observability are substantially complete and should not be rebuilt.

Existing capabilities include:

- PostgreSQL and Prisma
- API architecture
- authentication and authorization
- source registry
- source monitoring
- source snapshots
- robots classification
- ETag and Last-Modified support
- content normalization
- SHA-256 hashing
- historical source tracking
- worker infrastructure
- outbox infrastructure
- logging and validation
- metadata and revalidation foundations
- exam, paper, result, and content models
- testing and architecture checks
- deployment foundation
- manual source fetching
- UTF-8-safe truncation

Only actual defects should reopen Phase 0.

## V1 Phase Structure

```text
Phase 0  Foundation and source acquisition
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

The phase names must remain consistent across plans, status reports, and implementation work.

## Phase 1: Master Search Product Map

The immediate product deliverable is:

```text
SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP
```

This map is the V1 product specification. It must start with student questions, not route patterns.

Each record should contain:

- exam, board, result, paper, or resource
- category
- student search intent
- priority: P0, P1, P2, or P3
- target URL
- page type
- required data
- official source strategy
- fact dependencies
- index/noindex decision
- SEO value
- CTR opportunity
- student value
- implementation status
- owner or next action

### Intent decisions

For each intent, decide whether it should be:

- an existing page
- a section on another page
- a dedicated page
- a tool
- an article
- a download
- no page

Never create a page merely because a route exists.

### Priority levels

- `P0` — critical, high-intent student need
- `P1` — important supporting intent
- `P2` — useful long-tail intent
- `P3` — conditional intent, only when content is sufficient

The map should define Tier A, Tier B, and Tier C exam coverage using evidence such as demand, seasonality, authoritative data availability, student value, and editorial capacity.

## Phase 2: Universal Exam Product

Build one reusable exam product rather than separate architectures for JEE, NEET, UPSC, SSC, GATE, CAT, or banking exams.

Core page capabilities should include, where the intent and data justify them:

- exam overview
- important dates
- syllabus
- exam pattern
- eligibility
- application form
- admit card
- answer key
- result
- previous-year papers
- notification
- cutoff
- counselling
- FAQs and resources

Every Tier A exam should provide a clear above-the-fold answer, official links, current status, important facts, provenance, and useful next actions.

### Exam page quality standard

Important pages should answer the primary student question immediately.

An application page should surface:

- application status
- official application URL
- application dates
- fee when officially available
- documents
- eligibility summary
- steps
- source
- last verified time

An eligibility page should surface only authoritative conditions. A result page should show status, official link, release date when known, checking instructions, and next steps.

## Phase 2A: Semantic Trust Engine

The existing source system answers:

```text
Did the source change?
```

The missing semantic layer must answer:

```text
What important fact changed?
```

Required pipeline:

```text
Official source
    -> SourceSnapshot
    -> deterministic extraction
    -> ExtractedFact
    -> canonical comparison
    -> FactChange
    -> confidence and risk
    -> editorial review
    -> approval, rejection, or ignore
    -> atomic canonical update
    -> outbox
    -> cache/page revalidation
```

### Required models

Use one clearly defined observation model:

- `ExtractedFact` — an observation from one source snapshot
- `FactChange` — a semantic difference requiring handling
- existing exam, event, result, or other models — canonical published values

Do not create both `OfficialFact` and `ExtractedFact` without separate responsibilities.

### Initial fact types

Start with:

- `EXAM_DATE`
- `APPLICATION_START`
- `APPLICATION_END`
- `RESULT_DATE`
- `OFFICIAL_APPLICATION_URL`
- `OFFICIAL_RESULT_URL`

Later additions require demonstrated need:

- notification date
- admit-card date
- answer-key date
- fee
- eligibility
- age limit
- attempts
- duration
- mode
- paper count
- counselling
- information bulletin

### Trust rules

- source change does not automatically mean fact change
- deterministic extraction comes before AI
- raw value, normalized value, evidence, snapshot, source, and extractor version are retained
- confidence and risk are separate dimensions
- low-confidence observations cannot silently update canonical truth
- critical and high-risk changes require editorial approval
- truncated snapshots are retained but are not parsed as complete documents
- missing information is not automatically a `NOT_ANNOUNCED` fact
- stale approvals cannot overwrite newer canonical data
- repeated processing is idempotent
- extraction failures leave canonical truth unchanged

### Risk levels

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

### Approval transaction

Approval must atomically:

1. verify the change is still pending
2. verify the expected canonical value or version
3. update the correct canonical record
4. record reviewer, timestamp, and reason
5. mark the change approved
6. create the outbox event

The system must not record approval without the canonical update or canonical update without the outbox event.

## JEE Advanced Reference Implementation

JEE Advanced is the first reference implementation, not the roadmap.

It should prove the universal architecture using verified official sources and deterministic fixtures. The first meaningful flow should demonstrate:

```text
old official source
    -> SourceSnapshot A
    -> extracted exam date
    -> canonical comparison
    -> no change for unchanged application deadline

new official source
    -> SourceSnapshot B
    -> changed exam date
    -> critical FactChange
    -> PENDING_REVIEW
    -> approval
    -> canonical update
    -> outbox/revalidation
```

After the reference flow works, apply the same architecture horizontally to priority exams such as:

- JEE Main
- JEE Advanced
- NEET
- CUET
- UPSC Civil Services
- SSC CGL
- IBPS PO
- GATE
- CAT
- NDA
- CLAT

The actual rollout order must come from the search/product map.

## Phase 3: Previous-Year Paper Product

Use the existing QuestionPaper and QuestionPaperFile models and source infrastructure.

The importer should support:

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

Paper metadata should include where applicable:

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

Do not assume that a public PDF may be re-hosted. Support official links, permitted hosted copies, or metadata-only records.

A paper page must offer more than a title and a link. It should help the student identify the exact paper and reach the download quickly.

## Phase 4: Results and Exam Lifecycle

Results are a product, not merely a database record.

Support useful result pages where justified:

```text
/results/[exam]
/exam/[exam]/result
```

Use lifecycle states such as:

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

Only show dates and statuses supported by official information. Missing dates must not become predictions.

## Phase 5: Priority Board Product

Start with high-priority boards such as:

- CBSE
- UP Board
- ICSE

Build reusable board, class, subject, syllabus, paper, result, date-sheet, notice, and resource capabilities.

Do not automatically index all potential chapter URLs.

```text
sufficient meaningful content -> INDEX
thin content                 -> NOINDEX, FOLLOW
```

A chapter page should become indexable only when it genuinely satisfies student intent.

## Phase 6: Universal Search

Search should cover:

- exams
- boards
- papers
- results
- articles
- subjects
- approved resources

Begin with reliable structured search and existing provider abstractions. Add intent routing only as far as proven student behavior requires.

Useful examples include:

- `JEE Main 2025 Physics paper`
- `CBSE Class 10 Maths syllabus`
- `SSC CGL result`
- `NEET syllabus`

Track:

- queries
- zero-result queries
- popular queries
- result clicks
- result position
- search-to-page transitions

## Phase 7: Editorial and Operations

Build a minimal operational console around existing editorial concepts.

Initial areas:

- sources
- facts
- fact changes
- content
- papers
- results
- revisions
- audit history

The fact review interface must show:

- entity
- fact
- old value
- proposed value
- risk
- confidence
- source
- snapshot
- evidence
- reviewer actions

Do not build a giant CMS before the review workflow is useful.

## Phase 8: SEO Scale and Measurement

Scale only after core products work.

Every indexable page should have, where appropriate:

- useful unique title
- useful meta description
- canonical URL
- proper heading structure
- breadcrumbs
- structured data
- internal links
- source/provenance
- meaningful content
- mobile performance
- correct index/noindex state

Measure:

- impressions
- clicks
- CTR
- average position
- indexed useful pages
- non-indexed pages
- organic landing pages
- query coverage
- crawl errors
- 404s
- Core Web Vitals
- paper downloads
- official-link clicks
- internal searches
- zero-result searches

Do not use misleading clickbait.

## Phase 9: V1 Completion Audit

Perform a finite audit instead of starting another architecture phase.

### Exam checklist

For every selected priority exam, verify where applicable:

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
- internal linking
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
- downloads/access reliable
- search discoverability
- SEO metadata
- indexability appropriate

### Board checklist

- board page
- priority classes
- priority subjects
- syllabus
- papers
- results
- important updates
- index/noindex control
- metadata
- internal links

### Trust checklist

- sources monitored
- snapshots preserved
- semantic facts extracted
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

## What Is Explicitly Deferred

The following are V2+ or expansion work unless the search/product map proves an earlier need:

- AI extraction
- LLMs
- embeddings
- RAG
- vector databases
- Redis
- Meilisearch
- Kafka
- microservices
- multi-site architecture
- translation systems
- colleges
- courses
- careers
- scholarships
- jobs
- rank predictors
- question-level analytics
- personalized recommendations
- large-scale chapter-page generation
- manual population of thousands of PDFs
- full question intelligence

This does not remove them from the long-term vision. It prevents them from delaying V1.

## Implementation Order

```text
1. Verify and lock Phase 0
2. Create the master search/product map
3. Define Tier A, B, and C cohorts
4. Define the final V1 page inventory
5. Verify canonical data ownership
6. Build universal exam templates
7. Put the first 3-5 priority exams through the templates
8. Implement the semantic trust engine
9. Connect source -> fact -> review -> canonical update
10. Prove the JEE Advanced end-to-end flow
11. Expand the universal exam product across Tier A
12. Build the paper importer and paper UX
13. Build results and lifecycle pages
14. Build the priority board product
15. Build universal search and analytics
16. Build editorial/admin operations
17. Apply SEO polish and controlled expansion
18. Run the V1 completion audit
19. Declare V1 complete
```

## Phase Contract

Every phase must define:

- input
- student problem
- target search intent
- output
- required data
- source strategy
- API/page requirements
- SEO requirements
- tests
- observability
- acceptance criteria
- stop condition
- exact next phase

A phase is complete when its acceptance criteria pass. Bug fixes and maintenance do not reopen it.

## Required Verification

After each major phase, run the relevant:

- focused tests
- full API and worker tests
- frontend tests where applicable
- package typechecks
- Prisma validation
- migration status
- database constraints and indexes
- architecture checks
- production build and route checks
- source checks
- API checks
- SEO checks
- manual student journey checks

For the trust engine, the mandatory end-to-end test must prove:

```text
source version A
    -> snapshot
    -> extracted facts

source version B
    -> changed snapshot
    -> semantic fact change
    -> risk classification
    -> pending review
    -> approval
    -> canonical update
    -> outbox/revalidation
```

The Windows/Corepack limitation must be reported separately from application results. If Turbo cannot resolve pnpm through Corepack, run package-level commands directly through Corepack pnpm and do not claim Turbo passed.

## Success Metrics

Do not use URL count as the primary success metric.

Track:

### Student value

- high-value intents successfully owned
- paper downloads
- official-link clicks
- result clicks
- application-link clicks
- search success
- zero-result queries

### Search and SEO

- impressions
- clicks
- CTR
- average position
- indexed useful pages
- thin pages
- crawl errors
- 404s

### Quality and trust

- source coverage
- fact verification rate
- stale fact rate
- accepted changes
- rejected changes
- review time
- factual correction rate

### Performance

- LCP
- INP
- CLS
- mobile page speed
- API latency
- worker duration

The strategic KPI is:

```text
high-value student search intents successfully owned
```

not:

```text
number of URLs generated
```

## Final Direction

Build SchoolToCareer as a trusted Google destination for Indian students searching for exam, board, paper, result, syllabus, application, date, eligibility, and education-update information.

First map the highest-value student intents. Then build reusable exam, paper, result, board, search, editorial, and SEO products around those intents. Back important facts with official-source monitoring and editorial verification. Measure real student outcomes. Stop V1 once the deliberately selected product acceptance criteria are complete.

The correct sequence is:

```text
Search intent
    -> exam and board products
    -> trusted data
    -> papers
    -> results
    -> search
    -> editorial operations
    -> SEO scale
    -> V1 completion
    -> V2 tools and intelligence
```

The project should not be restarted mentally from zero. Existing infrastructure is valuable. New infrastructure is justified only by evidence. The product is finished when the agreed V1 is useful, trustworthy, measurable, and maintainable.
