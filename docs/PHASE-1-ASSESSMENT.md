# SchoolToCareer Phase 1 Assessment

## Purpose

This document compares the proposed **Phase 1: Official Source Facts, Semantic Change Detection, and Editorial Review** prompt with the current SchoolToCareer repository.

It records:

- what is already implemented
- what is partially available for reuse
- what is not implemented
- what should be added
- what should be removed or clarified from the prompt
- the recommended implementation order

The repository is not greenfield. Phase 0 source acquisition and observability work already exists and must remain authoritative.

## Executive Verdict

The repository currently has a solid, verified **Phase 0 source-acquisition foundation**. The semantic fact layer described in the Phase 1 prompt is not yet implemented.

### Current status

| Area | Status |
|---|---|
| Source monitoring | Done |
| Source snapshots | Done |
| Robots classification | Done |
| Conditional requests | Done |
| Hashing and normalization | Done |
| Historical source correction | Done |
| Source reporting | Done |
| Manual source fetch | Done |
| UTF-8-safe storage limits | Done |
| Extracted fact model | Not done |
| Fact change model | Not done |
| Fact extraction | Not done |
| Semantic comparison | Not done |
| Risk classification | Not done |
| Editorial review workflow | Not done |
| Approval/rejection/ignore API | Not done |
| Canonical record updates | Not done |
| Fact-related outbox events | Not done |
| JEE Advanced fact flow | Not done |
| Fact end-to-end test | Not done |
| Fact-specific observability | Not done |

The attached prompt should therefore be treated as an implementation specification, not as a description of completed work.

## What Already Exists

### Phase 0 source system

The following source-acquisition capabilities are implemented and should be reused:

- `Source` and `SourceSnapshot` models
- source registry and seed configuration
- source repository
- source-fetch worker task
- robots.txt evaluation
- distinction between explicit robots disallow and unavailable robots.txt
- conditional requests using ETag and Last-Modified
- content normalization
- SHA-256 content hashing
- source change detection
- sequential requests and rate limiting
- historical source snapshots
- source status and failure tracking
- source reports
- convergent source seeding
- corrected source URLs
- UTF-8-safe body truncation
- manual `pnpm sources:fetch` command

### Existing application infrastructure

The repository also already provides infrastructure needed by Phase 1:

- PostgreSQL and Prisma
- Exam, ExamYear, ExamEvent, Result, and QuestionPaper models
- content draft and revision models
- worker process and periodic task framework
- outbox/event infrastructure
- authentication and authorization middleware
- permission constants and the shared `can()` authorization helper
- request validation and error handling
- existing API module conventions
- existing logger and structured logging conventions
- existing metadata and revalidation infrastructure
- architecture checks

These systems should be extended. They should not be replaced with a second source-fetcher, queue, logger, or authorization system.

## Existing Files Relevant to Reuse

The following files currently contain the relevant Phase 0 and platform foundations:

- [fetch-sources.task.ts](../apps/api/src/workers/tasks/fetch-sources.task.ts) — source fetching, robots handling, hashing, body storage, and truncation
- [fetch-sources.test.ts](../apps/api/src/workers/tasks/fetch-sources.test.ts) — Phase 0 regression tests
- [source.repository.ts](../apps/api/src/modules/source/source.repository.ts) — source and snapshot persistence
- [ingestion.prisma](../packages/database/prisma/schema/ingestion.prisma) — source and snapshot schema
- [sources.ts](../packages/constants/src/sources.ts) — official source seed list
- [seed-sources.ts](../tooling/scripts/seed-sources.ts) — convergent source seeding
- [sources-report.ts](../tooling/scripts/sources-report.ts) — source intelligence reporting
- [fetch-sources-now.ts](../tooling/scripts/fetch-sources-now.ts) — manual source fetch command
- [permissions.ts](../packages/constants/src/permissions.ts) — permission definitions and authorization helper
- [exam.prisma](../packages/database/prisma/schema/exam.prisma) — canonical exam, event, result, and paper models
- [content.prisma](../packages/database/prisma/schema/content.prisma) — editorial content models
- [define-events.ts](../apps/api/src/core/events/define-events.ts) — existing event conventions

