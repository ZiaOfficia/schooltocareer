# Question bank

Previous-year questions as data: one row per question, filed by exam, subject
and chapter, with chapter statistics computed from them.

Why: every competitor has the paper PDF. What the papers say *across years*
(which chapters are asked, how often, and whether that is changing) needs the
questions as data. That is PRINCIPLES.md #3.

Schema: `packages/database/prisma/schema/questions.prisma`.
Syllabus data: `packages/constants/src/exam-syllabi.ts`.

---

## Sourcing rules

These are not style preferences. Breaking one is a reason to revert.

1. **Question text comes from the official paper.** Type or OCR it from the
   conducting body's PDF that `QuestionPaper` already hosts. Never copy question
   text from another website, even where it matches the official paper.
2. **Solutions are written here.** Every solution, explanation, chapter
   description and difficulty rating is our own work. Never paraphrase another
   site's solution.
3. **Nothing structural is taken from a competitor.** Chapter lists come from
   the official syllabus (`exam-syllabi.ts`), not from a coaching site's chapter
   split. Statistics are computed from our own published questions only.
4. **Answers carry their provenance.** `QuestionAnswer.provenance` says where the
   answer came from:

   | Value | Meaning | Shown as |
   | --- | --- | --- |
   | `OFFICIAL_FINAL` | The conducting body's final answer key | Official answer |
   | `OFFICIAL_PROVISIONAL` | Provisional key, before challenges | Provisional official answer |
   | `EDITORIAL` | No official key covers it; the answer is ours | Our answer |
   | `DROPPED` | Question dropped or marks given to all | Dropped by the conducting body |

   An `OFFICIAL_*` provenance requires `answerKeySourceUrl`. When a final key
   replaces a provisional one, re-check every answer from that paper.

## Publish rules

A question is publishable only when all of these hold. The database enforces
the structural ones (CHECK constraints, foreign keys); the rest belong in the
question module's publish path, as `assertPublishable` does for exams. That
module is not built yet; until it is, these are the review checklist:

- it has a chapter (`examChapterId`);
- it has a `QuestionAnswer` with a provenance and a solution;
- an `OFFICIAL_*` provenance has `answerKeySourceUrl`;
- a second person has reviewed it (`reviewedById`, `reviewedAt`);
- MCQs have at least one correct option, except `DROPPED`.

A chapter is published once it has published questions. An empty chapter page
is thin content (PRINCIPLES.md #6) and stays `noindex` / unpublished.

A chapter with `syllabusStatus` other than `IN_SYLLABUS` needs
`syllabusSourceUrl`: the label is a claim, and claims are sourced.

## Statistics

`ExamChapterYearStat` holds, per chapter and year, the raw counts and the
derived percentages, so every figure can be re-derived:

```
weightagePct = 100 × questions / subjectQuestions
changePct    = change in weightagePct vs the previous year with data
```

`papersInYear` is how many of that year's papers are digitised. When it is less
than the number held, pages say so ("based on 8 of 20 shifts"). Dropped
questions are excluded from counts. Rows are recomputed when a question in the
chapter is published or unpublished.

## Loading a syllabus

```
pnpm syllabus:seed --dry-run   # what would change
pnpm syllabus:seed             # apply
```

The loader refuses malformed data, never creates exams or subjects, writes new
chapters as `DRAFT`, never overwrites editorial fields, and never deletes.
Chapters dropped from the syllabus are listed for a person to decide.

**Before publishing any chapter of a syllabus, verify it.** Compare every title
in `exam-syllabi.ts` with the source document named in `sourceUrl`, then set
`verifiedAgainstSource: true` in the same commit. The loader warns while it is
false.

## Migrations

Two hand-written, additive migrations, applied with `migrate deploy` as
`tooling/scripts/guard-migrate-dev.mjs` describes:

- `20261010000000_owner_type_question_bank`: adds `QUESTION` and `EXAM_CHAPTER`
  to `OwnerType`, in its own file because a new enum value cannot be used in
  the transaction that adds it;
- `20261010000100_question_bank`: eight tables, six enums, foreign keys and four
  CHECK constraints (question number, marks signs, tolerance, stat counts).
