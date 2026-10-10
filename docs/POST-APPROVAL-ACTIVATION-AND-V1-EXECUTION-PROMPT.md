# SchoolToCareer — Post-Approval Activation and V1 Execution Prompt

**Validated:** 2026-09-06  
**Repository:** `C:\Users\HELLO\Desktop\schooltocareer`  
**API prefix:** `/api/v1`  
**Web:** `http://localhost:3000`  
**API:** `http://localhost:4000`

## Role

You are the lead engineer completing the next finite product phase of SchoolToCareer. Work inside the existing repository. Inspect the current code and database before changing anything.

The semantic fact engine and fact-review operation already exist. Do not rebuild them. The immediate work is to finish post-approval activation, safely deliver queued events, and then execute the student-facing V1 product roadmap.

## Security Rules

- Never print, repeat, store, or request an admin password, access token, API key, or other secret.
- Previously exposed credentials must be rotated or revoked outside this task.
- Do not put secrets in source files, Markdown, command arguments, screenshots, logs, or committed environment files.
- Use local environment files only through the existing configuration system.
- Do not create a login bypass or direct database approval path.

## Verified Current State

The following claims were validated against the current repository and configured database on 2026-09-06.

### Fact decisions

```text
FactChange APPROVED          5
FactChange IGNORED           1
FactChange PENDING_REVIEW    0
```

All six records have reviewer metadata and decision reasons. The authorized reviewer is recorded in the database; do not expose credentials associated with that account.

### Decisions

| Exam | Fact | Value | Final state |
|---|---|---|---|
| JEE Advanced 2026 | `EXAM_DATE` | `2026-05-17` | APPROVED |
| GATE 2026 | `RESULT_DATE` | `2026-03-19` | APPROVED |
| GATE 2026 | `EXAM_DATE` | `2026-02-07/2026-02-15` | APPROVED |
| GATE 2026 | `APPLICATION_END` | `2025-10-07` | APPROVED |
| GATE 2026 | `APPLICATION_START` | `2025-08-28` | APPROVED |
| CUET UG 2026 | `EXAM_DATE` | `2026-05-30` | IGNORED |

CUET must remain untouched in canonical data. Its ignored value is one day from a multi-day schedule and must not be written until a complete schedule source is available.

### FactChange IDs

Use these exact IDs when auditing existing records. Do not invent replacements:

```text
JEE Advanced EXAM_DATE
cmtlvdwv2000nv4387vjo6is1

GATE APPLICATION_END
cmtlvdw9y000fv438e83teqc6

GATE EXAM_DATE
cmtlvdvpa0007v438z6lwfwe3

GATE RESULT_DATE
cmtlvdwk7000jv4389ry8qibt

GATE APPLICATION_START
cmtlvdvzn000bv438j8529t65

CUET UG EXAM_DATE
cmtlvdv9s0003v438hotnaq6g
```

### Canonical state

The five approved values are stored as `ExamEvent` rows reached through `Exam -> ExamYear -> ExamEvent`:

```text
GATE APPLICATION_START
2025-08-28 -> 2025-08-28
isTentative = true

GATE APPLICATION_END
2025-10-07 -> 2025-10-07
isTentative = true

GATE EXAM_DATE
2026-02-07 -> 2026-02-15
isTentative = true

GATE RESULT
2026-03-19 -> 2026-03-19
isTentative = true

JEE Advanced EXAM_DATE
2026-05-17 -> 2026-05-17
isTentative = false
```

Every single-point date has both endpoints populated. The GATE exam is a window, not a single day. CUET 2026 has no canonical event from this review.

### Important verification correction

For newly created canonical events, `FactChange.canonicalId` remains `NULL`; therefore it must not be used as the only way to find approved events. Verify through the actual relation:

```text
approved FactChange.ownerId
    -> Exam.id
    -> ExamYear for the relevant cycle
    -> ExamEvent by event type
```

The existing `verify-fact-transaction.js` checker is incomplete because it queries events and outbox rows only through `FactChange.canonicalId`. Correct or replace that checker before relying on it. Do not change production facts merely to make the checker pass.

