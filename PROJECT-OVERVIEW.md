# SchoolToCareer — Project Overview

**Generated:** 2026-09-18 · **Branch surveyed:** `fix/remove-dead-links` (plus `main` and `feat/semantic-fact-engine`, which carry unpushed work)

A single walkthrough of the whole repository: what it is, how it is built, what
actually runs today, and what is genuinely missing. Everything below was read
out of the tree — where a claim comes from a status document rather than code,
it says so.

---

## 1. What this is

An India education portal covering exams, school boards, previous-year question
papers and results. A pnpm + Turborepo monorepo: a Next.js public site, an
Express REST API, a background worker, and seven shared packages.

The product thesis is in [`PRINCIPLES.md`](PRINCIPLES.md) and it drives real
engineering decisions, not just tone:

| Principle | Where it shows up in code |
| --- | --- |
| Trust beats traffic | `pnpm gate:integrity`, the fabricated-data purge, `isTentative` provenance |
| Index quality beats URL count | `evaluateIndexability()`, `NOINDEX_PATHS`, `isIndexableDeployment()` |
| Systems, not pages | `ROUTES` as the single URL map; `ENTITY_PATH_TEMPLATES` driving redirects |
| Freshness is a feature | `Source`/`SourceSnapshot` monitoring, outbox-driven revalidation |

---

## 2. Repository layout

```
schooltocareer/
├── apps/
│   ├── api/          @stc/api   — Express 5 REST API + outbox worker
│   └── web/          @stc/web   — Next.js 15 / React 19 public site
├── packages/
│   ├── config/       @stc/config      — validated env contracts, site config
│   ├── constants/    @stc/constants   — routes, roles, permissions, SEO, seeds
│   ├── database/     @stc/database    — Prisma schema, client singleton, seeds
│   ├── types/        @stc/types       — framework-agnostic domain types
│   ├── ui/           @stc/ui          — shared design system (React)
│   ├── utils/        @stc/utils       — pure helpers (slug, hash, indexability)
│   └── validation/   @stc/validation  — Zod schemas + inferred DTOs
├── tooling/
│   ├── eslint-config/  layer rules enforced by the linter
│   └── scripts/        operational + architectural verification scripts
├── docs/               architecture notes, status reports, execution prompts
├── render.yaml         Render blueprint (API + worker, Singapore)
└── turbo.json          task graph
```

Workspace globs: `apps/*`, `packages/*`, `tooling/*`. Node ≥ 20.11, pnpm 9.15.4.

---

## 3. Architecture

### 3.1 Runtime topology

```
        Neon PostgreSQL 18.4 (ap-southeast-1 / Singapore)
                    │
        ┌───────────┴────────────┐
        │                        │
   @stc/api (Render web)    stc-worker (Render worker)
   Express 5, :10000        outbox drain + periodic tasks
        │                        │
        │  HTTP (API_BASE_URL)   │ POST /api/revalidate
        ▼                        ▼
   @stc/web (Vercel) ──────────── Next.js 15 App Router, RSC only
```

The worker is a **separate Render service**, not a flag on the API
(`apps/api/src/workers/worker.ts:1`). A worker crash-loop must not take the API
down, and the two scale on different signals — API on request volume, worker on
outbox depth. Locally, `RUN_WORKER_IN_PROCESS` runs it inside the API so there
is only one thing to start.

### 3.2 Layering, enforced by the linter

`tooling/eslint-config/layers.js` turns architectural rules into build failures
rather than review comments:

1. **Prisma never leaves the repository layer.** Controller → Service →
   Repository → Prisma. Only `*.repository.ts`, `core/base/**`, seeds and tests
   may import `@stc/database` or `@prisma/client`.
2. **The Next.js app never touches the database.** It talks HTTP to the API, so
   business rules have one home.
3. Import-boundary rules across the remaining packages.

`pnpm arch:check` (`tooling/scripts/arch-check.ts`) adds structural regression
metrics on top — deliberately dependency-free regex/fs so it runs in under a
second and never gets skipped.

### 3.3 Request pipeline (`apps/api/src/app.ts`)

Order is load-bearing and commented as such:

1. `requestContext()` first — AsyncLocalStorage request id; anything above it
   loses correlation.
