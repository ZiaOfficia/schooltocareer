# Infrastructure delta per module

One row per module, recorded when it lands. The point is not the totals — it's
the **outliers**. A module that suddenly needs a new cache strategy, a new
repository abstraction or a new event pipeline is either revealing a real gap in
the architecture or bypassing a pattern that already exists. Either answer is
worth stopping for.

| Module | Providers | Middleware | Worker handlers | Event actions | Shared type changes | Files | Tests |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Exam** (reference) | 4 | 8 | 4 | 7 | — | 11 | 13 |
| **Board** | 0 | 0 | 0 | 0 | 1 | 11 | 11 |
| **Category** | 0 | 0 | 0 | 0 | 0 | 9 | 11 |
| **QuestionPaper** | 0 | 0 | 0 | 0 | **2** | 11 | 13 |
| **Result** | 0 | 0 | 0 | 0 | **0** | 10 | 19 |
| **Blog** | 0 | 0 | 0 | 0 | **0** | 11 | 14 |

| **Media** | 0 | 0 | 0 | 0 | **0** | 9 | 18 |
| **Search** | 0 | 0 | 0 | 0 | **0** | 7 | 12 |

Search's shared-type delta is zero, but it required **two additions to
`ISearchDocumentSource`** — see below. That was the expected signal, and it
resolved in the right direction.

Blog's delta is zero on shared *types*, but it did add one piece of shared
**runtime** infrastructure — `PeriodicTaskRunner`. Media is its second consumer.

**Media required one SCHEMA change:** `MEDIA_ASSET` added to the `OwnerType`
enum. It was in the 89-model design and got cut in the launch reduction; media
events (cache purge + audit) cannot be emitted without it. Purely additive, no
data migration — but the migration note matters: **PostgreSQL cannot USE a new
enum value in the transaction that ADDs it**, and Prisma wraps migrations in a
transaction. The value must ship in its own migration, ahead of anything that
writes it.

## Shared abstraction adoption

The complement to the delta table: an abstraction that never gets a second
consumer was not shared infrastructure, it was a one-off with ambitions.

| Abstraction | Consumers | Status |
|---|---:|---|
| `EventDispatcher` + `defineEvents` | 5 | Proven |
| `ICacheProvider` | 5 | Proven |
| `ISearchProvider` + source registry | 4 | Proven |
| `SlugService` | 5 | Proven |
| `BaseRepository` | 7 | Proven |
| Offset + cursor paginators | 4 | Proven |
| **`facet-builder` + `FacetGroup`** | **2** | **Validated by Result** |
| `RevisionRepository` | 5 (via AuditHandler) | Proven |

Exam's counts are the foundation itself, not a per-module cost — every number
after it is measured against that baseline.

---

## Board

**Delta: 1 shared type change.** `DomainEvent` gained `cascadeTags` and
`cascadePaths`.

Renaming a board changes the URL of every class, subject and chapter beneath it,
and only the emitting service knows which descendants exist. The alternative —
each hierarchical module hand-rolling its own cache purge — would have put side
effects back inside services, which is the thing the event system exists to
prevent.

Judged a genuine gap rather than a bypass: any hierarchical module needs it, and
Category used it immediately without further change.

**Also required, all inside the module:** an explicit soft-delete cascade,
because PostgreSQL's `ON DELETE CASCADE` never fires on an `UPDATE`.

## Category

**Delta: zero.** Recursive taxonomy needed nothing new.

Everything lived inside the module:

- Ancestor/descendant/tree traversal — three recursive CTEs in the repository.
  Prisma has no recursive query API, so raw SQL, parameterised, with a depth
  guard on each. An unguarded recursive CTE over a self-referencing table hangs
  the connection permanently if a cycle is ever written.
- The cycle guard on reparenting — a business rule in the service, which is
  where it belongs. The database cannot express it.
- Tree assembly from flat rows — a single-pass index map in the DTO layer.

### Two deliberate deviations from the module template

**No `publish` / `unpublish`.** The launch schema gives `Category` no
`PublishStatus`, because a category is taxonomy, not content — "draft category"
isn't a state an editor means. Every other convention applies unchanged.

**No `category.search-source.ts`.** Category pages are listings. Indexing them
alongside articles means a site search for "JEE" returns the *Exam Prep
category* competing with the articles inside it. They remain crawlable and in
the sitemap; they're just not in site search. Reversible in ~45 lines if that
call turns out to be wrong.

