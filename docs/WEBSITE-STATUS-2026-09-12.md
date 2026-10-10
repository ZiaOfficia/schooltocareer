# SchoolToCareer Website Status

**Date:** 2026-09-12

## Executive summary

The public production site is **live**. The local workspace was only down because
nothing had been started in it; once started, it came up cleanly with no startup errors.

An earlier draft of this file said "the website is currently not live". It based that
on a browser showing `chrome-error://chromewebdata/` for `http://localhost:3000/`.
That error only means nothing was listening on port 3000 in this workspace. It said
nothing about production, and it didn't point to any application defect.

| Area | Status | Evidence |
| --- | --- | --- |
| Repository | Substantial, real implementation | Routes, SEO and trust safeguards below |
| Local workspace (before start) | Not running on :3000 | Browser error surface only |
| Local workspace (after start) | Running, all probed routes 200 | "Local verification" below |
| Public production deployment | Live on Vercel | "Production verification" below |
| Product activation | Partial | Only 6 URLs in the sitemap; exam hubs are `noindex` |
| V1 completion | Not complete | See "What is not complete" |
| Trust/indexability safeguards | Present and behaving as designed | Verified locally and in production |

This file doesn't replace the fact-review handoff. The activation gate is still
the six fact decisions, followed by verification of canonical → audit → outbox → revalidation.

## Production verification

Probed 2026-09-12 with `curl` against the public domain.

- `https://schooltocareer.in/` → **308** → `https://www.schooltocareer.in/` → **200**, `Server: Vercel`
- `/`, `/exams`, `/exam/gate`, `/exam/jee-advanced`, `/robots.txt`, `/sitemap.xml`: all **200**
- Homepage: title `SchoolToCareer — Exams, Boards, Papers &…`, H1 "Every exam date, paper and result. In one place.", `index, follow`
- `/exam/gate` and `/exam/jee-advanced`: `noindex, follow`, with self-referencing canonicals. This is correct: the exams aren't yet `isIndexable` (`apps/web/src/app/exam/[slug]/page.tsx:76`)
- `robots.txt`: `Allow: /`, `Disallow: /api`, `Disallow: /admin`, and a `Sitemap:` line
- `sitemap.xml`: 6 URLs (`/`, `/exams`, `/boards`, `/previous-year-papers`, `/results`, `/blog`). Every one of them serves `index, follow`, so the sitemap contains no `noindex` URLs.

### Canonical host vs. served host: fixed in code, not yet deployed

In production, every canonical, sitemap `<loc>` entry and the `robots.txt`
`Host:` line use the apex `https://schooltocareer.in`, which Vercel 308-redirects
to `www`. So every canonical points at a URL that redirects.

**Decision (2026-09-12): `www` is canonical.** `SITE.ORIGIN` is now
`https://www.schooltocareer.in`. `render.yaml` (`WEB_BASE_URL`, `CORS_ORIGINS`),
`apps/api/.env.example`, the source-fetcher User-Agent and `docs/DEPLOYMENT.md`
were changed to match.

Verified locally with a production build (`NODE_ENV=production`,
`NEXT_PUBLIC_SITE_URL=https://www.schooltocareer.in`, then `next start`):

- `/`, `/exams`, `/exam/gate`, `/exam/jee-advanced`, `/robots.txt`, `/sitemap.xml`: all 200
- canonical, `og:url`, and JSON-LD `@id`/`url`/breadcrumb `item`: all use `www`
- all 6 sitemap `<loc>` entries use `www`, and the robots `Host:`/`Sitemap:` lines use `www`
- 0 bare-apex URLs across all six responses
- `/` and `/exams` are `index, follow`, and the exam hubs stay `noindex, follow`
- typecheck is clean (constants, config, web, api), and the API tests pass 240/240

**Deploy order matters.** `isIndexableDeployment` requires
`NEXT_PUBLIC_SITE_URL === SITE.ORIGIN`, and the value is inlined at build time.
Production currently has the apex value. Checked directly: with the new code,
the apex value returns `indexable: false`. So:

1. Set Vercel `NEXT_PUBLIC_SITE_URL` to `https://www.schooltocareer.in`.
2. Set Render `WEB_BASE_URL` (API and worker) and `CORS_ORIGINS` to `www`
   (dashboard values can override `render.yaml`).
3. Deploy the code.
4. Re-run the production checks in `docs/DEPLOYMENT.md` → "Verify before announcing".

The revalidation webhook works through the apex redirect today only because the
secret is sent as `X-Revalidate-Secret`. On Node v24.17.0, `fetch` drops
`Authorization` on a cross-origin 308 and keeps custom headers and the POST body.
Pointing `WEB_BASE_URL` at `www` removes that hop.

### Dead internal links: fixed on a branch, not yet deployed

A crawl of production (every `<a href>`, JSON-LD destination and sitemap URL,
following links from the six listing pages) found **172 of 280 destinations
returning 404**:

- 20 × `/board/<slug>`: `/boards` links every board, but no board route exists
- 80 × `/exam/<slug>/{syllabus,exam-pattern,eligibility,application-form}`: sections with no content
- 60 × `/exam/<slug>/previous-year-papers/<year>`: no such route
- `/exams/<category>`: each exam's category badge and breadcrumb JSON-LD, but no category route exists

None of these came from the canonical-origin work. They were in production
before it started.

Branch `fix/remove-dead-links` (two commits on GitHub `main`: `50df140`, from
Sep 4 and never pushed, plus the board/category fix) lists boards unlinked,
shows the category as a label, drops it from the breadcrumb, and links only exam
sections that render. It adds no placeholder pages. The same crawl against a
local production build of that branch: **108 destinations, all 200**, covering
20 exam hubs and 80 section pages.