2. `helmet` (CSP off — this process serves JSON; the page CSP is Next's job).
3. `cors` with an explicit allowlist (`origin: true` would defeat the point).
4. `compression`, then `express.json({ limit: '1mb' })` — uploads never pass
   through here; they go direct-to-Cloudinary via a presigned URL, because a
   40 MB PDF through a Render dyno reliably exhausts memory.
5. `requestLogger`.
6. `/health` **before** rate limiting, so platform probes are never throttled
   and a traffic spike cannot turn into a false unhealthy signal.
7. Feature routers, each owning its own auth and permission gates — there is no
   global "everything under /admin is protected" rule, because one misplaced
   mount would silently expose a whole module.
8. `notFoundHandler` then `errorHandler`, always last and in that order.

`app.ts` builds the app; `server.ts` starts it, so integration tests can drive
it without binding a port.

---

## 4. The API (`apps/api`)

**132 source files.** 8 public feature modules plus shared infrastructure.

### 4.1 Modules

| Module | Files | Route handlers | Notes |
| --- | --- | ---: | --- |
| `exam` | controller, service, repository, routes, dto, events, validation, search-source, types | 14 | Core entity: exams, years, events |
| `board` | full set | 14 | Boards, classes, subjects, chapters |
| `question-paper` | full set | 14 | Papers + versioned files |
| `result` | full set | 14 | Result declarations |
| `blog` | full set | 16 | Editorial content |
| `category` | full set | 9 | Exam/content categories |
| `media` | full set | 8 | Cloudinary sign/upload/reconcile |
| `search` | controller, service, routes, dto, validation | 5 | Postgres full-text + facets |
| `health` | routes, service, repository | 2 | `/health` liveness, `/health/ready` readiness |
| `draft`, `revision`, `slug`, `source` | repositories/services only | — | Support modules, no public routes |

Roughly **96 route handlers** across the feature routers.

### 4.2 Shared core (`apps/api/src/core`)

- `base/base.repository.ts` — the only sanctioned Prisma surface.
- `events/` — `define-events.ts`, `domain-event.ts`, `event-dispatcher.ts`, and
  three handlers: `audit`, `cache-invalidation`, `search-index`.
- `pagination/paginator.ts` — keyset (cursor) pagination.
- `query/facet-builder.ts` + `query/filter-builder.ts` — disjunctive faceting.
- `search/search-source.ts` — the contract each module's `*.search-source.ts`
  implements, so one search endpoint can index every entity.
- `http/response.ts`, `logger.ts` (pino), `context.ts`, `errors/`.

### 4.3 Providers (swappable behind interfaces)

| Slot | Interface | Implementations |
| --- | --- | --- |
| Cache | `cache.provider.ts` | `memory.cache-provider.ts` (Redis deferred; `REDIS_URL` already in the env schema) |
| Queue | `queue.provider.ts` | `outbox.queue-provider.ts` — transactional outbox in Postgres |
| Search | `search.provider.ts` | `postgres.search-provider.ts` (Meilisearch deferred) |
| Storage | `storage.provider.ts` | `cloudinary.storage-provider.ts`, `unavailable.storage-provider.ts` |

`unavailable.storage-provider.ts` is the interesting one: without Cloudinary
credentials the API still boots, logs a warning, and serves every read path.
Only upload/delete/sign/reconcile fail, with a message naming the missing
variables. Absent is a supported state, not a broken one.

### 4.4 Worker (`apps/api/src/workers`)

- `outbox.worker.ts` — drains `OutboxEvent` using `FOR UPDATE SKIP LOCKED`,
  with stale-row reclamation and a clean drain on SIGTERM (abandoning a batch is
  survivable but replays external effects on restart).
- Handlers: `revalidate.handler.ts` (POSTs `/api/revalidate` on the web app),
  `indexnow.handler.ts` (optional, disabled cleanly when `INDEXNOW_KEY` is
  absent), `search.handlers.ts`, `outbox-handler.ts`.
- `periodic-task.ts` framework plus three tasks: `fetch-sources.task.ts`,
  `publish-scheduled.task.ts`, `reconcile-media.task.ts`.

### 4.5 Tests

10 Vitest files colocated with their modules (`blog`, `board`, `category`,
`exam.service`, `media`, `question-paper`, `result`, `search`,
`outbox.worker`, `fetch-sources`). Status docs report 240/240 passing on the
fact-engine branch.

---

## 5. The web app (`apps/web`)

Next.js 15 App Router, React 19, Tailwind 4, **zero client components**.
21 source files.

### 5.1 Routes that exist today

| Route | File | State |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Built |
| `/exams` | `src/app/exams/page.tsx` | Built |
| `/exam/[slug]` | `src/app/exam/[slug]/page.tsx` | Built, `noindex` until the exam is verified |
| `/exam/[slug]/[section]` | `src/app/exam/[slug]/[section]/page.tsx` | Built for 4 sections |
| `/boards` | `src/app/boards/page.tsx` | Index only |
| `/previous-year-papers` | `src/app/previous-year-papers/page.tsx` | Index only |
| `/results` | `src/app/results/page.tsx` | Index only |
| `/blog` | `src/app/blog/page.tsx` | Index only |
| `/robots.txt` | `src/app/robots.ts` | Built |
| `/sitemap.xml` | `src/app/sitemap.ts` | 6 URLs |
| `/api/revalidate` | `src/app/api/revalidate/route.ts` | Built — the endpoint the worker had been calling since the cache layer existed |

`src/lib/exam-sections.ts` is the exam-cluster registry. It currently defines
**four** sections — `previous-year-papers`, `result`, `admit-card`,
`answer-key`. `ROUTES` declares four more (`syllabus`, `exam-pattern`,
`eligibility`, `application-form`); those are deliberately unlinked because the
pages do not render yet.

### 5.2 Supporting code

- `src/lib/api.ts` — typed fetch client against `API_BASE_URL`. This is the only
  path to data; the web app never imports Prisma (lint rule 2).
- `src/lib/seo/metadata.ts` — `buildMetadata()`, canonical URLs, the `noindex`
  flag, and `isIndexableDeployment()`.
- `src/lib/seo/json-ld.tsx` — structured data (breadcrumbs, page schema).
- `src/components/` — `site-header`, `site-footer`, `index-page` (the shared
  listing template), `adsense` (production-gated).

### 5.3 Indexability policy

Three independent gates, all of which must pass before a URL is indexable:

1. **`isIndexableDeployment()`** — requires `NEXT_PUBLIC_SITE_URL` to equal
   `SITE.ORIGIN` exactly. Every preview deployment and every local run is
   therefore `noindex`, and `robots.txt` is `Disallow: /`. This is by design — a
   self-canonicalising preview can get indexed and compete with production for
   its own keywords.
2. **Per-entity `isIndexable`** — an exam hub stays `noindex, follow` until the
   exam's facts are verified.
3. **`evaluateIndexability()`** (`packages/utils/src/indexability.ts`) —
   multi-signal scoring over word count, structured data, field completeness and
   uniqueness, returning the *reasons* so an admin can show an editor exactly
   what to fix rather than a bare refusal.

---

## 6. Data model (`packages/database`)

Prisma 6, PostgreSQL. **32 models, 25 enums**, split across eight schema files.

| File | Models |
| --- | --- |
| `schema.prisma` | generator, datasource, and all shared enums |
| `auth.prisma` | `User`, `Session` |
| `education.prisma` | `State`, `Board`, `ClassLevel`, `BoardClass`, `Subject`, `BoardClassSubject`, `Chapter` |
| `exam.prisma` | `ExamCategory`, `Exam`, `ExamYear`, `ExamEvent`, `QuestionPaper`, `QuestionPaperFile`, `Result` |
| `content.prisma` | `ContentEntry`, `Category`, `PageSection`, `FaqItem`, `ContentDraft`, `ContentRevision` |
| `ingestion.prisma` | `Source`, `SourceSnapshot` + `SourceKind`, `SourceStatus`, `FetchOutcome` |
| `media.prisma` | `MediaAsset` |
| `platform.prisma` | `Site`, `OutboxEvent` |
| `seo.prisma` | `SeoMeta`, `SlugHistory`, `Redirect`, `SearchDocument`, `SearchQueryLog` |

### 6.1 Postgres features actually in use

- Transactional outbox with `FOR UPDATE SKIP LOCKED`.
- Three recursive CTEs (category/chapter trees, with a cycle guard).
- Generated `tsvector` column with a Devanagari branch, plus `pg_trgm`.
- `NULLS NOT DISTINCT` unique constraints.
- Ten partial indexes, applied concurrently.

### 6.2 Migration discipline

- Migrations live in `prisma/schema/migrations/` — five so far, from `init`
  through `conducting_body_nullable`.
- `tooling/scripts/guard-migrate-dev.mjs` wraps `migrate dev` so it cannot be
  aimed at a non-local database.
- **`pnpm db:constraints` is not optional after a migration.** `prisma migrate`
  recreates `SearchDocument.searchVector` as a plain column; only
  `prisma/migrations/manual/001_raw_constraints.sql`, applied by
  `tooling/scripts/apply-concurrent-indexes.ts`, converts it back to
  `GENERATED`. Skip it and full-text search silently returns nothing.
- Migrations always run on `DIRECT_DATABASE_URL` — transaction pooling breaks
  advisory locks and DDL.

### 6.3 The deferred 89-model design

The full v1 schema is preserved at `docs/architecture/schema-full-v1/`,
including `career.prisma`. Phase 2 (colleges, courses, careers, scholarships,
jobs, cutoffs, RBAC tables) is additive — `OwnerType` already carries the enum
values and `siteId` is already threaded through every constraint.

### 6.4 The gap that matters

**There is no question-level model.** The finest granularity is `QuestionPaper`
(a whole paper) and `QuestionPaperFile` (the PDF). So the graph is:

```
Board → Class → Subject → Chapter
Exam  → Year  → Paper (year, shift, session, subject, paperType, locale)
```

Paper-level facets work ("all Physics papers, JEE Main 2017–2026"). Anything
question-level does not — chapter weightage, "most repeated chapters", an
insight engine, a real recommendation engine. Adding it is a `Question` model
plus `QuestionTopic`; the expensive part is tagging 20,000 papers' worth of
questions, which is an editorial and possibly ML programme, not a sprint. Worth
deciding early, because it changes what Tier 0 pages can promise.

---

## 7. Shared packages

### `@stc/constants` — the single source of truth

Zero runtime dependencies. `routes.ts` is the URL map: **every path in the
product is built here, never by string concatenation at a call site.** That is
what lets a slug rename generate correct redirects for all of an entity's
sub-pages automatically, via `ENTITY_PATH_TEMPLATES`. Also carries `boards`,
`classes`, `subjects`, `exam-categories`, `permissions`, `roles`, `cache-tags`,
`pagination`, `seo`, `metadata`, and `sources.ts` (20 official source seeds).

It exposes a `./sources` subpath because `tooling/scripts` is ESM while this
package is CommonJS — a barrel's `export *` chain loses named exports across
that boundary (`cjs-module-lexer` cannot resolve `__exportStar`). `@stc/utils`
exposes `./indexability` for the same reason.

### `@stc/config`

`env.ts` — two Zod schemas, one for the API and one for the web app, validated
at boot. The API refuses to start on a bad env rather than failing later. Note
that `RUN_WORKER_IN_PROCESS` uses a custom `envBoolean`, because
`z.coerce.boolean()` treats the string `"false"` as `true`.

`site.ts` — `buildSiteConfig()` deliberately separates `url` (where the app is
*served*: localhost in dev, `*.vercel.app` on a preview) from `canonicalOrigin`
(what absolute URLs are *built from*).

### `@stc/types`

Domain enums, pagination, facets, API envelopes, and DTOs. Only `ExamDto` is
hoisted so far; seven modules still declare DTOs inside the API.

### `@stc/validation`

Zod schemas per entity. One definition validates the API request and the admin
form.

### `@stc/ui`

The shared design system, consumed by web (and eventually admin) so both stay
one product: `EntityBadge`, `StatusStamp`, `Provenance`/`LastUpdated`, and the
layout primitives `Wrap`, `Section`, `Eyebrow`, `ScrollX`, `FactGrid`. The
entity-vs-status split is the design invariant — an entity badge says *what a
thing is*, a status stamp says *what state it is in*, and they never merge.

### `@stc/utils`

Pure helpers only, no business logic: `slug`, `text`, `format`, `collection`,
`cursor`, `hash` (SHA-256 for snapshot and PDF dedup), `indexability`.

---

## 8. Ingestion — source monitoring (Phase 0, implemented)

`Source` + `SourceSnapshot` with:

- robots.txt handling and classification;
- conditional requests via ETag / Last-Modified;
- content normalization and SHA-256 hashing;
- historical snapshots, so a change is a diff against a stored prior state;
- per-URL cadence (`SOURCE_SEEDS`), one row per URL rather than per authority —
  NTA publishes JEE and NEET on pages that change on completely different
  clocks, and a single "NTA" entry would average them into a cadence fitting
  neither.

**Measured limitation:** CBSE, CISCE and UPSC sit behind edge WAFs that refuse
any non-browser client — no robots directive involved, and the User-Agent makes
no difference. The NTA family (`nta.ac.in`, carrying JEE, NEET, CUET and UGC
NET) fetches cleanly. See `docs/architecture/source-acquisition.md`. Any plan
that assumes every official page is crawlable is wrong.

Two earlier bugs are fixed and worth remembering: the fetcher used to report
"robots.txt disallows us" when it had merely failed to *ask*, and the UPSC apex
307s while dropping the path, so both UPSC seeds silently resolved to the home
page instead of the notice list.

---

## 9. Tooling and gates (`tooling/scripts`)

| Script | Command | What it does |
| --- | --- | --- |
| `arch-check.ts` | `pnpm arch:check` | Architectural regression metrics; fails CI |
| `integrity-gate.ts` | `pnpm gate:integrity [--live]` | Seven counts that must all be zero |
| `verify-e2e.ts` | `pnpm verify:e2e` | End-to-end checks incl. scheduled publishing |
| `capture-plans.ts` | `pnpm db:plans` | Records query plans so a regression is visible |
| `apply-concurrent-indexes.ts` | `pnpm db:constraints` | Re-applies raw SQL after every migration |
| `seed-sources.ts` | `pnpm sources:seed` | Loads `SOURCE_SEEDS` |
| `fetch-sources-now.ts` | `pnpm sources:fetch` | Runs a fetch pass on demand |
| `sources-report.ts` | `pnpm sources:report` | Source health report |
| `purge-placeholder-content.ts` | `pnpm data:purge-placeholder` | Removes fabricated rows |
| `guard-migrate-dev.mjs` | (wraps `db:migrate`) | Refuses `migrate dev` against a remote DB |
| `gen-secrets.mjs` | — | Generates JWT secrets and salts |

### The integrity gate, and why it exists

The volume seed — whose fabricated rows are correct and necessary in a throwaway
database — was once run against **production**. It published 100 indexable exam
pages stating a fabricated exam date, the wrong conducting body for 15 of 20
exams, and a reserved-TLD (`example.test`) domain as the official link. Nothing
errored. Every page returned 200.

> That is the failure mode this guards: not a crash, but a confident page.

The data was purged, the seed now refuses to run against a non-local database,
and `pnpm gate:integrity` turns the seven invariants into a release gate.
`--live` additionally fetches the deployed sitemap, because a clean database
does not prove the CDN stopped serving the old one. A request the gate cannot
complete is reported UNKNOWN, never as a pass. See
`docs/architecture/data-integrity.md`.

### CI (`.github/workflows/ci.yml`)

On push to `main` and every PR: `arch:check` → `typecheck` → `lint` → `test` →
`build` → `prisma validate`. Structure before behaviour, because a layer
violation makes the test results much less interesting. A second
`migration-guard` job runs on PRs to catch a schema edit committed without its
migration.

---

## 10. Environment contract

**API** (`packages/config/src/env.ts`): `NODE_ENV`, `PORT`, `DATABASE_URL`,
`DIRECT_DATABASE_URL`, `SITE_ID`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
(must be distinct), `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `IP_HASH_SALT`,
`REVALIDATE_SECRET`, `WEB_BASE_URL`, `CORS_ORIGINS`, `RATE_LIMIT_WINDOW_MS`,
`RATE_LIMIT_MAX`, `LOG_LEVEL`, `RUN_WORKER_IN_PROCESS`; optional
`CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`, `INDEXNOW_KEY`,
`REDIS_URL`.

**Web**: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, `API_BASE_URL`,
`REVALIDATE_SECRET`; optional `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ADSENSE_CLIENT`.

`REVALIDATE_SECRET` must match on both sides. Rotating `IP_HASH_SALT` resets
rate-limit buckets.

---

## 11. Deployment

| Piece | Host | Notes |
| --- | --- | --- |
| Web | Vercel, root dir `apps/web` | Live |
| API | Render `stc-api`, Singapore, starter | `/health` check, 1.5 s per-dependency timeout |
| Worker | Render `stc-worker`, Singapore, starter | Separate service, same image |
| Database | Neon PostgreSQL 18.4, `ap-southeast-1` | Moved from `us-east-2` |

### Two measured performance decisions

**Region.** us-east-2 → ap-southeast-1, measured from India: round trip
276 ms → **93 ms**; full 3,000-paper seed 653 s → **214 s**; seven facet
aggregations 4,171 ms → 1,541 ms. No query plan changed, which is what the move
was meant to prove.

**`pgbouncer=true` removed.** At 24-way concurrency over 192 parameterised
queries: 192/192 succeeded both ways, at **64 ms/query with** the flag and
**20 ms without**. The penalty ratio was 4.96x in Ohio and 5.01x in Singapore —
constant across regions, so it adds round trips rather than fixed overhead. Neon's
pooler supports protocol-level prepared statements, so the flag cost ~3x for
nothing. **If `prepared statement "s0" already exists` ever appears in the API
logs, put the flag back** — that error is the exact failure it prevents, and it
only surfaces under concurrency.

### Known operational cost

Render's starter plan sleeps after inactivity; the first request pays 20–50 s.
That distorts early Core Web Vitals field data and can make Googlebot record
fetch errors. It is a real number, worth deciding deliberately rather than
discovering.

---

## 12. Current state — what is actually live

Production is **live** and its indexability controls behave as designed.
Verified by `curl` on 2026-09-12:

- `https://schooltocareer.in/` → 308 → `https://www.schooltocareer.in/` → 200.
- `/`, `/exams`, `/exam/gate`, `/exam/jee-advanced`, `/robots.txt`,
  `/sitemap.xml` all 200.
- `robots.txt`: `Allow: /`, `Disallow: /api`, `Disallow: /admin`, `Sitemap:`.
- `sitemap.xml`: **6 URLs**, every one `index, follow` — the sitemap advertises
  no `noindex` URL.
- Exam hubs serve `noindex, follow` with self-referencing canonicals, because
  those exams are not yet `isIndexable`. Correct behaviour, not a defect.

Local checks: 11/11 packages typecheck, `next build` clean, API `/health/ready`
green on all four dependencies (database, search, queue, cache).

### Progress against the honest metric

Status docs score the project by **intents satisfied**, not URLs published:

| Student intent | Satisfied |
| --- | --- |
| "When is the exam / am I eligible" | partial — hub only |
| "Download a specific paper" | no |
| "What's on the syllabus" | no |
| "Has my result come out" | no |
| "What do I study for Class 10 X" | no |
| "Which exam should I take" | no |
| "What will the cutoff be" | no — needs Phase 2 models |
| "Which chapters matter most" | no — needs question-level data |

**0 of 8 fully satisfied, 1 partial.** The unit of work is templates
(~18 total, a handful built), not the ~7,336 URLs the current seed implies.

---

## 13. Branch state — read this before deploying anything

Three branches diverge from `origin/main` (`1a6023a`), and they are **not**
interchangeable.

| Branch | Ahead of `origin/main` | Contains |
| --- | ---: | --- |
| `fix/remove-dead-links` *(checked out)* | 2 | The dead-link cleanup only |
| `fix/canonical-origin-www` | 1 | The `www` canonical origin change only |
| `feat/semantic-fact-engine` | 7 | The fact engine, auth/login, docs |
| `main` (local) | 9 | All of the above, merged |

**Pushing local `main` would deploy nine commits at once.** The status docs are
explicit that this should not be done.

### What the fact-engine branch adds (unpushed, ~7,600 lines)

- `packages/database/prisma/schema/facts.prisma` — `ExtractedFact`,
  `FactChange`, and the enums `FactType`, `FactConfidence`, `FactRisk`,
  `FactChangeKind`, `FactReviewStatus`; migration
  `20260904090000_semantic_facts`.
- `apps/api/src/modules/fact/` — extractor (781 lines), service, repository,
  controller, routes, DTOs, types, plus 1,100+ lines of tests.
- `apps/api/src/modules/auth/` — the login needed to reach the review queue.
- `apps/api/src/workers/tasks/extract-facts.task.ts`.
- CLI tooling: `extract-facts-now.ts`, `facts-report.ts`, `facts-review.ts`,
  `set-admin-password.ts`.
- Docs: `CANONICAL-FACT-OWNERSHIP.md`, `CURRENT-V1-IMPLEMENTATION-STATUS.md`.

> **Note on `IMPLEMENTATION_PLAN_REVIEW.md`.** That review lists fact
> intelligence as "not implemented". It was written against the checked-out
> branch, which is based on `origin/main` and predates this work. The engine
> exists on `feat/semantic-fact-engine`; what remains is the human fact
> approval, then deployment.

### The deploy-ordering trap

`isIndexableDeployment()` requires `NEXT_PUBLIC_SITE_URL === SITE.ORIGIN`, and
the value is **inlined at build time**. `SITE.ORIGIN` is now `www`; production's
env var is still the apex. So the order is fixed:

1. Set Vercel `NEXT_PUBLIC_SITE_URL` to `https://www.schooltocareer.in`.
2. Set Render `WEB_BASE_URL` and `CORS_ORIGINS` (API **and** worker) to `www` —
   dashboard values override `render.yaml`.
3. Deploy the code.
4. Re-run the production checks in `docs/DEPLOYMENT.md`.

Deploying the code first produces a site that silently `noindex`es itself.
Render CORS today allows the apex but **not** `www`; harmless while no browser
code calls the API, but it must change before the `www` deploy.

> **Unresolved contradiction:** `docs/DEPLOYMENT.md` still documents the apex as
> canonical and instructs `www` → apex redirects. The 2026-09-12 decision was
> the opposite. One of the two needs correcting before someone follows the stale
> instruction.

---

## 14. What is not built

### Frontend templates

Paper detail and year-specific paper pages; the entire board cluster (hub,
class, subject, chapter, syllabus, papers); result detail; blog category and
article; exam category pages; four of the eight exam-cluster sections; the
search results UI; the admin/editorial interface.

### Legal pages

Privacy policy, terms, disclaimer, contact — all missing. Footer links were
removed rather than shipping placeholder legal text. **Required before AdSense
review**, and the AdSense loader is already committed (`1a6023a`).

### Paper importer

Discovery from official HTML/PDF indexes, PDF signature and corruption
validation, metadata extraction, SHA-256 dedup workflow, duplicate review,
import reporting. Design note: the plan proposes new `storageMode` /
`officialUrl` / `hostedUrl` fields, but `QuestionPaperFile` + `MediaAsset`
already model versioned paper files. The importer should extend that, not create
a parallel storage path.

### Analytics and observability

API-level search logging exists (`SearchQueryLog`, which doubles as the
editorial backlog once traffic arrives). Missing: product event instrumentation
(search performed, zero-result, result click, paper download, official-link
click, result view, filter use), a production analytics store, and dashboards or
alerting for 404s, 500s, worker failures, retries and API latency.

### Editorial workflow

The *workflow* exists — `ContentDraft`, `ContentRevision`, `PublishStatus`,
scheduled publishing verified in `verify:e2e`, and `EXAM_PUBLISH` separated from
`EXAM_MANAGE` so an author can draft but not publish. What is missing is the
admin UI, plus two steps that were never modelled: a **fact-check gate** and
**update reminders** for pages going stale. The second matters most — an exam
page that was right in March and wrong in June is worse than no page.

---

## 15. Known issues and open items

| Item | Status |
| --- | --- |
| Apex-vs-`www` canonical | Fixed in code, verified locally, **not deployed**; `docs/DEPLOYMENT.md` still says apex |
| Dead internal links | A production crawl found 172 of 280 destinations 404ing. Fixed on `fix/remove-dead-links` (108 destinations, all 200), **not deployed** |
| `/boards` meta description | Still overclaims "syllabus, date sheets, previous year question papers and results, organised by class and subject" |
| Neon credential | Password was shared in a chat transcript; rotate before real user data exists. The old us-east-2 project should be deleted, not left running |
| Seed display names | Exams stored as `JEE MAIN`, rendering in caps — wrong as the convention editors will copy |
| DTO sharing | Only `ExamDto` hoisted to `@stc/types`; 7 modules still declare DTOs inside the API |
| Provenance untested | Every seeded date is `isTentative`, so the *official* branch has never rendered against real data |
| ESLint on tooling | `tooling/scripts` typechecks but has no `lint` script |
| Build-time API warnings | `next build` emits `ECONNREFUSED` when the API is not running; the build succeeds but API-backed static generation is not exercised |
| Phase numbering | Repo docs call source acquisition Phase 0 and facts Phase 1; the plan doc calls observability Phase 1 and facts Phase 2. Pick one |
| Fact terminology | `OfficialFact` vs `ExtractedFact` used interchangeably in planning docs. The shipped schema uses `ExtractedFact` + `FactChange` |
| Untracked files | `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PLAN_REVIEW.md`, three `docs/*.md` and `verify-fact-transaction.js` are uncommitted |

### Closed, worth remembering

- **Cache revalidation never delivered** (closed 3 Sep). `/api/revalidate` did
  not exist; the worker had been POSTing to it since the cache layer was built,
  so every `CACHE_REVALIDATE` event dead-lettered and pages refreshed only on
  their one-hour TTL.
- **Placeholder data published to production** (closed 3 Sep). See §9.
- **Robots misreporting** (closed). The fetcher claimed "robots.txt disallows
  us" when it had failed to ask.
- **pgbouncer latency** and **database region** (both closed 9 Aug). See §11.

---

## 16. Roadmap

Recommended order, reconciling the plan review with the repo's own sequencing.
The principle: start the clock on things that need calendar time, then build the
template that unlocks the most other templates.

**Phase 0 — Stabilize production config.** Deploy the `www` canonical (env
first, then code), update Vercel and Render, re-run the SEO and dead-link
checks, confirm revalidation delivery. Keep unverified pages `noindex`.

**Phase 1 — Activate verified content.** Complete the six fact decisions; verify
canonical `ExamEvent` values, reviewer attribution, audit rows, outbox
processing and revalidation; activate the first evidence-backed exam cohort;
confirm the sitemap includes only indexable pages. Decide how JEE Advanced's
identity is handled.

**Phase 2 — Search and analytics.** Search is the universal renderer: board
hubs, class pages, paper browse, exam category listings and result listings are
the same component with different presets, so building it well finishes a large
fraction of the remaining templates as a side effect. Add empty, error, loading
and zero-result states, plus result-click tracking.

**Phase 3 — Shared browse renderer** across exams, papers, results, boards and
articles, reusing existing pagination, filtering, metadata and provenance
conventions.

**Phase 4 — Paper detail and browse.** Evergreen and transactional: "JEE Main
2021 Physics Shift 2 PDF" is searched every year by a new cohort with
unambiguous intent.

**Phase 5 — Fact intelligence.** Land `feat/semantic-fact-engine`, finalize
terminology, and add end-to-end tests from source snapshot to published value.

**Phase 6 — Paper import.** Start with a bounded official-paper cohort; validate
idempotency and duplicate handling.

**Phase 7 — Remaining templates and admin.** Board ecosystem, results, articles,
legal pages, admin/editorial UI, fact review queue, stale-page reminders.

**Deferred:** question-level analytics, recommendations, rank predictors, paper
analysis, embeddings and AI. All need question-level data and stable content
workflows first.

### Content tiering

| Tier | Scale | Policy |
| --- | ---: | --- |
| 0 — Money pages | ~50 | A *product* tier, not a content tier. Each is closer to a small application than a page. 14-point checklist, 10 items machine-checkable |
| 1 — Hubs | ~1,400 | Full reference depth, editorially maintained, indexable. These carry the rankings |
| 2 — Records | ~21,000 | Papers, results, articles. Honest and shallow. Indexable, never padded |
| 3 — Long tail | ~37,000 | Chapters and subject leaves. `noindex, follow` until they hold real content |

The mechanism already exists — `buildMetadata` takes a `noindex` flag and
`NOINDEX_PATHS` is enforced centrally — so tiering is a policy applied in one
place.

**The KPI is queries owned, not pages published.** Authority compounds per topic
cluster, not per URL.

---

## 17. Working on this repo

### Commands

```bash
pnpm dev                 # turbo run dev across the workspace
pnpm build               # production build
pnpm typecheck           # 11 packages
pnpm lint
pnpm test                # vitest
pnpm arch:check          # architectural metrics
pnpm format

pnpm db:generate         # prisma generate
pnpm db:migrate          # guarded migrate dev
pnpm db:deploy           # migrate deploy
pnpm db:constraints      # REQUIRED after every migration
pnpm db:seed
pnpm db:studio
pnpm db:plans            # capture query plans

pnpm gate:integrity      # production data integrity; --live adds a sitemap fetch
pnpm verify:e2e
pnpm sources:seed        # also: sources:fetch, sources:report
```

### Windows notes

`pnpm` is not on PATH on the primary dev machine — use `corepack pnpm`. The web
package is `@stc/web`, not `web`:

```powershell
cd apps/api; corepack pnpm dev              # terminal 1, :4000
corepack pnpm --filter @stc/web dev         # terminal 2, :3000
```

`pnpm admin:set-password` is only needed to log into `/admin`; it writes to the
database, so leave it out of a read-only smoke test.

### Local behaviour that is not a bug

- Every local page is `noindex, follow`, including the homepage.
- Local `robots.txt` is `Disallow: /`.
- Canonicals point at the production domain, because they always derive from
  `SITE.ORIGIN` rather than the serving host.

All three come from `isIndexableDeployment()`
(`apps/web/src/lib/seo/metadata.ts:84`) and `apps/web/src/app/robots.ts:17`.

### Rules that will fail your build

1. Never import Prisma outside a `*.repository.ts`.
2. Never touch the database from `apps/web` — go through the API.
3. Never build a URL by string concatenation — add it to `ROUTES`.
4. Never run `prisma migrate dev` against a remote database (guarded).
5. Never skip `pnpm db:constraints` after a migration.
6. Never seed fabricated data into production (gated).

---

## 18. Document map

| Document | What it is |
| --- | --- |
| [`PRINCIPLES.md`](PRINCIPLES.md) | Eight product principles, used as a tiebreaker and a veto |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | The 2,212-line roadmap (untracked) |
| [`IMPLEMENTATION_PLAN_REVIEW.md`](IMPLEMENTATION_PLAN_REVIEW.md) | Audit of that plan; predates the fact engine |
| [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) | Build status, tiering, intent map, Tier 0 checklist |
| [`docs/WEBSITE-STATUS-2026-09-12.md`](docs/WEBSITE-STATUS-2026-09-12.md) | Live production verification and branch state |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Render/Vercel setup — **apex canonical section is stale** |
| [`docs/V1-PRODUCT-DIRECTION.md`](docs/V1-PRODUCT-DIRECTION.md) | Product direction |
| [`docs/PHASE-1-ASSESSMENT.md`](docs/PHASE-1-ASSESSMENT.md) | Phase 1 assessment |
| [`docs/MASTER-V1-EXECUTION-PROMPT.md`](docs/MASTER-V1-EXECUTION-PROMPT.md) | Execution prompt |
| [`docs/MASTER-PROMPT-REVIEW.md`](docs/MASTER-PROMPT-REVIEW.md) | Review of that prompt |
| [`docs/architecture/data-integrity.md`](docs/architecture/data-integrity.md) | The fabricated-data incident and its gate |
| [`docs/architecture/source-acquisition.md`](docs/architecture/source-acquisition.md) | Which official sources are reachable, measured |
| [`docs/architecture/query-plans.md`](docs/architecture/query-plans.md) | Captured query plans |
| [`docs/architecture/consistency-review.md`](docs/architecture/consistency-review.md) | Consistency review |
| [`docs/architecture/module-deltas.md`](docs/architecture/module-deltas.md) | Module deltas |
| [`docs/architecture/operational-validation.md`](docs/architecture/operational-validation.md) | Operational validation |
| [`docs/architecture/schema-full-v1/`](docs/architecture/schema-full-v1/) | The deferred 89-model design |

---

## 19. One-paragraph summary

A production-deployed platform foundation with genuinely strong engineering:
enforced architectural layering, a transactional outbox, measured database and
pooling decisions, source monitoring with snapshots and hashing, three-gate
indexability, and an integrity gate written in response to a real incident. The
API is broadly complete at ~96 route handlers across 8 modules. The frontend is
not: roughly 4 of ~18 templates exist, the sitemap carries 6 URLs, and 0 of 8
student intents are fully satisfied. The nearest work is not new features — it is
deploying three finished branches in the right order, completing the human fact
approvals that unlock the first indexable exam cohort, and shipping the legal
pages that AdSense requires.