## What Is Not Implemented

### 1. Fact data model

There is currently no semantic fact model equivalent to the prompt's `ExtractedFact` or the earlier plan's `OfficialFact`.

There is also no `FactChange` model.

Missing concepts include:

- source snapshot provenance
- source identity
- canonical entity type and ID
- strongly typed fact type
- raw extracted value
- normalized value
- confidence
- risk level
- evidence text
- extractor version
- change type
- review status
- reviewer identity
- review timestamp
- approval or rejection reason
- idempotency identity

### 2. Fact extraction

No deterministic fact extractors currently exist for:

- exam dates
- application start dates
- application deadlines
- admit-card dates
- answer-key dates
- result dates
- notification dates
- counselling dates
- official application URLs
- official result URLs
- information bulletins
- eligibility
- fees

There is no pipeline that consumes a changed, complete `SourceSnapshot` and produces fact observations.

### 3. Semantic comparison

The existing system detects source-content changes only. It does not determine whether the changed content contains a changed educational fact.

The missing boundary is:

```text
contentHash changed
    -> extract fact
    -> normalize value
    -> compare with canonical value
    -> create FactChange only when semantically different
```

A changed HTML layout, timestamp, script, or navigation menu must not create an exam-date change.

### 4. Risk classification

There is no fact-specific risk classifier.

The system does not currently distinguish critical changes such as exam dates from lower-risk metadata such as exam mode or paper count.

### 5. Editorial review workflow

There is no fact review queue or fact-specific workflow with states such as:

- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `IGNORED`
- `SUPERSEDED`

There is also no UI or API showing the reviewer:

- old value
- proposed value
- source
- snapshot
- evidence
- confidence
- risk
- affected entity

### 6. Approval integration

There is no approval transaction that updates canonical records and emits an outbox event.

The missing flow is:

```text
approve FactChange
    -> verify it is still pending
    -> update canonical record
    -> record reviewer and timestamp
    -> mark change approved
    -> create outbox event
    -> trigger revalidation/search invalidation
```

### 7. Fact API

The proposed fact-review endpoints do not currently exist:

```text
GET  /admin/fact-changes
GET  /admin/fact-changes/:id
POST /admin/fact-changes/:id/approve
POST /admin/fact-changes/:id/reject
POST /admin/fact-changes/:id/ignore
```

These must use the existing authentication, authorization, validation, response, and error-handling conventions.

### 8. Fact worker task

There is no `extract-facts` task or equivalent worker stage.

The existing worker should remain authoritative. The intended processing boundary is:

```text
fetch-sources
    -> SourceSnapshot
    -> changed and complete snapshots only
    -> extract-facts
```

Unchanged snapshots should not trigger expensive semantic processing. Truncated snapshots must not be parsed as complete documents.

### 9. JEE Advanced reference flow

There is no automated demonstration of:

```text
official JEE Advanced source
    -> SourceSnapshot
    -> extracted exam date
    -> FactChange
    -> editorial approval
    -> canonical update
    -> outbox/revalidation
```

This must be implemented and tested before declaring the phase complete.

### 10. Fact metrics

The source report provides source-level metrics, but no semantic fact metrics exist for:

- facts extracted
- facts rejected
- fact changes detected
- high-risk changes
- pending reviews
- approvals
- rejections
- ignored changes
- extraction failures

Source changes and semantic fact changes must remain separate measurements.

## Recommended Data Design

### Choose one observation model name

The prompt uses `ExtractedFact`, while the earlier implementation plan uses `OfficialFact`.

Do not create both without a clear distinction.

Recommended distinction:

- `ExtractedFact` — immutable or append-only observation extracted from one source snapshot
- `FactChange` — proposed semantic difference against the canonical record
- existing canonical models — the published truth used by the application