### Behaviour worth noting

`softDelete` **promotes children one level** rather than cascading, and refuses
outright if the category still holds articles. Cascading a taxonomy delete would
silently unpublish real content; silently reassigning it would hide a decision
the editor has to make.

`changeSlug` filters `ENTITY_PATH_TEMPLATES.CATEGORY` by type — that constant
holds both `/blog/:slug` and `/news/:slug`, and emitting the wrong one would
create a live 301 pointing into a 404.

## QuestionPaper

**Delta: 2 shared additions.** Both were predicted, and both are justified by
consumers beyond this module.

### 1. `packages/types/src/facets.ts` — `FacetBucket` / `FacetGroup` / `FacetedResult`

**Justified by four consumers:** QuestionPaper (year, exam, subject, shift),
Result (year, board, result type), Search (entity kind, level), and College when
Phase 2 lands (state, fees, ranking). Not a one-off.

### 2. `apps/api/src/core/query/facet-builder.ts`

Deliberately **pure** — it knows nothing about Prisma or any model. It takes raw
`{ value, count }` aggregations and produces labelled, sorted, selection-aware
groups. The `GROUP BY` stays in each repository, where model-specific typing
belongs. That split is what makes it reusable rather than paper-shaped.

Two rules it encodes, both learned the expensive way in faceted UIs:

- **A selected bucket with a zero count still renders.** Otherwise the checkbox
  the user just ticked disappears and they cannot untick it.
- **`whereForFacet` implements disjunctive faceting.** Each field is counted
  against the filters MINUS its own, so `year=2024` leaves every year visible
  and switchable instead of collapsing the list to one inescapable option.

### Minor: `contentHash` widened to accept `boolean`

A one-word parameter change in `@stc/utils`, surfaced by typechecking rather
than found by hand. Recorded for completeness, not because it is architectural.

### What volume actually forced (all inside the module)

- Narrow list projection — the detail select is ~3× the columns of the list one.
- Facet aggregations batched into **one** transaction: six sequential `GROUP BY`
  round trips to Neon is six times the latency for identical work.
- The unfiltered facet panel — the landing-page case, and by far the most
  common — is cached under the entity's list tag, so it is computed once per
  publish rather than once per visitor.
- `withFacets` is opt-in. A related-papers strip needs the rows, not the panel.
- `dedupeKey` is tombstoned on delete alongside `slug`. Both are unique, and
  tombstoning only the slug would make the paper permanently un-reimportable.
- Download counts are incremented in **batches from a worker**, never on the
  request path — a synchronous `SET download_count = download_count + 1` on a
  popular paper is row-lock contention on result-declaration day.

---

## Result

**Delta: zero.** The facet abstraction held.

Result consumed `FacetBucket`, `FacetGroup`, `FacetedResult` and
`facet-builder` unchanged. The only per-module code is the field list and a
spec map; disjunctive counting, zero-count retention, selection pinning and
unfiltered-panel caching all came from the shared builder. Its tests
deliberately assert the *same* behaviours as QuestionPaper's — if these had
needed different helpers, the abstraction was wrong.

Result also exercised the `boolean` FacetKind (`isDeclared` → Declared /
Awaited), the first of its kind in the system, again with no builder change.

### What Result stressed: two independent lifecycles

Most implementations collapse these into one field, and it costs them months of
ranking:

- `status` — is the PAGE live? Published in February so it ranks.
- `isDeclared` — has the RESULT been announced? Lands in April.

"JEE Main Result 2026: Date & Direct Link" must be publishable and indexable
long before the result exists. Declaration is its own guarded transition:

- refuses on a draft page (a draft cannot receive the traffic)
- requires at least one working link
- **idempotent** — two operators WILL press the button in the same minute
- rejects a future timestamp
- retraction requires a written reason, recorded in the revision snapshot
- unpublish and delete are blocked while declared; retract first

`phase` (`AWAITED` / `EXPECTED` / `DECLARED`) is **derived**, never stored — one
less field that can disagree with reality. `isDeclared` without `declaredAt`
reads as AWAITED, so a partial write cannot make a page claim a declaration it
cannot evidence.

### Time-dependent caching, with no new infrastructure

