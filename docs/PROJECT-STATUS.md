# Build status

**As of 9 Aug 2026.** Counts taken from the live seeded database, not estimated.

The backend is complete and validated against real PostgreSQL. The frontend is
one reference page and the foundation beneath it. The hard architecture is done
and almost none of the site is.

## How much is not built

**The unit of work is templates, not pages.** An earlier version of this document
led with "7,315 URLs missing", which is true and misleading. Those URLs are
produced by roughly **18 distinct templates**. `/previous-year-papers/[slug]` is
one engineering problem whether it renders 3,000 papers or 200,000 — past that
point it is a content problem, not a build problem.

| | count |
| --- | --- |
| Distinct templates to build | **~18** |
| Templates built | **2** (home, exam hub) |
| URLs the current seed implies | 7,336 |
| URLs live | 21 |

Keep both numbers in view. The template count is what you schedule against; the
URL count is what tells you which template to schedule first.

## Built and verified

| Area | State | Detail |
| --- | --- | --- |
| Database | Validated | 30 models on PostgreSQL 18.4 (Neon). Outbox with `FOR UPDATE SKIP LOCKED`, 3 recursive CTEs, generated `tsvector` with Devanagari branch, `NULLS NOT DISTINCT` constraints, 10 partial indexes, `pg_trgm`. |
| API | Complete | 96 endpoints, 8 feature modules + 4 shared, 128 source files. Disjunctive faceting, keyset pagination, slug history + redirects, revisions, scheduled publishing. |
| Frontend | Started | Next 15 / React 19 / Tailwind 4, 10 source files. Design system, SEO framework, typed API client, one reference page. Zero client components, ~103 kB First Load JS. |
| Tooling | In CI | `arch:check`, `verify:e2e`, `db:plans`, `db:constraints` — all typechecked alongside the app. |

Last full pass: **11/11** packages typecheck · **122** tests · **5/5** architecture
metrics · **34/34** database checks · **10/10** query plans · `next build` clean.

## Not built

URL counts are what the current seed would produce. The API endpoint behind each
already exists unless noted — these are frontend pages, not missing backend work.

| Route | Page | URLs |
| --- | --- | ---: |
| `/exam/[slug]/{7}` | syllabus, pattern, eligibility, application, admit card, answer key, result | 140 |
| `/board/[b]/[c]/[subject]` | Subject | 1,402 |
| `/board/[b]/[c]/[s]/[chapter]` | Chapter | 1,200 |
| `/previous-year-papers/[slug]` | Paper detail | 3,000 |
| `/board/[b]/[class]` | Board class | 320 |
| `/board/[b]/[c]/syllabus` | Class syllabus | 320 |
| `/board/[b]/[c]/previous-year-papers` | Class papers | 320 |
| `/blog/[category]/[slug]` | Article | 300 |
| `/results/[slug]` | Result detail | 200 |
| `/exam/[slug]/previous-year-papers/[year]` | Papers by year | 60 |
| `/board/[slug]` | Board hub | 20 |
| `/exams/[category]` | Exam category | 15 |
| `/blog/[category]` | Article category | 7 |
| index pages | `/exams` `/boards` `/previous-year-papers` `/results` `/blog` | 5 |
| static | about, contact, privacy, terms, disclaimer | 5 |
| `/search` | Search results — designed, not coded | 1 |
| `/news` + 2 | News — no seeded rows | 1 |
| `/author/[slug]` | Author — no seeded rows | 0 |
| `/login`, `/admin/*` | Admin designed, not coded | — |

**Total implied by seed: 7,336.**

Ordering matters more than the count. Paper detail is 3,000 URLs but each is thin
by nature; the 7 exam cluster pages are only 140 URLs but they are what makes
"JEE Main syllabus" rank.

## At launch volume (estimates)

| Cluster | Driver | Seed | Launch |
| --- | --- | ---: | ---: |
| Exam cluster | 100 exams × 9 pages | 235 | ~1,400 |
| Board cluster | 50 boards × 12 classes × subjects | 3,582 | ~35,000 |
| Papers | 20,000 papers | 3,000 | ~20,000 |
| Results | 1,200 declarations | 200 | ~1,200 |
| Editorial | 2,000 articles + news | 308 | ~2,200 |
| **Total** | | **7,336** | **~59,800** |

**Risk:** roughly 30,000 of that are chapter pages. Shipped as auto-generated
stubs they are textbook thin content, and at that ratio they can drag the domain
down rather than merely failing to rank.

## Tiering rule

"Own one search intent completely" and "100,000 SEO pages" pull in opposite
directions. They reconcile as four tiers.

