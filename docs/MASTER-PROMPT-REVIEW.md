# SchoolToCareer Master Prompt Review

## Purpose

This document reviews the **SchoolToCareer Master End-to-End Implementation Prompt** and records which parts should remain, which parts should be removed, and which parts should be clarified before implementation begins.

The existing Phase 0 source-acquisition foundation must be treated as already implemented and authoritative.

## Overall Recommendation

The master prompt is strategically strong and should remain the primary product direction. It correctly prioritizes:

- student search intent
- useful pages over raw URL count
- official sources and provenance
- editorial trust
- finite V1 scope
- reuse of existing infrastructure
- measurement after launch
- deferring AI and large platform expansion

However, it should not be used unchanged as an execution checklist. It contains several overlapping requirements and some scope tensions.

### Final assessment

- **Do not remove the overall strategy.**
- **Do remove or defer several implementation requirements from the first milestone.**
- **Clarify phase numbering and ownership boundaries.**
- **Split product planning from implementation execution.**
- **Make the first actionable deliverable the search/product map, not another infrastructure layer.**

## What Should Remain

### 1. Student-search-first strategy

Keep the product chain:

```text
student search intent
    -> student problem
    -> useful page
    -> reliable data
    -> official source
    -> editorial trust
    -> SEO measurement
```

This is the strongest part of the prompt. It prevents engineering work from becoming detached from student value.

### 2. Clear V1 finish line

Keep the requirement that V1 must have a finite definition of done.

The project should eventually be able to say:

```text
SCHOOLTOCAREER V1 COMPLETE
```

Further work should then be classified as:

- bug fix
- content update
- V1.1
- V1.2
- V2
- expansion
- optimization

This directly prevents endless foundational phases.

### 3. Preserve Phase 0

Keep the explicit instruction not to rebuild:

- `Source`
- `SourceSnapshot`
- source registry
- fetch worker
- robots handling
- conditional requests
- ETag and Last-Modified support
- normalization and hashing
- historical snapshots
- source reports
- manual fetch
- UTF-8-safe truncation
- worker and outbox infrastructure

The current repository already has this foundation and it has been verified.

### 4. No duplicate concepts

Keep the repository-inspection rule before adding:

- models
- services
- enums
- routes
- worker tasks
- abstractions

The existing project already has conventions for repositories, services, permissions, events, validation, and canonical data ownership.

### 5. Accuracy over freshness theater

Keep the prohibition against inventing:

- exam dates
- application dates
- results
- eligibility
- fees
- cutoffs
- official links
- announcements

The correct fallback remains:

```text
Not officially announced yet.
```

### 6. Thin-page and indexability controls

Keep the requirement that routes should not automatically become indexable pages.

Every page should have:

- genuine search intent
- useful content
- correct canonicalization
- an index/noindex decision
- internal links
- useful metadata

### 7. Existing architecture freeze

Keep the rule that Redis, Kafka, Elasticsearch, embeddings, vector databases, microservices, and other infrastructure are not added without a demonstrated production need.

The current monorepo already has a worker, outbox, PostgreSQL, Prisma, API, and search foundation.

### 8. Semantic trust engine

Keep the distinction between:

```text
source changed
    !=
fact changed
```

This is essential. A changed page must not automatically become a changed exam fact.

### 9. Human approval for important facts

Keep the requirement that high-risk facts cannot be blindly auto-published.

The intended flow should remain:

```text
source snapshot
    -> extracted observation
    -> semantic comparison
    -> fact change
    -> risk classification
    -> editorial review
    -> approval
    -> canonical update
    -> outbox/revalidation
```

### 10. Provenance and auditability

Keep the requirement that every important fact can answer:

- which source produced it
- which URL was fetched
- which snapshot contained it
- when it was fetched
- what evidence produced the value
- which extractor produced it
- who reviewed it
- when it was approved

### 11. JEE Advanced as a reference implementation

Keep JEE Advanced as the first implementation used to prove the universal exam architecture.

Clarify that it is a reference case, not the entire roadmap. The prompt already states this correctly and that wording should remain.

### 12. Defer AI and student tools

Keep the decision to defer:

- LLM extraction
- embeddings
- RAG
- AI-generated content
- rank predictors
- study planners
- question intelligence
- personalized recommendations

These should depend on reliable structured data and real user behavior.

### 13. V1 completion audit

Keep the dedicated completion audit. It is valuable because it prevents the project from continuously adding foundational work without checking whether students can actually use the product.

