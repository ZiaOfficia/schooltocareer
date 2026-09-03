# SCHOOLTOCAREER_MASTER_SEARCH_PRODUCT_MAP

Phase 1 product artefact. Starts from student questions, not URLs, and records
for each one: the product decision, the data it needs, who owns that data, where
it comes from, whether it may be indexed, and what is actually blocking it.

**Status: Phase 1 closed.** Every mandated intent has a decision, a canonical
owner, a source strategy, an index/noindex rule and an acceptance test. The
cohort is selected from measurement rather than assumption.

---

## 1. What the repository actually contains

Every claim below was read out of the live database and the source code on
2026-09-04, not from a previous status document.

### Student-facing data

| Table | Rows | Usable? |
|---|---|---|
| `Exam` | 20 published | **No facts.** `conductingBody`, `officialWebsite`, `overview` are NULL on all 20 |
| `ExamYear` | 60 published | Cycles exist (2024/2025/2026 × 20) |
| `ExamEvent` | **0** | No dates exist anywhere in the system |
| `QuestionPaper` | 3000, **all DRAFT** | Seed junk: "Question Paper 1582 — 2026", files on `cdn.example.test` |
| `Result` | 200, **all DRAFT** | Seed junk: "Result 0 2024", no official URLs |
| `ContentEntry` | 300, **all DRAFT** | All `ARTICLE`/`NEWS`. No syllabus or eligibility content for any exam |
| `PageSection` | **0** | The model that would hold eligibility/pattern prose is empty |
| `FaqItem` | **0** | |
| `Source` / `SourceSnapshot` | 24 / 40 | **The only real data in the system** |

**Consequence:** `isIndexable` requires `conductingBody` + `overview` +
sufficient body. Zero exams satisfy it, so today the sitemap contains six static
URLs and every exam page correctly serves `noindex, follow`. Verified live:
`/exam/gate` and all four cluster pages return 200 with `noindex, follow`.

The product is not thin — it is empty, and it is honestly empty. That is the
correct state given the data, and it is why **facts are the blocking dependency
for every intent below**.

### Source fetchability — measured, not assumed

This is the evidence the cohort is selected on. Run `pnpm facts:extract --dry-run`
to reproduce.

| Source | robots | Body stored | Text after strip | Facts extractable |
|---|---|---|---|---|
| `gate2026.iitg.ac.in` | allowed | 44 kB | rich | **4** — exam date, app start, app end, result date |
| `jeeadv.ac.in` | allowed | 65 kB | rich | **1** — exam date |
| `cuet.nta.nic.in` | intermittent | 92 kB | rich | **1** — exam date |
| `ugcnet.nta.nic.in` | intermittent | 97 kB | rich | 0 — states nothing about a watched fact |
| `sbi.co.in/web/careers` | allowed | 176 kB | rich | 0 — corporate PR; its only dates are award ceremonies |
| `nta.ac.in` (+ archive) | allowed | 2.2 MB / 680 kB | **truncated** | 0 — refused; a partial body is never parsed |
| `iimcat.ac.in` | allowed | 1.9 kB | **12 chars** | 0 — JavaScript shell |
| `ssc.gov.in` (both) | allowed | 32 / 80 kB | **55 chars** | 0 — JavaScript shell |
| `jeemain.nta.nic.in` | unavailable | **none** | — | 0 — never successfully fetched |
| `neet.nta.nic.in` | unavailable | **none** | — | 0 — never successfully fetched |
| `upsc.gov.in`, `ibps.in`, CBSE, CISCE | unavailable | none/thin | — | 0 |

**The finding that drives everything else:** the two highest-intent exams in
India — JEE Main and NEET UG — have **no readable official source today**. Their
NTA subdomains have never returned a body. Meanwhile GATE, whose search demand
is far lower, is the single most productive page on the watch list because it
publishes a labelled `IMPORTANT DATES` table in server-rendered HTML.

A cohort chosen on assumed search volume would have started with JEE Main and
built a page with nothing to put on it.

---

## 2. Cohort selection

**PROVISIONAL — repository/product evidence.**
**Validation required: Search Console or analytics.**

No search-volume data exists for this site (`SearchQueryLog` is empty, no Search
Console export is in the repository). Rather than invent volumes, the cohort is
ranked on the one axis that is measured: **can we obtain a verifiable official
fact today?** That is a necessary condition for every intent in the map, so it
is a legitimate first filter — but it is a *feasibility* ranking, not a market
ranking, and it must be re-cut against real demand once Search Console is
connected.