If the project prefers `OfficialFact`, use it consistently and document whether it represents an observation or a current canonical fact.

### Required fact concepts

Every fact observation should identify:

- source ID
- source snapshot ID
- entity type
- entity ID
- fact type
- raw value
- normalized value
- confidence
- risk level
- evidence text
- extraction rule/version
- extracted timestamp
- creation/update timestamps

### Provenance requirement

Every fact must answer:

```text
Which source produced it?
Which URL was fetched?
Which snapshot contained it?
When was it fetched?
What exact evidence produced the value?
Which extractor produced it?
```

Example:

```text
Fact: EXAM_DATE = 2026-06-24
Source: official JEE Advanced website
Snapshot: snapshot-id
Fetched: 2026-09-03T...
Evidence: "Examination will be conducted on 24 June 2026"
Extractor: ExamDateExtractor.v1
```

A fact without evidence and snapshot provenance must not be treated as trustworthy.

## Recommended Initial Fact Types

Do not implement dozens of speculative fields immediately.

Start with the smallest useful set:

1. `EXAM_DATE`
2. `APPLICATION_START`
3. `APPLICATION_END`
4. `RESULT_DATE`
5. `OFFICIAL_APPLICATION_URL`
6. `OFFICIAL_RESULT_URL`

After these work reliably, add:

- `NOTIFICATION_DATE`
- `ADMIT_CARD_DATE`
- `ANSWER_KEY_DATE`
- `APPLICATION_FEE`
- `ELIGIBILITY`
- `AGE_LIMIT`
- `EXAM_MODE`
- `EXAM_DURATION`
- `PAPER_COUNT`
- `COUNSELLING_START`
- `COUNSELLING_END`
- `OFFICIAL_INFORMATION_BULLETIN`

Do not add all of these before the first reference implementation is reliable.

## Value Representation

Use semantic types where appropriate:

- dates as normalized ISO dates, for example `2026-06-24`
- URLs as validated canonical URLs
- amounts as validated non-negative numbers
- durations and counts as numbers
- booleans as booleans
- structured eligibility or pattern data as JSON only when a structured object is necessary

Store the original raw value and evidence separately from the normalized value.

## Extraction Architecture

Use small deterministic extractors rather than one large parser.

A suitable architecture is:

```text
FactExtractionService
    -> ExamDateExtractor
    -> ApplicationDateExtractor
    -> ResultDateExtractor
    -> OfficialUrlExtractor
    -> EligibilityExtractor
```

The exact names should follow repository conventions.

Extractors should use:

- explicit labels
- nearby semantic context
- tables
- headings
- structured HTML
- JSON-LD
- known official notice patterns
- validated URL patterns

Do not add an LLM, embeddings, vector database, or AI-generated extraction in this phase.

## Confidence Rules

Use an explicit confidence representation such as:

- `HIGH`
- `MEDIUM`
- `LOW`

Recommended behavior:

- `HIGH` — compare normally and create a review item when changed
- `MEDIUM` — store the observation and require review
- `LOW` — retain the observation, but never update canonical data automatically

Low-confidence extraction must never silently modify published exam information.

## Change Model

`FactChange` should support:

- `ADDED`
- `CHANGED`
- `REMOVED`

Avoid storing `UNCHANGED` rows unless the audit requirement clearly justifies the database volume.

A change record must retain:

- source snapshot ID
- source ID
- entity type and ID
- fact type
- old value
- new value
- change type
- risk
- confidence
- evidence
- status
- reviewer
- review timestamp
- decision reason
- creation/update timestamps

## Risk Model

Suggested risk classification:

### Critical

- exam date
- application deadline
- result date
- eligibility
- age limit
- attempt limit
- official application URL
- official result URL
- major syllabus change
- major exam-pattern change

### High

- admit-card date
- answer-key date
- counselling dates
- application fee

### Medium