- **Tier 0 — Money pages (~50).** JEE Main, NEET, CBSE Class 10 and 12, UPSC,
  SSC CGL, IBPS PO, CUET, GATE, CAT. Disproportionate effort: original graphics,
  historical analysis, interactive tools, download centre, deep internal linking.
  These should be the best pages in India on their subject, and the honest test
  is whether a student can finish their task without opening a second tab.
  **Tier 0 is not a content tier — it is a product tier.** Each one is closer to
  a small application than a page.
- **Tier 1 — Hubs (~1,400).** Full reference-page depth, editorially maintained,
  indexable. These carry the rankings.
- **Tier 2 — Records (~21,000).** Papers, results, articles. Honest and shallow:
  the file, its metadata, breadcrumbs, links to the hub. Indexable, never padded.
- **Tier 3 — Long tail (~37,000).** Chapters and subject leaves. `noindex, follow`
  until they hold real content. Gate on content, not on existence.

The mechanism exists: `buildMetadata` takes a `noindex` flag and `NOINDEX_PATHS`
is enforced centrally, so this is a policy applied in one place.

## Deliberately deferred

Full 89-model design preserved at `docs/architecture/schema-full-v1/`.

- **Phase 2 — content:** colleges, courses, careers, scholarships, jobs; cutoffs
  and answer keys as models; tags and internal linking; RBAC tables. `OwnerType`
  already carries the enum values, so these are additive.
- **Phase 3 — tools:** rank/percentile/college predictors, marks calculator,
  paper analyser, study planners, countdowns. None need new models — they are
  computation over data already held.
- **Phase 3 — platform:** analytics, embeddings, AI; translation tables; real
  multi-site (`siteId` already threaded through every constraint); Redis provider;
  Meilisearch behind `ISearchProvider`.

## Open items

| Item | Why it matters |
| --- | --- |
| ~~`pgbouncer=true` latency~~ | **Closed 9 Aug.** Removed after a 24-way concurrency test: 192/192 queries succeeded without it, at 20 ms/query vs 64 ms. Watch for `prepared statement "s0" already exists` in logs; that signature means put it back. |
| ~~Database region~~ | **Closed 9 Aug.** Moved us-east-2 → ap-southeast-1. Round trip 276 ms → 93 ms; seed 653 s → 214 s. |
| Database credential | Current Neon password was shared in a chat transcript. Rotate out-of-band before real user data exists. The old us-east-2 project should be deleted, not left running. |
| Seed display names | Exams stored as `JEE MAIN`, rendering in caps. Wrong as the convention editors copy. |
| DTO sharing | Only `ExamDto` is hoisted to `@stc/types`. 7 modules still declare DTOs inside the API. |
| Provenance untested | Every seeded date is `isTentative`, so the *official* branch has never rendered against real data. |
| ESLint on tooling | `tooling/scripts` typechecks but has no `lint` script. |
| Worker not deployed | Cache revalidation, Cloudinary round-trip and IndexNow are asserted as outbox rows only; delivery has never run. |
| Nothing deployed | No Vercel, no Render, no DNS. The apex canonical policy is enforced in code but never exercised in production. **Now Phase A.** |
| Editorial workflow — UI only | The *workflow* exists: `ContentDraft`, `ContentRevision`, `PublishStatus`, scheduled publishing (verified in `verify:e2e`), and `EXAM_PUBLISH` separated from `EXAM_MANAGE` so an author can draft but not publish. What is missing is the admin UI, plus two steps that were never modelled: a **fact-check gate** and **update reminders** for pages that go stale. The second matters most — an exam page that was right in March and wrong in June is worse than no page. |
| No question-level data | Blocks insights, chapter analytics and real recommendations. See "What the schema cannot do yet". |

## What the schema cannot do yet

This matters because several of the most valuable ideas depend on it, and the
gap is easy to miss.

**There is no question-level model.** The finest granularity is `QuestionPaper`
(a whole paper) and `QuestionPaperFile` (the PDF). The 30 models contain no
`Question`, no per-question topic tagging, and no per-question difficulty.

So the graph is:

```
Board → Class → Subject → Chapter
Exam  → Year  → Paper (year, shift, session, subject, paperType, locale)
```

not:

```
Question → Chapter → Subject → Exam → Difficulty → Year → Shift
```

| Wanted | Possible today |
| --- | --- |
| "All Physics papers, JEE Main, 2017–2026" | **Yes** — paper-level facets exist |
| "Every Mechanics *question* in that range" | **No** — questions are not modelled |
| "Electrostatics weightage fell 8% since 2021" | **No** — needs question→chapter tagging |
| "Most repeated chapters" | **No** — same reason |