| Tier | Exams | Basis |
|---|---|---|
| **A** | GATE, JEE Advanced, CUET UG | Readable single-exam official source; facts already extracted and pending review |
| **B** | SBI PO, CAT | Bound source that fetches, but yields nothing usable — CAT needs a JS-rendering strategy, SBI needs a recruitment notice to exist |
| **C** | JEE Main, NEET UG, UPSC CSE, SSC CGL, SSC CHSL, IBPS PO, RRB NTPC | No readable body. Blocked on fetch strategy, not on product work |
| **Out of V1** | The other 8 seeded exams, all 20 boards | No source bound, no content, no evidence |

### How Tier C gets unblocked

Not by building product. Three specific, separable engineering tasks:

1. **`ssc.gov.in`, `iimcat.ac.in`** — server-rendered HTML is a shell. Needs
   either an alternate URL that renders server-side, or a headless fetch. This is
   the first thing that would justify new infrastructure, and only after the
   alternate-URL option is exhausted.
2. **`nta.ac.in` notice archive** — 2.2 MB, stored truncated, correctly refused.
   Needs `rawLocation` (object storage) rather than a bigger column.
3. **`jeemain.nta.nic.in`, `neet.nta.nic.in`, `upsc.gov.in`, `ibps.in`** —
   robots.txt unreadable behind an edge WAF. Needs a contact/allowlist
   conversation with the authority, or a different official URL. **Not** a
   crawler that ignores robots.

Until then, JEE Main and NEET pages stay honestly empty and `noindex`. That is
the correct outcome, and pretending otherwise is what produced 100 indexed pages
of fabricated dates once already.

---

## 3. The intent map

Columns per the brief. `Owner` is verified against the schema — see
[CANONICAL-FACT-OWNERSHIP.md](./CANONICAL-FACT-OWNERSHIP.md).

Priority: `P0` critical high-intent · `P1` important supporting · `P2` useful
long-tail · `P3` conditional, build only with content.
All priorities are **PROVISIONAL — repository/product evidence.**

| # | Entity | Intent | Tier | Pri | Target URL | Product decision | Canonical owner | Official source | Index? | Status | Blocking dependency | Acceptance test |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GATE | GATE exam date | A | P0 | `/exam/gate` | Section of hub (headline FactGrid) | `ExamEvent(EXAM_DATE)` | `gate2026.iitg.ac.in` ✓ | On completeness | **Fact pending review** (2026-02-07, HIGH) | Approval + exam completeness fields | `fact.service.test.ts` approval → `ExamEvent`; live `/exam/gate` renders the date with provenance |
| 2 | GATE | GATE application form | A | P0 | `/exam/gate` | Section of hub | `ExamEvent(APPLICATION_START/END)` | same ✓ | On completeness | **Facts pending** (LOW — page states 4 rival deadlines) | Reviewer resolves ambiguity | LOW-confidence approval requires a written reason (tested) |
| 3 | GATE | GATE result date | A | P1 | `/exam/gate/result` | Existing cluster page | `ExamEvent(RESULT)` | same ✓ | On completeness | **Fact pending** (2026-03-19, HIGH) | Approval | Section page renders date + `Provenance` |
| 4 | JEE Advanced | JEE Advanced exam date | A | P0 | `/exam/jee-advanced` | Section of hub | `ExamEvent(EXAM_DATE)` | `jeeadv.ac.in` ✓ | On completeness | **Fact pending** (2026-05-17, HIGH) | Approval | Mandated end-to-end fixture (`fact.service.test.ts`) |
| 5 | CUET UG | CUET UG exam date | A | P1 | `/exam/cuet-ug` | Section of hub | `ExamEvent(EXAM_DATE)` | `cuet.nta.nic.in` ~ | On completeness | **Fact pending** (2026-05-30, HIGH) | Approval; source is intermittent | As #1 |
| 6 | JEE Main | JEE Main exam date | C | P0 | `/exam/jee-main` | Section of hub | `ExamEvent(EXAM_DATE)` | ✗ never fetched | **noindex until sourced** | Honest empty state, live | Fetch strategy (§2.3) | Page states "not announced", badge reads *Not sourced*, no guessed date |
| 7 | JEE Main | JEE Main application form | C | P0 | `/exam/jee-main` | Section of hub | `ExamEvent(APPLICATION_*)` | ✗ | noindex | Honest empty state | Fetch strategy | As #6 |
| 8 | JEE Main | JEE Main result | C | P1 | `/exam/jee-main/result` | Existing cluster page | `ExamEvent(RESULT)` | ✗ | noindex | Honest empty state | Fetch strategy | As #6 |
| 9 | JEE Main | JEE Main previous-year papers | C | P1 | `/exam/jee-main/previous-year-papers` | Existing cluster page | `QuestionPaper` / `QuestionPaperFile` | — | noindex | Renders "No papers published yet" | **Paper importer (Phase 3).** 3000 seeded rows are junk and must never be published | Page shows the empty state, not 3000 fake papers |
| 10 | JEE Main | JEE Main syllabus | C | P1 | — | **NO PAGE.** Deliberately absent | `ContentEntry`/`PageSection` | — | n/a | Route 404s by design | Editorial content | `/exam/jee-main/syllabus` returns 404, and **nothing links to it** |
| 11 | JEE Main | JEE Main eligibility | C | P2 | — | **NO PAGE** | `PageSection(key=eligibility)` | — | n/a | Route 404s by design | Editorial content | As #10 |
| 12 | NEET UG | NEET syllabus | C | P1 | — | **NO PAGE** | `PageSection` | ✗ | n/a | 404 by design | Editorial content | As #10 |
| 13 | UPSC CSE | UPSC eligibility | C | P2 | — | **NO PAGE** | `PageSection` | ✗ | n/a | 404 by design | Editorial content | As #10 |
| 14 | SSC CGL | SSC CGL application form | C | P1 | `/exam/ssc-cgl` | Section of hub | `ExamEvent(APPLICATION_*)` | ✗ JS shell | noindex | Honest empty state | Fetch strategy (§2.1) | As #6 |
| 15 | CBSE Cl.10 Maths | CBSE Class 10 Maths syllabus | — | P3 | — | **NO PAGE.** Out of V1 | `BoardClassSubject` + `ContentEntry` | ✗ | n/a | Not built | Board product (Phase 5) + editorial | Do not mass-generate; 20 boards × 16 classes × subjects is the thin-page trap |