Still overclaiming (not changed): the `/boards` meta description promises
"syllabus, date sheets, previous year question papers and results, organised
by class and subject".

### Branches (both unpushed, each based directly on GitHub `main` `1a6023a`)

| Branch | Commits | Deploys |
| --- | --- | --- |
| `fix/canonical-origin-www` | `41830e2` | the origin change only. Needs Vercel/Render env first |
| `fix/remove-dead-links` | `50df140` + board/category fix | link cleanup only |

Local `main` is 9 commits ahead of GitHub (fact engine, login, `50df140`, docs).
Pushing `main` would deploy all of them at once. Don't do that.

Render CORS today (checked via preflight against
`https://schooltocareer.onrender.com`): `https://schooltocareer.in` is allowed,
`https://www.schooltocareer.in` is **not**. Harmless while no browser code calls
the API, but `CORS_ORIGINS` must change before the www deploy.

## Local verification

### Dependency chain

```
Neon PostgreSQL (remote, ap-southeast-1; not a local Postgres)
  ↓
API      apps/api   — `tsx watch --env-file=.env src/server.ts`, PORT=4000
  ↓
Web      apps/web   — `next dev -p 3000`, API_BASE_URL=http://localhost:4000
```

### Commands that actually work on this machine

`pnpm` isn't on PATH here, so use `corepack pnpm`. The web package is named
`@stc/web`, not `web`.

```powershell
# terminal 1
cd apps/api; corepack pnpm dev
# terminal 2
corepack pnpm --filter @stc/web dev
```

`pnpm admin:set-password` isn't needed to serve pages. It only matters for
logging into `/admin`, and it writes to the database, so leave it out of a
read-only smoke test.

### Results

| Check | Result |
| --- | --- |
| API startup | `API listening port: 4000`, no errors |
| `GET /health` (liveness) | 200 `status: ok` |
| `GET /health/ready` (readiness) | 200 `ready`: database ok (379 ms), search ok, queue ok (9 pending), cache ok |
| Web startup | Next.js 15.5.23, `Ready in 15.9s`, no errors |
| `/` | 200, same title and H1 as production |
| `/exams` | 200, H1 "Exams" |
| `/exam/gate` | 200, H1 "GATE", canonical `https://schooltocareer.in/exam/gate` |
| `/exam/jee-advanced` | 200, H1 "JEE ADVANCED", canonical `https://schooltocareer.in/exam/jee-advanced` |
| `/sitemap.xml` | 200, same 6 URLs as production |
| Server logs after requests | No runtime errors (only 404 warnings from deliberate probes of non-existent health paths) |

### Expected local-only differences (not defects)

- **Every local page is `noindex, follow`, including the homepage.** `buildMetadata`
  treats a page as indexable only on the real production deployment
  (`isIndexableDeployment`, `apps/web/src/lib/seo/metadata.ts:84-92`), and local
  `NODE_ENV` is `development`.
- **Local `robots.txt` is `Disallow: /`.** The same deployment check applies
  (`apps/web/src/app/robots.ts:17-31`). This stops previews and dev from being indexed.
- Canonicals always use `SITE.ORIGIN` rather than the host serving the
  request, which is why local pages canonicalize to the production domain.

## Current truth on the repo

- Homepage: [apps/web/src/app/page.tsx](../apps/web/src/app/page.tsx)
- Exam hubs: [apps/web/src/app/exam/[slug]/page.tsx](../apps/web/src/app/exam/[slug]/page.tsx)
- Exam sections: [apps/web/src/app/exam/[slug]/[section]/page.tsx](../apps/web/src/app/exam/[slug]/[section]/page.tsx)
- Sitemap / robots: [apps/web/src/app/sitemap.ts](../apps/web/src/app/sitemap.ts), [apps/web/src/app/robots.ts](../apps/web/src/app/robots.ts)
- Exam cluster registry: [apps/web/src/lib/exam-sections.ts](../apps/web/src/lib/exam-sections.ts)

Related status docs:

- [docs/PROJECT-COMPLETION-STATUS-2026-09-04.md](./PROJECT-COMPLETION-STATUS-2026-09-04.md)
- [docs/CURRENT-V1-IMPLEMENTATION-STATUS.md](./CURRENT-V1-IMPLEMENTATION-STATUS.md)
- [docs/POST-APPROVAL-ACTIVATION-AND-V1-EXECUTION-PROMPT.md](./POST-APPROVAL-ACTIVATION-AND-V1-EXECUTION-PROMPT.md)

## What is not complete

- verified exam identity data is still being activated
- exam pages still need source-backed official identity and overview content, and until they have it the hubs stay `noindex`
- the first real exam cohort still needs full activation
- papers, boards, editorial and search work remain future execution items

## Verdict

This is a runtime-status note. It doesn't justify any merge or architecture action.
Production is live and its indexability controls behave as designed: it indexes
only the 6 hub/listing URLs and keeps unverified exam hubs `noindex`. The local
stack starts cleanly. The apex-vs-`www` canonical mismatch is fixed in code and
verified locally. It still needs the Vercel and Render env changes, then a
deploy, then production re-verification.

Next steps, in order:

1. Deploy the canonical-origin fix (env first, then code).
2. Re-run the production SEO checks.
3. Complete the six fact decisions.
4. Verify canonical ExamEvent values, reviewer attribution, audit rows,
   outbox count, revalidation, page state and sitemap/indexability.
5. Decide how to handle JEE Advanced identity.
6. Only then move on to the first indexable exam cohort.