### Outbox state

Current pending outbox events for the activated exams:

```text
CACHE_REVALIDATE/PENDING    7
SEARCH_UPSERT/PENDING       2
Total                       9
```

The worker has not delivered these events yet. This is intentional and must be verified before processing.

### Identity activation

Authenticated Exam API updates have already set:

```text
gate         officialWebsite = https://gate2026.iitg.ac.in/
jee-advanced officialWebsite = https://jeeadv.ac.in/
```

Do not replace these with placeholders or direct database edits. CUET identity activation is still pending and requires verified source-backed values.

### Integrity state

The integrity gate currently passes:

```text
Fake dates                    0
Fake official URLs            0
Fake conducting bodies        0
Placeholder domains           0
Fabricated fallback facts     0
Unintentionally indexed       0
Sitemap fake URLs             0
```

Preserve this result.

## Required Work

### Phase A — Verify and document the post-approval state

1. Inspect the current code, database schema, migrations, and worktree.
2. Confirm the six FactChange records, statuses, reviewer metadata, timestamps, and reasons.
3. Confirm the five canonical events through `Exam -> ExamYear -> ExamEvent`.
4. Confirm CUET has no newly approved canonical event from this review.
5. Confirm date endpoint conventions and `isTentative` values.
6. Confirm the nine pending outbox events by exam owner ID.
7. Correct the verification script so it follows actual relationships and reports:
   - fact decisions;
   - canonical events;
   - outbox events;
   - counts by type and status.
8. Do not modify canonical data while correcting verification.

### Phase B — Deliver outbox events safely

Use the existing worker and outbox implementation. Do not add a second queue or transport.

Before processing:

- verify the event payloads and owner IDs;
- verify the events are `PENDING` and available;
- verify no duplicate event was created by the checker or by manual work.

Run the existing worker using the repository’s documented command. After delivery, verify:

- canonical data is unchanged;
- cache revalidation events are delivered or retried according to existing policy;
- search upserts are delivered or retried according to existing policy;
- no event is silently lost;
- failures remain observable;
- rerunning the worker is idempotent.

Do not mark events delivered by direct SQL.

### Phase C — Complete first exam identities

Activate only verified information for:

1. JEE Advanced
2. GATE
3. CUET UG

Required fields:

```text
conductingBody
officialWebsite
overview
```

Use the existing authenticated Exam API and content workflow. Do not write directly to Prisma from an ad hoc script.

Rules:

- no `example.test` or reserved domains;
- no guessed conducting bodies;
- no invented overview text;
- no unsupported dates, fees, eligibility, syllabus, or links;
- preserve the approved GATE window;
- preserve tentative labels where the source says the dates may change;
- do not turn CUET’s ignored date into a canonical event.

If a value cannot be verified, leave it null and let the existing honest unavailable/noindex behavior apply.

### Phase D — Verify first useful pages

For each activated exam, verify the relevant routes:

```text
/exam/jee-advanced
/exam/gate
/exam/cuet
```

Also verify available lifecycle and paper cluster routes without assuming that every route should be indexable.

For each page check:

- HTTP status;
- H1 and title;
- description;
- canonical URL;
- robots metadata;
- structured data;
- official website/action link;
- important dates;
- tentative versus confirmed presentation;
- provenance/source link;
- useful internal links;
- no placeholder data;
- no dead links;
- mobile layout.

A route may be indexable only when the existing `evaluateIndexability` rules say it has genuinely useful minimum content. Otherwise it must remain `noindex, follow` and must not enter the sitemap.

### Phase E — Run the release gates

Run current checks directly if the root Turbo wrapper cannot resolve pnpm in the Windows/Corepack environment:

```text
corepack pnpm --filter @stc/api test -- --run
corepack pnpm --filter @stc/api typecheck
corepack pnpm --filter @stc/web typecheck
corepack pnpm --filter @stc/database typecheck
corepack pnpm --filter @stc/database validate
corepack pnpm --filter @stc/database db:migrate:status
corepack pnpm arch:check
corepack pnpm gate:integrity --live
```

