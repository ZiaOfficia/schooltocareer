# Production data integrity

**3 Sep 2026.** Why the integrity gate exists, and what it is checking for.

## What happened

For roughly three weeks, `schooltocareer.in` served 100 indexable exam pages
built entirely from placeholder data.

`https://www.schooltocareer.in/exam/jee-advanced` returned HTTP 200 with
`<meta name="robots" content="index, follow">` and told a student that:

- JEE Advanced 2026 is on **23 Jun 2026** — a random date
- applications run **2 Mar – 27 Apr 2026** — random dates
- the exam is conducted by the **National Testing Agency** — it is conducted by
  the IITs
- the official website is **`https://example.test/jee-advanced`** — a reserved
  TLD (RFC 6761) that can never resolve

All 20 seeded exams carried the same conducting body, wrong for 15 of them
including CAT, GATE, UPSC, SSC, IBPS, SBI, RRB, CTET, BITSAT and CLAT. Of 417
`ExamEvent` rows, 278 were marked `isTentative = false` — presented as
confirmed.

Nothing failed. No error was logged. Every page returned 200, rendered
correctly, passed its build, and was submitted to Google in the sitemap.

## How it happened

The volume seed is doing its job correctly. Its own header says so:

> VOLUME. A few dozen rows prove the schema accepts inserts; they prove nothing
> about query plans.

To be useful for query plans, its rows must pass the API's `publicOnly` filter,
so it writes `status: 'PUBLISHED'`. In a throwaway database that is right.

On 2026-08-11 a `prisma migrate dev` detected drift against objects Prisma does
not model, reset the database, and destroyed every row. (That incident produced
`tooling/scripts/guard-migrate-dev.mjs`.) The database was refilled by running
the seed — against production.

So the chain was: a correct fixture, a destructive migration, and a recovery
step that used the fixture as if it were content. Each link was locally
reasonable. Nothing in the system objected.

**The lesson is not "be careful with the seed".** Care had already been
exercised and documented — `operational-validation.md` said to use
`migrate deploy`, and it happened anyway. That is why the response is a gate
and a guard, not a note.

## What was changed

### 1. The seed refuses to run against a non-local database

`guardRemoteSeed()` in `prisma/seed/index.ts`, following the pattern of
`guard-migrate-dev.mjs`. It lives **inside** the seed rather than in a wrapper
because `prisma migrate reset` invokes `prisma.seed` directly and would walk
straight past a wrapper — which is exactly the path that caused the incident.

Override, when you mean it: `ALLOW_REMOTE_SEED=1 pnpm db:seed`.

### 2. `Exam.conductingBody` is nullable

"We have not sourced this yet" is a real state, and a `NOT NULL` column made a
guess unavoidable. `assertPublishable` still requires it to publish, so this
widens what can be **stored**, not what can be **published**.

### 3. Indexability is wired in, not merely available

`evaluateIndexability` and `REQUIRED_FIELDS.EXAM_HUB` already existed in
`@stc/utils`, complete with word floors, override handling and an explanation
of why indexability is a score rather than a word-count gate.

**It was never called.** That is the whole reason placeholder pages went out as
`index, follow`.

It is now computed once in the API and carried on `ExamListItemDto.isIndexable`,
so the page's `generateMetadata` and the sitemap read the same value. They must
agree: a sitemap entry for a URL that responds `noindex` is a contradiction sent
on every crawl.

### 4. "Official" provenance now requires a source, by type

The exam page derived confidence as:

```ts
confidence={events.some((e) => e.isTentative) ? 'tentative' : 'official'}
```

`[].some()` is `false`, so an exam with **no dates at all** rendered a green
**Official** badge — "Published by the conducting body" — pointing at
`example.test`.

`ProvenanceProps` is now a discriminated union: `confidence: 'official'`
requires a non-null `sourceUrl`. Claiming official provenance without a source
no longer typechecks. A fourth state, `unsourced`, is the honest default.