An insight engine and a genuine recommendation engine both sit on top of this
missing layer. Adding it is a `Question` model plus `QuestionTopic`, and the
expensive part is not the schema — it is tagging 20,000 papers' worth of
questions to chapters. That is an editorial and possibly ML programme, not a
sprint. **Worth deciding early, because it changes what Tier 0 pages can promise.**

## Roadmap

Revised after review. The ordering principle is: start the clock on things that
need calendar time, then build the template that unlocks the most other templates.

### Phase A — Deploy (now)

Deploy what exists today: home, exam hub, robots, sitemap. Not for visitors —
for the things that cannot be validated locally and that need elapsed time:

- Render cold starts, Vercel function limits, CDN and compression behaviour
- Real DNS, SSL, and the apex canonical policy actually exercised
- Search Console verification and the start of index history
- Core Web Vitals **field** data, which needs weeks of real traffic

You lose nothing by starting that clock with three page types instead of twenty.

### Phase A2 — Observability (immediately after)

The first month of real data will say things no planning document can. None of
this is useful retroactively, so it goes in before the traffic does.

- Search Console verified; sitemap submitted; Index Coverage watched weekly
- Analytics with the events that matter here: PDF downloads, internal search
  terms, zero-result queries
- Core Web Vitals **field** data (CrUX needs weeks of real sessions)
- 404 and crawl-error monitoring, server logs, sitemap fetch status

`SearchQueryLog` already captures internal zero-result queries — that table is
the editorial backlog, and it only starts filling once people arrive.

### Phase B — Search

Search is the universal renderer. Board hubs, class pages, paper browse, exam
category listings and result listings are all the same component with different
presets. Building it well finishes a large fraction of the remaining templates
as a side effect.

### Phase C — Paper detail

Evergreen and transactional. "JEE Main 2021 Physics Shift 2 PDF" is searched
every year by a new cohort, and the intent is unambiguous.

### Then

Exam cluster (7 routes) → board cluster → results and articles → admin and
editorial UI → Tier 0 build-out → predictors and calculators → question-level
tagging, insights, recommendations.

### The KPI

**Queries owned, not pages published.** Owning "JEE Main syllabus", "JEE Main
eligibility", "JEE Main answer key" and "JEE Main previous year papers"
completely is what makes Google trust the domain for "JEE Main" generally.
Authority compounds per topic cluster, not per URL.

## Intent map

Schedule by intent, not by route. An intent is *satisfied* only when every page
it needs exists and is good — a half-satisfied intent earns nothing.

| Intent | Pages needed | Satisfied |
| --- | --- | --- |
| "When is the exam / am I eligible" | exam hub, eligibility, dates | **partial** — hub only |
| "Download a specific paper" | paper detail, paper browse, exam papers | no |
| "What's on the syllabus" | syllabus, pattern, chapter weightage | no |
| "Has my result come out" | result detail, exam result, result browse | no |
| "What do I study for Class 10 X" | board → class → subject → chapter | no |
| "Which exam should I take" | exam category, comparison | no |
| "What will the cutoff be" | cutoff pages, predictors | no — needs Phase 2 models |
| "Which chapters matter most" | chapter analytics | no — needs question-level data |

**Current score: 0 of 8 intents fully satisfied, 1 partial.** That is a more
honest headline than "21 URLs live", and it is the number to move.

## Tier 0 checklist

A page is Tier 0 only if **every** item passes. Missing one means it is Tier 1
with ambitions. The point of a checklist is that it cannot be argued with.

| # | Requirement | Machine-checkable |
| --- | --- | --- |
| 1 | Complete overview, conducting body, official link | no |
| 2 | Full official timeline, every event dated or explicitly "not announced" | yes |
| 3 | Previous papers linked, with counts | yes |
| 4 | Syllabus page complete | yes |
| 5 | Exam pattern complete | yes |
| 6 | Eligibility complete | yes |
| 7 | FAQs answered inline, none fabricated | no |
| 8 | Original analysis — something no competitor has | no |
| 9 | Structured data valid (breadcrumb + page schema) | yes |
| 10 | Internal links to every cluster page, and inbound from ≥3 | yes |
| 11 | Download centre — every asset in one place | yes |
| 12 | Lighthouse performance ≥ 95 mobile | yes |
| 13 | Every fact carries provenance | yes |
| 14 | Human editorial review, signed and dated | no |

Ten of fourteen are machine-checkable, so this should become a script that runs
in CI against the live site and fails the Tier 0 claim rather than a document
someone remembers to consult.
