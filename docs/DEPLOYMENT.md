# Deployment — Phase A

Goal is not visitors. It is starting clocks that cannot be started locally:
Search Console index history, Core Web Vitals field data, and the production
behaviours (cold starts, CDN, compression, real DNS) that only appear once
something is served over the internet.

Ship what exists — home, exam hub, robots, sitemap. Three page types is enough.

---

## Database: done (9 Aug 2026)

The database was moved from `us-east-2` to **`ap-southeast-1`** (Singapore),
matching Render's nearest region to India. Measured from India:

| | Ohio | Singapore |
| --- | ---: | ---: |
| Round trip | 276 ms | **93 ms** |
| Full seed (3,000 papers) | 653 s | **214 s** |
| Seven facet aggregations | 4,171 ms | **1,541 ms** |
| Recursive cycle guard | 609 ms | **175 ms** |

No query plan changed — those last two were round-trip bound all along, which
is what the move was meant to prove.

**`pgbouncer=true` was removed.** Tested at 24-way concurrency over 192
parameterised queries against the pooled endpoint:

| | result | per query |
| --- | --- | ---: |
| with `pgbouncer=true` | 192/192 ok | 64 ms |
| without | 192/192 ok | **20 ms** |

Zero prepared-statement errors either way. Neon's pooler supports protocol-level
prepared statements, so the flag was costing roughly 3x for nothing. The penalty
ratio was 4.96x in Ohio and 5.01x in Singapore — constant across regions, which
means it adds round trips rather than fixed overhead.

**If `prepared statement "s0" already exists` ever appears in the API logs, put
the flag back.** That error is the exact failure it prevents, and it only shows
up under concurrency.

Keep migrations on `DIRECT_DATABASE_URL` regardless — transaction pooling breaks
advisory locks and DDL.

---

## Backend — Render

`render.yaml` at the repo root defines two services. Connect the repo as a
Blueprint and Render reads it.

The worker is a **separate service**, not a flag on the API. A worker crash-loop
must not take the API down, and the two scale on different signals — the API on
request volume, the worker on outbox depth.

Set these in the dashboard (they are `sync: false` in the blueprint, so they are
never committed):

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Pooled endpoint. See the pgbouncer note above. |
| `DIRECT_DATABASE_URL` | Unpooled. Migrations and DDL only. |
| `SITE_ID` | The single `Site` row id. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `CLOUDINARY_*` | Required at boot even before uploads are used. |
| `IP_HASH_SALT` | Rotating it resets rate-limit buckets. |
| `REVALIDATE_SECRET` | Must match the web app's copy. |
| `INDEXNOW_KEY` | Optional. Absent disables the ping cleanly. |

Health check is `/health`. It has a 1.5 s timeout per dependency, so a dead
database returns quickly instead of hanging the check.

**Run migrations from a shell, not from the build.** `pnpm db:deploy` followed by
`pnpm db:constraints`. The second is not optional — `prisma migrate` recreates
`SearchDocument.searchVector` as a plain column, and only the manual SQL converts
it back to `GENERATED`. Skip it and full-text search silently returns nothing.

---

## Frontend — Vercel

Import the repo, set **root directory to `apps/web`**. Vercel detects the pnpm
workspace and Turborepo.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://schooltocareer.in` |
| `API_BASE_URL` | The Render service URL |
| `REVALIDATE_SECRET` | Same value as the API |

`NEXT_PUBLIC_SITE_URL` is what makes the deployment indexable.
`isIndexableDeployment()` requires it to equal the apex exactly — so every
preview deployment emits `noindex` automatically and cannot compete with
production for its own keywords. That is deliberate; do not set it on previews.

---

## Domain

Apex, no `www`, no trailing slash. `SITE.ORIGIN` is the single constant every
absolute URL derives from.

1. Add `schooltocareer.in` in Vercel; follow its A/ALIAS record instructions.
2. Add `www.schooltocareer.in` and set it to **permanent redirect** to the apex.
   Serving both is duplicate content, and switching later costs a full re-crawl.
3. Wait for SSL to provision before submitting anything to Search Console.

---

## Verify before announcing

```
curl -sI https://schooltocareer.in/ | head -20
curl -s  https://schooltocareer.in/robots.txt
curl -s  https://schooltocareer.in/sitemap.xml
curl -sI https://www.schooltocareer.in/ | grep -i location
```

- `robots.txt` allows `/` and lists the sitemap. If it says `Disallow: /`, then
  `NEXT_PUBLIC_SITE_URL` is wrong and the whole site is non-indexable.
- Canonical on the home page is `https://schooltocareer.in/`, not the Vercel URL.
- `www` returns 308 to the apex.
- An exam page renders with live data, not the empty state.

---

## Then, Phase A2

- Search Console: verify, submit `sitemap.xml`, watch Index Coverage weekly
- Analytics with the events that matter here — PDF downloads, internal search
  terms, zero-result queries
- Uptime and 404 monitoring
- Core Web Vitals field data starts accumulating; it needs weeks, which is the
  whole reason for deploying now

---

## Known: cold starts

Render's starter plan sleeps after inactivity, and the first request pays 20–50 s.
That will make early Lighthouse field data look terrible and can cause Googlebot
to record fetch errors. Either accept it while traffic is nil and upgrade before
promoting the site, or start on a paid instance. It is a real number, not a
rounding error, and it is worth deciding deliberately rather than discovering.
