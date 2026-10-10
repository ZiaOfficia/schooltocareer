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
load path. `pnpm questions:import` (below) enforces every one of them before it
writes; they are also the checklist a reviewer works through:

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
questions are excluded from counts. `pnpm questions:import` recomputes every
row for the exam after each import, because a new paper changes every chapter's
share of its subject, not only its own.

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

## Loading questions

One reviewed JSON file per paper, in `tooling/scripts/data/questions/<paper-slug>.json`.
The file is the source of truth; corrections go into it and are re-imported, so
every change to a published answer has a commit.

```
pnpm questions:import <file> --check            # validate the file, no database
pnpm questions:import <file> --dry-run          # check against the database, write nothing
pnpm questions:import <file>                    # load as DRAFT
pnpm questions:import <file> --publish --reviewer <email>
```

How a file is made:

1. Transcribe stems and options from the **official paper** only, in Markdown
   with `$…$` / `$$…$$` LaTeX. Options keep the paper's order, labelled A–D.
   Diagrams are cropped from the paper into
   `apps/web/public/images/questions/<paper-slug>/` and referenced as images
   with descriptive alt text.
2. Mark the correct options (or the numeric value) from the **official final
   key**, matched by NTA question and option IDs, not by eye. Where the key
   accepts more than one option, list them all; the practice widget scores
   any of them as right.
3. Write the solution fresh. Never paste from another site. Where a question
   is flawed, say so plainly and say what the official key decided.
4. Check every formula typesets and every numeric answer recomputes.

The importer matches questions on (paper, number) and keeps each publicId, so
a question's URL survives re-imports. It never deletes, never creates the exam,
paper or chapters, refuses to change a live question without `--publish
--reviewer`, publishes a chapter with its first published question, recomputes
the year statistics and queues a `CACHE_REVALIDATE` outbox event for the
question, chapter and paper pages. The API's own read cache for these entities
expires on its TTL.

## Migrations

Two hand-written, additive migrations, applied with `migrate deploy` as
`tooling/scripts/guard-migrate-dev.mjs` describes:

- `20261010000000_owner_type_question_bank`: adds `QUESTION` and `EXAM_CHAPTER`
  to `OwnerType`, in its own file because a new enum value cannot be used in
  the transaction that adds it;
- `20261010000100_question_bank`: eight tables, six enums, foreign keys and four
  CHECK constraints (question number, marks signs, tolerance, stat counts).