Also run the production web build with the API available on port 4000, because sitemap prerendering intentionally requires the API:

```text
corepack pnpm --filter @stc/web build
```

Do not claim lint is green until the missing ESLint flat configuration is fixed and the repository lint command passes. That is a separate maintenance task and must not be hidden.

### Phase F — Execute the student product roadmap

After production activation passes, stop extending infrastructure and execute the existing Product Map.

#### F1. Major exam product cohort

Select a bounded, evidence-backed cohort. Treat the current fetchability-based tier as provisional until Search Console or analytics data exists.

For each selected exam, complete only useful, verified intents:

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

Each delivered intent requires:

```text
data + API + page + SEO + source/trust + student usefulness + tests
```

Do not mass-create thin pages.

#### F2. Real previous-year paper product

Build the importer around existing models and storage abstractions:

```text
official discovery
    -> identify document
    -> normalize metadata
    -> validate source and ownership
    -> download or reference lawfully
    -> hash
    -> deduplicate
    -> store
    -> browse/detail/download page
```

Do not publish the 3,000 synthetic draft papers. Every live paper must have verified metadata and a legitimate access path.

#### F3. Results and lifecycle

Complete authoritative lifecycle presentation for applications, admit cards, answer keys, results, and important dates. Preserve confirmed, tentative, unavailable, and not-announced distinctions.

#### F4. Board product

Start with a small verified board cohort. Build useful board, class, subject, syllabus, paper, result, date-sheet, and notice experiences before chapter-level expansion.

#### F5. Universal search

Complete the student-facing search workflow, real indexing, facets, empty states, zero-result tracking, and search analytics. Validate the student journey, not just the search API.

#### F6. Editorial operations

Build an admin workspace around existing authentication, permissions, fact APIs, source snapshots, content drafts, revisions, publishing, and audit history. The CLI remains acceptable for immediate fact activation, but V1 requires maintainable editorial operations.

#### F7. SEO scale and measurement

Measure indexing, crawl errors, canonical behavior, Core Web Vitals, impressions, clicks, official-action completion, and representative student journeys. Expand URLs only when content and demand justify them.

## Non-Negotiable Architecture Rules

Do not add:

- another fact model;
- another canonical owner for the same value;
- another crawler;
- another worker process;
- another queue or event bus;
- another search engine without measured need;
- direct SQL approval or direct canonical mutation scripts;
- LLM extraction or AI-generated factual content;
- fabricated seed data;
- placeholder URLs;
- guessed dates, authorities, fees, eligibility, or source evidence.

Preserve:

- `ExamEvent` as the canonical owner for these lifecycle facts;
- `ExtractedFact` as observation history;
- `FactChange` as the only semantic approval input;
- authenticated reviewer attribution;
- transaction locking and stale-version protection;
- outbox and revalidation behavior;
- integrity and indexability gates;
- existing API, validation, auth, error, and repository conventions.

## Completion Report Required

At the end of the activation phase, report:

1. Exact FactChange statuses and decision reasons.
2. Canonical events found through relationships, not only `canonicalId`.
3. Outbox events before and after worker delivery.
4. Identity fields added and their evidence sources.
5. Routes verified and their index/noindex outcomes.
6. Integrity gate output.
7. Test, typecheck, migration, architecture, and build results.
8. Any lint limitation.
9. Remaining blockers.
10. The next Product Map items selected and why.

## Stop Conditions

Stop the activation task when all of the following are true:

- all six FactChanges have final human dispositions;
- five approved events are confirmed through the actual exam-cycle relationship;
- CUET remains without a canonical event from the ignored observation;
- outbox delivery has been verified through the existing worker;
- first exam identities are source-backed;
- representative pages render honestly;
- indexability and sitemap behavior are verified;
- integrity is clean;
- focused tests and typechecks pass;
- no secrets were exposed or requested.

Do not begin AI, embeddings, question intelligence, college/career expansion, or a new infrastructure redesign in the activation task.

Once this stop condition passes, the next task is execution of the existing Master Search Product Map across the selected major-exam cohort.