The type change immediately caught the same bug in the section page, where the
no-date case claimed `estimated` — a badge reading "our estimate from previous
years" for an estimate nobody had made.

### 5. Unsafe fallbacks removed

| Was | Now |
| --- | --- |
| `description: exam.overview ?? '${name} ${year} exam information.'` | omitted when there is no overview |
| `subjectOf: { name: conductingBody }` with a null body | property omitted from the JSON-LD |
| "papers are available on this site, free and without registration" | "where we hold them" — the page has no paper count and could not check |
| "Conducted by **null**" | line omitted |

### 6. The purge

`pnpm data:purge-placeholder` (dry run) / `--apply`. It selects on the seed's
own id namespace — every synthetic row is `seed_<kind>_<key>` — so the selector
is exact and an editor's row cannot match it.

It clears fabricated **facts** and unpublishes fabricated **content**. It does
not delete: `QuestionPaper`, `Result` and `ContentEntry` go to `DRAFT`, which
removes them from every public read path while leaving the rows the query-plan
captures were taken against.

Applied 3 Sep 2026: **4,157 rows**.

| | |
| --- | ---: |
| `Exam.officialWebsite` → NULL | 20 |
| `Exam.conductingBody` → NULL | 20 |
| `Exam.overview` → NULL | 20 |
| `ExamEvent` deleted | 417 |
| `Result.officialUrl` → NULL | 200 |
| `Result` → DRAFT | 200 |
| `QuestionPaper` → DRAFT | 3,000 |
| `ContentEntry` → DRAFT | 300 |

Reference data — boards, classes, subjects, exam categories — is real and was
left untouched.

## The gate

```
pnpm gate:integrity          # database checks
pnpm gate:integrity --live   # also fetches the deployed sitemap and pages
```

Seven counts, all of which must be zero. Non-zero exit, so it can sit in CI or a
release step rather than being a check someone remembers to run.

| Check | What a non-zero value means |
| --- | --- |
| Fake dates | A published date with no provenance anywhere — no `officialUrl` on the event, no usable `officialWebsite` on the exam |
| Fake official URLs | A published exam or result pointing at a placeholder host |
| Fake conducting bodies | One authority shared by more than 8 published exams — a placeholder, not a coincidence |
| Placeholder domains | `example.*` anywhere publicly reachable, including media URLs |
| Fabricated fallback facts | Four or more exams sharing a verbatim overview — a string written to clear a publish gate, not content |
| Unintentionally indexed | An incomplete exam page serving anything but `noindex` (requires `--live`) |
| Sitemap fake URLs | The deployed sitemap advertising an exam not backed by real data (requires `--live`) |

Two of the checks were wrong when first written, which is worth recording
because it is the same failure in miniature:

- **Fake dates** tested `officialWebsite IS NULL` only, so `example.test`
  counted as provenance and the check reported **0** while 417 fabricated dates
  sat in the database. A fake citation satisfied a test for citations.
- **Fabricated fallback facts** grouped on the first 120 characters of the
  overview. Every templated overview opens with its own exam's short name, so
  no two matched and it also reported **0**. It groups on the tail now.

A check that cannot fail is worse than no check, because it is reported as a
pass.

## What this does not fix

The exam pages are now honest and empty. They render "Not officially announced
yet", carry `noindex, follow`, and are absent from the sitemap. That is the
correct state for pages with no sourced facts, and it is not a finished product.

Filling them is Phase 2A's job: the fact engine extracts from
`SourceSnapshot`, an editor approves, and the canonical record is updated with
provenance. `isIndexable` then flips per exam automatically — no deploy, no
list to maintain.

One consequence to keep in view: `pnpm db:plans` now captures plans against a
database whose content tables are almost entirely `DRAFT`, so the published-row
filters select far fewer rows than they will in production. Re-capture plans
against a local seeded database, not this one.
