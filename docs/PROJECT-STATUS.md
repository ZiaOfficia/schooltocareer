# Build status

**As of 9 Aug 2026.** Counts taken from the live seeded database, not estimated.

The backend is complete and validated against real PostgreSQL. The frontend is
one reference page and the foundation beneath it. The hard architecture is done
and almost none of the site is.

## How many pages are not built

Two questions hide in that one.

| | count |
| --- | --- |
| Distinct route templates in `ROUTES` | 38 |
| Route templates built | **2** (home, exam hub) |
| Route templates missing | **36** |
| URLs the current seed implies | 7,336 |
| URLs live | **21** |
| URLs missing | **7,315** (99.7%) |

The 20 exam hubs came from building *one* page — the dynamic route generates
every instance. Most remaining templates are the same shape of work. But the
count also understates the gap: at launch volume the same templates produce
roughly 60,000 URLs, not 7,000.

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
directions. They reconcile as three tiers. **This needs a decision — it changes
what gets built.**

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
| `pgbouncer=true` latency | Costs 1.08 s per query on Neon's pooler (1370 ms vs 283 ms). Removing it needs a concurrency test — it prevents "prepared statement already exists". |
| Database credential | Current Neon password was shared in a chat transcript. Previous one confirmed revoked; rotate this one out-of-band before real user data exists. |
| Seed display names | Exams stored as `JEE MAIN`, rendering in caps. Wrong as the convention editors copy. |
| DTO sharing | Only `ExamDto` is hoisted to `@stc/types`. 7 modules still declare DTOs inside the API. |
| Provenance untested | Every seeded date is `isTentative`, so the *official* branch has never rendered against real data. |
| ESLint on tooling | `tooling/scripts` typechecks but has no `lint` script. |
| Worker not deployed | Cache revalidation, Cloudinary round-trip and IndexNow are asserted as outbox rows only; delivery has never run. |
| Nothing deployed | No Vercel, no Render, no DNS. The apex canonical policy is enforced in code but never exercised in production. |

## Next, in order

Highest search intent per unit of work.

1. **Exam cluster pages** (7 routes, 140 URLs) — completes Phase 1 for the
   highest-intent queries. Reuses the reference page wholesale.
2. **Search results** (1) — already designed; board pages become filtered
   versions of it.
3. **Paper detail + browse** (3,001) — largest corpus, clearest transactional
   intent.
4. **Board / class hubs** (980) — assembly work once search exists.
5. **Result detail + articles** (500) — spiky seasonal traffic.
6. **Deploy** — until this happens the canonical policy is theory.
7. **Admin** — needed before anyone but you can add content.

Items 1–5 take the site from 21 live URLs to roughly 4,600 — about 63% of
everything the current data can produce — without a single new backend endpoint.