- exam duration
- exam mode
- paper count
- non-critical operational metadata

### Low

- descriptive metadata
- non-material wording
- secondary labels

Critical and high-risk changes must require editorial review. Automatic publication should not be used as a shortcut for official exam facts.

## Canonical Comparison Boundary

The prompt uses `Exam.examDate` as an example, but the actual schema must determine the correct canonical owner.

Do not automatically add an `Exam.examDate` field if the existing model stores dates in `ExamEvent`, `ExamYear`, or another canonical record.

The comparison should be conceptually:

```text
canonical value: 2026-06-23
extracted value: 2026-06-24

FactChange:
  oldValue: 2026-06-23
  newValue: 2026-06-24
  changeType: CHANGED
  risk: CRITICAL
  status: PENDING_REVIEW
```

If the normalized extracted value equals the canonical value, no change record should be created.

## Editorial Workflow

The intended workflow is:

```text
FactChange
    -> PENDING_REVIEW
    -> editor reviews evidence
    -> APPROVED, REJECTED, or IGNORED
```

Approval must record:

- reviewer identity
- decision timestamp
- decision
- optional reason or comment
- old value
- new value
- source and snapshot provenance

Do not overwrite history in a way that prevents later auditing.

## Idempotency

Repeated extraction of the same unchanged snapshot must not create duplicate facts or review items.

Use an idempotency identity based on the actual schema, likely including:

```text
sourceSnapshotId
+ entityType
+ entityId
+ factType
```

For changes, deduplicate repeated proposals using the source snapshot, canonical identity, fact type, normalized old value, and normalized new value as appropriate.

The database constraints should enforce the decision wherever practical.

## Failure Isolation

Extraction failures must not modify canonical data.

Required behavior:

```text
source fetch succeeds
    -> SourceSnapshot is stored
    -> extraction fails
    -> canonical value remains unchanged
    -> failure is recorded
    -> extraction can be retried
```

Malformed dates, invalid URLs, and invalid numeric values must be rejected by domain or Zod validation before persistence or canonical updates.

## Outbox and Worker Integration

Use the existing outbox and worker systems.

Do not create a second queue architecture.

The eventual approval flow should be:

```text
FactChange approved
    -> canonical update in transaction
    -> outbox event
    -> cache invalidation
    -> page revalidation
    -> search update where required
```

Source acquisition and semantic processing should remain separately observable.

## JEE Advanced Reference Implementation

After the generic fact layer exists, implement JEE Advanced first.

Use only verified official sources already present in the source registry or explicitly configured. Do not invent URLs.

The first complete demonstration should cover:

- notification date
- application start
- application end
- exam date
- admit-card availability
- answer-key date
- result date
- official application URL
- official result URL
- official information bulletin

Where the official source has not announced a date, absence must not be converted into a predicted fact.

## Tests Required

### Extraction tests

- valid exam date
- valid application start date
- valid application deadline
- multiple supported date formats
- date near irrelevant dates
- malformed date
- missing label
- duplicate facts
- evidence preservation
- confidence assignment

### Comparison tests

```text
same value
    -> no change

old value -> new value
    -> CHANGED

missing -> value
    -> ADDED

value -> missing
    -> REMOVED
```

### Risk tests

Verify risk classification for:

- exam date
- application deadline
- result date
- official URL
- application fee
- exam duration
- descriptive metadata

### Workflow tests

Verify:

```text
PENDING_REVIEW -> APPROVED
PENDING_REVIEW -> REJECTED
PENDING_REVIEW -> IGNORED
```

Also verify reviewer, timestamp, and reason persistence.

### Reliability tests

- repeated extraction is idempotent
- unchanged snapshots do not create duplicate work
- extraction failure leaves canonical data unchanged
- invalid values cannot update canonical data
- historical snapshots remain connected
- provenance is retained

### Mandatory end-to-end test

Use a deterministic fixture:

```text
Initial source:
Exam Date: 23 June 2026
Application ends: 27 April 2026
```

First run:

```text
SourceSnapshot A
ExtractedFact A
canonical exam date = 23 June 2026
```

Second source version:

```text
Exam Date: 24 June 2026
Application ends: 27 April 2026
```

Expected result:

```text
SourceSnapshot B
contentHash changed
ExtractedFact: EXAM_DATE = 24 June 2026
FactChange:
  old = 23 June 2026
  new = 24 June 2026
  risk = CRITICAL
  status = PENDING_REVIEW
```

No change should be created for the unchanged application deadline.

After approval:

```text
FactChange -> APPROVED
canonical exam date: 23 June 2026 -> 24 June 2026
outbox/revalidation event created
```

This test is the clearest proof of the architecture.

## API and Admin UI

### API

Expose only the endpoints needed by the editorial workflow:

```text
GET  /admin/fact-changes
GET  /admin/fact-changes/:id
POST /admin/fact-changes/:id/approve
POST /admin/fact-changes/:id/reject
POST /admin/fact-changes/:id/ignore
```

Protect them with existing authentication and authorization. Add a dedicated fact-review permission if existing permissions do not express the requirement.

### Admin UI

Build the smallest useful review surface, not a complete CMS.

It should show:

```text
Entity: JEE Advanced
Fact: Exam Date
Current: 23 June 2026
Proposed: 24 June 2026
Risk: CRITICAL
Confidence: HIGH
Source: Official JEE Advanced website
Fetched: timestamp
Evidence: source quotation

Approve | Reject | Ignore
```

The UI should be implemented after the data and API contracts stabilize.

## What Should Be Added to the Prompt

Add or make explicit:

1. A requirement to choose one fact-observation model name and responsibility.
2. A requirement to identify the actual canonical field owner from the existing schema.
3. A requirement that truncated snapshots are not parsed.
4. A requirement for extractor version/rule provenance.
5. A requirement for atomic approval plus canonical update plus outbox creation.
6. A requirement for database-enforced idempotency.
7. A requirement to distinguish source changes from semantic fact changes in metrics.
8. A requirement that missing information is not the same as an official `NOT_ANNOUNCED` fact.
9. A requirement to validate actual JEE Advanced source fixtures rather than only mocked generic pages.
10. A requirement to verify no existing canonical model or endpoint is duplicated.
11. A requirement to test concurrent or repeated approval safely.
12. A requirement to document the retry behavior after extraction failure.

## What Should Be Removed or Clarified

### Remove speculative duplication

Do not require both `OfficialFact` and `ExtractedFact` unless they have separate, documented roles.

### Correct canonical field examples

Do not require `Exam.examDate` specifically. The implementation must use the existing canonical owner, which may be `ExamEvent`, `ExamYear`, `Result`, or another model.

### Reduce the initial fact-type scope

Do not require every listed fact type in the first implementation. Begin with the smallest reliable JEE Advanced set.

### Clarify `NOT_ANNOUNCED`

Do not create a `NOT_ANNOUNCED` fact just because a date was absent. Only store it when the official source explicitly states that information has not been announced, or use absence as the representation.

### Defer the UI until the workflow exists

The UI should follow schema, extraction, comparison, API, and approval transaction implementation.

### Avoid broad platform expansion

This milestone should not include:

- LLM extraction
- embeddings
- RAG
- vector databases
- AI-generated content
- Redis
- Meilisearch
- multi-site architecture
- translation systems
- colleges and courses
- scholarships and jobs
- rank predictors
- study planners
- question-level analytics
- mass frontend page generation
- the full paper importer

### Clarify phase numbering

The earlier implementation plan calls the fact intelligence layer Phase 2, while this prompt calls it Phase 1. Pick one numbering scheme and use it consistently in documentation, commits, and status reports.

## Recommended Implementation Order