A result page 6 months out never changes; the same page on declaration day
changes every few minutes and is being refreshed by tens of thousands of
students. One fixed TTL cannot serve both — too long and declaration day serves
a stale "not yet declared"; too short and 20,000 dormant pages hammer the
database all year.

`cacheTtlFor()` returns `VOLATILE` inside the 48h window either side of the
expected or actual declaration, and `LONG_TAIL` once settled. **Overdue results
stay volatile** — students refresh hardest when a board is late. The CDN
`s-maxage` mirrors it, so the edge cannot pin a declaration-day page stale.

Same cache provider. Different number.

---

## Blog

**Shared types delta: 0. Shared runtime delta: 1 — `PeriodicTaskRunner`.**

### The one addition, and why it is not a Blog utility

The outbox worker reacts to **events**. Some work is **time-driven**, and
nothing emits an event when a clock passes a threshold. Five consumers already
need this:

| Task | Module | Why it cannot be an event |
|---|---|---|
| `publish-scheduled` | Blog | Nothing fires when a scheduled time arrives |
| `flush-view-counts` | all | Batched counters must drain on a cadence |
| `refresh-popularity` | all | Recomputed nightly from daily stats |
| `prune-stale-drafts` | Blog | Abandoned drafts age out silently |
| `collapse-redirects` | Slug | `a→b→c` chains form over months |

Deliberately the smallest thing that works: an interval and a function. No cron
expressions, no distributed locking, no persistence. It documents its
single-instance assumption rather than pretending to solve it — the moment the
worker scales to two processes, tasks need an advisory lock, and **that** is
when to add one.

### Scheduling needed NO schema change

`status = DRAFT` with a future `publishedAt` **is** the scheduled state. The
`@@index([status, publishedAt])` added in Phase 2 — commented at the time as
"scheduled-publish worker" — turns the scan into a range read over a handful of
rows. No `SCHEDULED` enum member, no `scheduledAt` column, and the frozen schema
held.

The subtle part: a scheduled post must **not** emit `published`. Doing so would
index and ping a page nobody can read yet. It emits `updated` with
`scheduledFor` in the snapshot, and the periodic task emits `published` when the
time actually arrives. Tested.

### What Blog stressed

- **Autosave is not a revision.** `ContentDraft` (one row per content+editor,
  overwritten in place) versus `ContentRevision` (append-only history). Tested
  explicitly: an autosave writes a draft and *zero* revisions.
- **A conflict is reported, never thrown.** A stale `baseVersion` returns
  `{ conflict: true }` alongside a successful save. Rejecting the write would
  cost the writer their words — the one outcome an editor never forgives.
- **Row-level authorship.** An AUTHOR may edit only their own posts; an EDITOR
  may edit anyone's. This lives in the service via `canActOnRow` because only
  the service has the row — doing it in middleware means fetching the post twice.
- **Rollback writes a NEW revision** from the old snapshot rather than rewinding
  history, and restores **only content fields**. A test asserts that `id`,
  `authorId`, `status` and `version` in a snapshot cannot be replayed — otherwise
  a rollback becomes a privilege-escalation primitive.
- **Publishing is gated by the indexability score**, not a word count, and the
  refusal returns the score and the missing fields so an editor can act on it.

Blog is also the **third consumer** of `facet-builder` (type, category, author).

---

## Media

**Shared code delta: 0. Schema delta: 1 enum value.**

`IStorageProvider` needed **no redesign**. All five methods were exercised —
`signedUploadUrl`, `probe`, `delete`, `buildUrl`, and `upload` (available for
server-side ingestion). That takes all four provider interfaces to at least one
production consumer.

### The finding worth recording

**A presigned upload cannot enforce a size limit at the provider.** The
signature covers the path and a timestamp, not the byte count. So the declared
size at sign time is *advisory*, and the real check has to happen at confirm,
against what actually landed:

```
sign     -> server issues a signature and a SERVER-CHOSEN publicId
upload   -> browser PUTs bytes directly (they never touch the API)
confirm  -> server PROBES the provider, verifies size + mime, THEN writes a row
```

The confirm step is a security boundary, not bookkeeping. Without it a client
can register any publicId it likes — including one belonging to another asset —
and the database believes it. An oversized or disallowed object is **deleted**
and refused; registering it would make the limit decorative, ignoring it would
leak storage.

The interface supported all of this unchanged. `probe()` existing at all is what
made the verification step possible.

