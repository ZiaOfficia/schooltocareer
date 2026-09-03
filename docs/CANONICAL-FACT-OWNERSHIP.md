# Canonical fact ownership

Which model owns each official fact, and why. Derived by reading
`packages/database/prisma/schema/*.prisma` and every consumer of those fields —
not by preference.

**The rule:** a fact has exactly one owner, and it is a model that already
exists. Nothing in Phase 2A added a column to store a fact.

Referenced from `packages/database/prisma/schema/facts.prisma` and
`apps/api/src/modules/fact/fact.types.ts`, which encodes the table below as
`CANONICAL_OWNER`.

## The decisions

| Fact | Canonical owner | Column | Why |
|---|---|---|---|
| Exam date | `ExamEvent` where `type = EXAM_DATE` | `startDate` + `endDate` | Already the model the exam page reads its dates from |
| Application start | `ExamEvent` where `type = APPLICATION_START` | `startDate` + `endDate` | Per-cycle, same as every other date |
| Application end | `ExamEvent` where `type = APPLICATION_END` | `startDate` + `endDate` | Per-cycle |
| Result date | `ExamEvent` where `type = RESULT` | `startDate` + `endDate` | See "Result vs ExamEvent" below |
| Application URL | `ExamEvent` where `type = APPLICATION_START` | `officialUrl` | Column exists; page already renders it as "Official notice" |
| Result URL | `ExamEvent` where `type = RESULT` | `officialUrl` | Same |

Every fact type lands on `ExamEvent`. That is not laziness — `ExamEvent`'s own
schema comment calls the important-dates block "the single highest-traffic block
on any exam page", and `apps/web/src/app/exam/[slug]/page.tsx` reads its four
headline dates from exactly these rows. Routing facts anywhere else would mean
the page and the fact engine disagreed about where truth lives.

## Rejected: `Exam.examDate`

The obvious shortcut, and the one the brief explicitly warns against. It does
not exist in the schema and must not be added:

- **An exam has a date per cycle, not per exam.** JEE Main runs two sessions a
  year; `ExamYear` and `ExamEvent` exist precisely to model that. A single
  column on `Exam` cannot represent the data.
- The moment a second session was announced, `Exam.examDate` and
  `ExamEvent(EXAM_DATE)` would disagree, and nothing would say which was right.

## Rejected: `Result.declaredAt` for `RESULT_DATE`

Tempting, because the name matches. Rejected after reading both models:

- `Result` is the **declared artefact** — a scorecard row carrying `officialUrl`,
  `links` (label/url/region) and `statistics` (pass %, toppers). One exam cycle
  can have several: paper 1, paper 2, a final merit list.
- `ExamEvent(RESULT)` is **one point on the exam timeline**, which is what the
  "Important dates" table and the `/exam/[slug]/result` page render.

So the split is by question answered, not by name similarity:

```
"When do results come out?"   -> ExamEvent(RESULT)        (the timeline)
"Here is the scorecard."      -> Result                   (the artefact)
```

`Result.declaredAt` stays the canonical record of when a *specific* result
artefact was declared. It is not a fact target for the extractor.

## Rejected: a third `OfficialFact` model

Considered because the brief allows for it, and rejected: it would be a third
store of the same value, sitting between the observation and the canonical row
with no reader of its own. An observation (`ExtractedFact`) plus a canonical
owner is sufficient, and two stores cannot drift the way three can.

`ExtractedFact` and `FactChange` have separately documented responsibilities:

- `ExtractedFact` — what **one snapshot** said, at one moment, per one extractor
  version. Immutable, append-only, never read by a page.
- `FactChange` — a semantic **difference** between an observation and the
  canonical value. The only thing that may cause a canonical write.

## Rejected: `Source.examId`

The extractor needs to know which exam a page speaks for. That binding lives in
`packages/constants/src/sources.ts` as `SourceSeed.watchesExamSlug`, not as a
database column:

- The registry already owns "which official page we watch". "What that page is
  authoritative about" is the same fact; splitting it across a constants file
  and a column gives it two owners.
- There is nothing to edit at runtime. A notice board does not become an
  exam-specific page because someone changed a dropdown.

The field is **absent** for multi-exam pages (`nta.ac.in`, `ssc.gov.in`), and
the extractor only runs where it is set. That is the mechanism preventing a date
on a shared notice board being attributed to one of the dozen exams on it.

## Write convention for dates

A single-point date sets **both** `startDate` and `endDate` to the same value.

This is not redundancy. The two readers disagree about which column to use:

- `apps/web/.../[section]/page.tsx` reads a deadline as `endDate ?? startDate`
- the hub's dates table renders `startDate – endDate`

A row with only one endpoint set renders as `To be announced – 27 Apr 2026`.
Writing both keeps the readers agreeing. A genuine window (GATE sits over four
days) sets them to the first and last day.