## What Should Be Removed

These items should be removed from the immediate implementation scope, not necessarily deleted from the long-term product vision.

### 1. Remove the requirement to implement every listed exam immediately

The prompt lists many exam families and dozens of exams. That is useful as a discovery inventory, but it is too broad as an initial engineering commitment.

Do not require simultaneous implementation of:

- every engineering exam
- every medical exam
- every banking exam
- every railway exam
- every state exam
- every professional exam

Instead, require a prioritized rollout based on:

- search demand
- seasonality
- authoritative data availability
- student value
- editorial capacity
- competition

### 2. Remove the requirement to implement every fact type in the first release

Do not implement every possible fact immediately.

The first semantic release should use a small reliable set:

- `EXAM_DATE`
- `APPLICATION_START`
- `APPLICATION_END`
- `RESULT_DATE`
- `OFFICIAL_APPLICATION_URL`
- `OFFICIAL_RESULT_URL`

Add other fact types only after the extraction and review flow is reliable.

### 3. Remove mass page generation from the first implementation milestone

Do not generate thousands of exam, board, paper, chapter, or year pages before:

- the search map exists
- templates are useful
- data is available
- provenance renders correctly
- indexability rules work
- thin-page detection works

### 4. Remove the full paper importer from the trust-engine milestone

The paper importer is a valid V1 product phase, but it should remain separate from the initial semantic fact implementation.

The trust engine should expose clean source and provenance boundaries so the later importer can consume official archives without being coupled to exam-fact extraction.

### 5. Remove a giant CMS requirement

The prompt correctly says not to build a giant CMS. That restriction should remain explicit.

The editorial console should begin with:

- fact review
- source status
- content status
- paper status
- result status

### 6. Remove speculative infrastructure

Do not add the following merely because they may be useful later:

- Redis
- Kafka
- Elasticsearch
- vector databases
- microservices
- a second event bus
- a second queue
- a second source crawler
- a second logging system
- a multi-site abstraction

### 7. Remove `NOT_ANNOUNCED` as an automatic extracted fact

Absence of a date does not prove that the official authority explicitly said “not announced.”

Use one of these approaches instead:

- nullable absence
- a display-state derived from missing canonical data
- an explicit `NOT_ANNOUNCED` observation only when the source states it

### 8. Remove assumptions about `Exam.examDate`

Do not require a new `Exam.examDate` field without inspecting the existing schema.

The correct canonical owner may be:

- `ExamEvent`
- `ExamYear`
- `Result`
- another existing model

### 9. Remove duplicate fact terminology

The repository assessment used both `OfficialFact` and `ExtractedFact` in different planning documents.

Do not require both models unless their responsibilities are explicitly different.

Recommended terminology:

- `ExtractedFact` — observation from one source snapshot
- `FactChange` — proposed semantic difference
- existing exam/event/result models — canonical published values

## What Should Be Clarified

### 1. Clarify phase numbering

The previous implementation plan calls the semantic fact layer Phase 2. The master prompt calls it Phase 2A inside a larger product roadmap.

Choose one naming system and use it consistently. Recommended structure:

```text
Phase 0  Foundation and source acquisition
Phase 1  Search intent and product map
Phase 2  Universal exam product
Phase 2A Trust engine
Phase 3  Papers
Phase 4  Results and lifecycle
Phase 5  Boards
Phase 6  Search
Phase 7  Editorial operations
Phase 8  SEO scale
Phase 9  V1 completion audit
```

### 2. Clarify that the search map comes before implementation

The first immediate deliverable should be:

```text
SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP
```

It should contain:

- exam or board
- category
- search intent
- priority
- target URL
- page type
- required data
- official source
- fact dependencies
- index/noindex decision
- SEO value
- CTR opportunity
- student value
- implementation status

The map should drive the backlog. It should not be a decorative planning document.

### 3. Clarify the relationship between product phases and trust-engine work

The prompt places the semantic trust engine inside the universal exam product phase. That is reasonable, but the dependency should be explicit:

```text
product map
    -> canonical exam product
    -> source/fact trust engine
    -> useful pages using trusted facts
```

The fact engine should not become an isolated infrastructure project with no student-facing acceptance test.

### 4. Clarify canonical ownership

Before implementing comparison or approval, document exactly which existing model owns each fact type.

Example:

| Fact type | Canonical owner to verify |
|---|---|
| Exam date | `ExamEvent` or equivalent |
| Application window | `ExamEvent` or equivalent |
| Result date | `Result` or equivalent |
| Official application URL | existing exam/source/link field |
| Official result URL | `Result` or equivalent |

The prompt must not dictate a field name before repository inspection.

### 5. Clarify incomplete or truncated snapshots

A snapshot with `rawTruncated = true` must not be parsed as if it were complete.

It may be:

- retained for audit history
- flagged for retry or alternative acquisition
- excluded from semantic extraction

### 6. Clarify approval atomicity

Approval must update the canonical record, audit record, and outbox event in one transaction where the existing architecture permits it.

The system must not record:

- approval without canonical update
- canonical update without outbox event
- outbox event without the corresponding approved change

### 7. Clarify stale approval protection

If the canonical value changes after a `FactChange` is created, an old approval must not overwrite the newer value.

Approval should compare the expected old value or canonical version before applying the change.

### 8. Clarify idempotency scope

Idempotency must cover:

- repeated source processing
- worker retries
- repeated extraction
- repeated change detection
- duplicate approval requests
- concurrent approval requests
- repeated outbox creation

### 9. Clarify confidence versus risk

These are different dimensions:

- confidence: how certain the extractor is that it found the fact
- risk: how harmful an incorrect publication would be

A high-confidence exam-date change is still critical and requires review.

### 10. Clarify actual source fixtures

The first extraction tests should use deterministic fixtures based on the actual source formats that the repository can acquire, especially JEE Advanced sources.

Generic fake HTML alone is insufficient to prove that the selected official pages are parseable.

### 11. Clarify the admin UI dependency order

Implement in this order:

```text
schema
    -> extraction
    -> comparison
    -> workflow service
    -> approval transaction
    -> API
    -> tests
    -> admin UI
```

The UI should not define an unstable backend contract.

### 12. Clarify fact observability

Keep source and semantic metrics separate:

```text
source snapshots changed: 17
facts extracted: 12
semantic fact changes: 4
critical changes: 1
pending review: 1
approved: 1
```

A source change count must never be presented as a fact-change count.

### 13. Clarify the Windows/Corepack verification rule

The prompt correctly identifies the Windows/Corepack caveat.

The final report should distinguish:

- direct package command results
- root Turbo wrapper results
- environment/tool-resolution limitations

Do not claim Turbo passed unless it actually passed.

## Recommended Final Phase Structure

The master prompt should be executed with this finite structure:

```text
Phase 0  Verify and preserve foundation
Phase 1  Build master search/product map
Phase 2  Build universal exam product foundation
Phase 2A Build semantic trust engine for a small reference set
Phase 3  Build previous-year paper product
Phase 4  Build result pages and exam lifecycle
Phase 5  Build priority board product
Phase 6  Build universal search and analytics
Phase 7  Build minimal editorial operations
Phase 8  Scale SEO and measurement
Phase 9  Run V1 completion audit
V1      Declare completion
V1.1+   Tools, intelligence, expansion, optimization
```

Each phase should have:

- a student problem
- target search intent
- required data
- authoritative source strategy
- page/API requirements
- SEO requirements
- tests
- observability
- explicit acceptance criteria

## Recommended Immediate Backlog

### First deliverable

Create:

```text
SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP
```

### Then

1. Prioritize the first exam and board cohorts.
2. Verify existing canonical data ownership.
3. Select the first six fact types.
4. Design `ExtractedFact` and `FactChange`.
5. Implement deterministic extraction for JEE Advanced fixtures.
6. Implement semantic comparison and risk classification.
7. Implement idempotent persistence.
8. Implement atomic approval and outbox integration.
9. Add the mandatory end-to-end test.
10. Build the smallest review API.
11. Build the smallest review UI.
12. Connect the approved facts to one useful exam page.
13. Measure the student journey before expanding coverage.

## Final Recommendation

The master prompt is good and should remain the strategic source of truth. Nothing major should be removed from the long-term direction.

What should change is the execution discipline:

- remove immediate commitments to broad coverage
- remove speculative infrastructure
- remove duplicate fact concepts
- remove assumptions about canonical fields
- defer mass page generation
- defer the full paper importer from the first trust milestone
- clarify phase numbering
- require the search/product map first
- require a student-facing acceptance test for each major phase

The most important next action is not another architecture redesign. It is creating the master search/product map and deriving a small, measurable implementation backlog from it.