### Decision rules applied

1. **A route is not a page.** Four of the eight intended exam sub-pages
   (syllabus, exam-pattern, eligibility, application-form) have no content, so
   `EXAM_SECTIONS` does not list them, the route 404s, and — as of this phase —
   nothing links to them either.
2. **No page beats a thin page.** Rows 10–13 and 15 are explicit *no page*
   decisions, not omissions.
3. **Indexability is earned.** Every page inherits `isIndexable`, computed once
   in the API so the sitemap and the page cannot disagree.
4. **Missing data is stated, never inferred.** An unsourced date shows
   "not announced" and a *Not sourced* provenance badge. Absence of data is not
   an official `NOT_ANNOUNCED` announcement.

---

## 4. Defects found and fixed during this phase

Inspection of the existing product found three live defects of one class:
**pages linking into URL space that has no route.**

| Defect | Scale | Fix |
|---|---|---|
| Exam hub's "Everything about X" grid linked to syllabus, exam-pattern, eligibility, application-form — all 404 | 4 dead links × 20 exams = **80** | Grid now derives from `EXAM_SECTIONS`, the same registry the route and sitemap read |
| Exam hub's paper-year tiles linked to `/exam/[slug]/previous-year-papers/[year]` — no such route | up to 6 × 20 = **~120** | Tiles now link to `#year-<year>` anchors; the papers page groups by year and emits matching `id`s |
| Section pages rendered `Conducted by` followed by nothing when `conductingBody` is NULL — which is every exam today | 4 pages × 20 = **80** | Conditional, matching the hub's existing handling |

The sitemap had already been moved onto `EXAM_SECTIONS` for exactly this reason;
the pages had not, which is how the two came to disagree again. Verified live:
every internal link on `/exam/gate` now resolves 200.

---

## 5. Phase 1 stop condition — met

- [x] Selected exams mapped, cohorts bounded (Tier A/B/C, §2)
- [x] Every selected intent has a page, section, or explicit *no page* decision
- [x] Every selected page has a data contract and canonical owner
- [x] Official source strategy identified per intent, with measured fetchability
- [x] Index/noindex decided per intent
- [x] Acceptance test recorded per intent
- [x] Backlog derived (§6)
- [x] Provisional decisions labelled as provisional

## 6. Exact next phase

**Phase 3 — Previous-year paper product**, gated behind one prerequisite:

> **Phase 2B (operations, not engineering): review the 6 pending fact changes
> and complete the Tier A exams' identity fields** (`conductingBody`,
> `officialWebsite`, `overview`) so `isIndexable` can pass and three exam pages
> can become the first indexable pages on the site.

That is editorial work on real sourced values, not a code change. Until it
happens the universal exam product is complete but has nothing to display, and
no amount of further engineering changes that.

Do **not** start Phase 3 by publishing the 3000 seeded `QuestionPaper` rows.
They are fabricated, their media points at `cdn.example.test`, and the integrity
gate does not currently see them because it only inspects PUBLISHED rows — see
the open risk in `CURRENT-V1-IMPLEMENTATION-STATUS.md`.