```text
1. Inspect canonical models, repositories, events, permissions, and tests
2. Choose ExtractedFact/OfficialFact terminology
3. Design fact and FactChange schemas
4. Add migrations and database constraints
5. Add typed fact enums and validation
6. Add deterministic JEE Advanced extractors
7. Add fact repository and extraction service
8. Add canonical comparison
9. Add risk classification
10. Add idempotency handling
11. Add extract-facts worker task
12. Add approval/rejection/ignore service
13. Add atomic canonical update and outbox event
14. Add admin API
15. Add mandatory end-to-end integration test
16. Add minimal editorial review UI
17. Add fact metrics and documentation
18. Run full verification matrix
```

## Acceptance Criteria

### Architecture

- existing Phase 0 source system remains intact
- existing worker remains authoritative
- existing outbox remains authoritative
- no duplicate source-monitoring or queue system is added

### Data

- fact observation model exists
- FactChange model exists
- provenance is complete
- risk and confidence are explicit
- idempotency constraints exist

### Processing

- changed snapshots can trigger extraction
- unchanged snapshots do not create duplicate work
- truncated snapshots are not parsed
- facts are normalized and validated
- semantic differences are detected

### Editorial

- high-risk changes require review
- approve works
- reject works
- ignore works
- reviewer and timestamps are recorded
- audit history is retained

### Integration

- approved changes update the correct canonical record
- outbox receives the correct event
- revalidation can be triggered
- existing APIs remain compatible

### Reliability

- extraction failures leave canonical data unchanged
- duplicate runs are safe
- historical snapshots remain intact
- Phase 0 tests remain green

### JEE Advanced

- at least one complete official-source-to-fact-to-review flow works
- exam date is demonstrated end-to-end
- application deadline is demonstrated end-to-end
- provenance is demonstrated

## Verification Matrix

Before declaring this milestone complete, run:

### Tests

```text
focused extraction tests
focused comparison tests
workflow tests
mandatory end-to-end test
full API test suite
```

### Typechecking

```text
all workspace packages with typecheck scripts
```

### Prisma

```text
prisma validate
prisma migrate status
```

### Database

Verify:

- migrations
- foreign keys
- unique constraints
- indexes
- enum values
- idempotency constraints

### Architecture

Run the existing architecture checks.

### Phase 0 regression

Verify:

- robots allowed
- robots disallowed
- robots unavailable
- HTTP 403/WAF
- DNS failure
- TLS failure
- malformed URL
- conditional fetch
- unchanged source
- changed source
- source history
- UTF-8-safe truncation

Do not claim the root Turbo wrapper passed when it fails only because Windows/Corepack cannot resolve the pnpm binary. Run package-level commands through Corepack pnpm and report the wrapper limitation separately.

## Current Verified Baseline

The existing Phase 0 verification established:

- focused source-fetch tests: 17/17 passed
- full API tests: 139/139 passed
- direct package typechecks: all packages with typecheck scripts passed
- architecture checks: 5/5 passed
- Prisma schema validation: passed
- database constraints: 17 applied, 0 failed
- PostgreSQL: version 18
- Prisma migration status: database schema up to date
- current source report: 0 sources genuinely disallowed by robots.txt

The root Turbo wrappers may fail in this Windows/Corepack environment because Turbo cannot resolve the pnpm executable. That is an environment/tool-resolution limitation, not an application failure, and must be reported separately.

## Final Conclusion

The SchoolToCareer repository is ready for implementation of the semantic fact layer, but Phase 1 is not complete yet.

The correct next milestone is:

```text
existing SourceSnapshot
    -> deterministic fact extraction
    -> ExtractedFact
    -> canonical comparison
    -> FactChange
    -> risk classification
    -> editorial review
    -> approved canonical update
    -> outbox
    -> revalidation
```

The project should optimize for:

**accuracy -> provenance -> reviewability -> idempotency -> maintainability -> scale**

Do not mark the phase complete when only models are created. Completion requires the automated JEE Advanced end-to-end flow and the verification matrix above.