### Ordering rules that only appear when a provider is involved

- **Database first, provider second, always.** The reverse leaves a row pointing
  at bytes that no longer exist — a broken image on a live page. This way the
  worst case is an orphaned object costing pennies until the next sweep.
- **Provider deletes never throw upward.** Storage is the least reliable
  dependency and the one whose failure matters least: a leftover object costs
  storage, a thrown error costs the user their operation. Failures are logged
  and retried by `reconcile-media`.
- **`replace` preserves the row id**, so every foreign key stays valid. That is
  the entire difference between "replace" and "upload a new one and repoint 40
  rows". The provider's `version` token is what makes the CDN serve new bytes.
- **`checksum` is tombstoned on soft delete**, because it carries a partial
  unique index over live rows. Without it, deleting an asset permanently blocks
  re-uploading that file.
- **Deletion is refused while referenced**, with the counts per relation. The
  reference count is computed live rather than trusting `usageCount` — a
  denormalised counter that drifts turns the guard into a coin flip.

### Deviations from the module template

No `slug` (publicId is the identifier, so no slug history), no publish
lifecycle, no search source, no public routes — assets are served by the storage
CDN and the API never proxies bytes. Nine files.

---

## Search — Phase 5 complete

**`SearchService` contains zero entity-specific branching.** No `switch`, no
`=== 'EXAM'`, no hardcoded label list. Every entity fact comes from the registry.

Getting there required two additions to `ISearchDocumentSource`, and the reason
they were needed is exactly the diagnostic you described — *the source interface
was not expressive enough*:

| Added | The question it answers | What branching would have cost |
|---|---|---|
| `entityLabel` (static) | "What kinds are searchable?" — needed for the facet panel and the `?type=` allowlist, **before** any document is built | A hardcoded label list in SearchService, drifting from the sources |
| `listIndexableIds()` | "Give me every id of this kind" — needed for a full reindex | A `switch` over modules inside the reindex endpoint |
| `searchable?: boolean` | "Is this kind in SITE search?" — Category is crawlable but excluded | A special case for Category in SearchService |

Extending the interface pushed the knowledge **into** the sources, where it
belongs. Branching would have inverted the dependency the registry exists to
protect. The final test in `search.test.ts` proves it: registering a brand-new
`Scholarship` source makes it searchable, filterable and reindexable with no
change to `SearchService`.

### Reindex reuses the incremental path

`reindex` enqueues one `SEARCH_UPSERT` per row and lets the existing outbox
worker do the work. No bespoke bulk pipeline — which matters because a second
code path is a second thing that can disagree with the first. A reindexed
document is byte-identical to one produced by an edit.

Bounded at `REINDEX_MAX_PAGES` so a mistaken call cannot enqueue a million rows
and starve every other event behind them. Enumeration is keyset-paged on the
primary key: a reindex walks the whole table, which is precisely where
`OFFSET 40000` hurts.

### Search-specific SEO and load decisions

- Results and suggestions are `X-Robots-Tag: noindex` — a search results page is
  the classic source of thin, near-duplicate URLs.
- Suggest gets a 600/min limit (it fires per keystroke) against search's 120/min,
  and is cached: the same prefixes are typed thousands of times a day.
- The kind facet is computed from the current page of hits, not a second
  aggregation. Accurate per-kind counts mean one full-text scan per kind, and on
  a search box the counts are a navigation hint, not a report. This is
  `facet-builder`'s **fourth** consumer.
- Zero-result queries are logged and surfaced as a content-gap report. It is the
  highest-signal editorial backlog on the site: demand, in the user's own words,
  that the site failed to meet.

---

# Phase 5 complete

Seven modules, seven distinct problem domains, one architecture.

| Shared abstraction | Consumers |
|---|---:|
| `BaseRepository` | 12 |
| `EventDispatcher` + `defineEvents` | 7 |
| `ICacheProvider` | 8 |
| `SlugService` | 6 |
| `ISearchProvider` + source registry | 5 |
| `facet-builder` + `FacetGroup` | 4 |
| `RevisionRepository` (via AuditHandler) | 7 |
| `PeriodicTaskRunner` | 2 |
| `IStorageProvider` | 1 |

Every abstraction has at least one consumer, and every one introduced after the
Exam baseline has at least two — except `IStorageProvider`, which has exactly
one by nature: there is only one media module.
