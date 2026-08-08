# Operational validation — first run against live PostgreSQL

**Date:** 2026-08-06 · **Target:** Neon, PostgreSQL 18.4 (aarch64), region `us-east-2`

Until this run, no statement in the schema or the manual SQL had ever executed.
All 122 unit tests used fakes. This is the record of what that concealed.

## Result

| Step | Outcome |
| --- | --- |
| `db:migrate --name init` | 30 models applied |
| `db:constraints` | 17 statements, 0 failed |
| `db:seed` | 3,000 papers · 320 board classes · 300 posts · 200 results · 653 s |
| `verify:e2e` | **34 / 34** |
| `db:plans` | **10 / 10** |

## What the database caught that the tests could not

### 1. The generated tsvector column was never generated

`prisma migrate` creates `searchVector` as a **plain** `tsvector`, because the
schema declares it `Unsupported("tsvector")?`. The manual SQL then ran
`ADD COLUMN IF NOT EXISTS`, found the column already present, did nothing, and
reported success. The GIN index built cleanly over a column that would have been
`NULL` for every row forever.

Full-text search would have returned zero results in production with no error
raised anywhere in the stack.

Fixed by replacing `ADD COLUMN IF NOT EXISTS` with a `DO` block that drops the
column when it exists but is not generated, then adds it properly. Re-running
when it is already correct does nothing — which matters, because
`ADD COLUMN ... STORED` takes `ACCESS EXCLUSIVE` and rewrites the table.

### 2. Underneath that, the generation expression was never legal

Once the `ADD COLUMN` actually ran, PostgreSQL rejected it:

```
42P17: generation expression is not immutable
```

`array_to_string` is marked **STABLE**, not `IMMUTABLE` — in the general case it
calls an element type's output function. Generated columns require `IMMUTABLE`.

The file's own comment asserted the expression was immutable "because both
`to_tsvector` calls use LITERAL regconfig values". That was true of
`to_tsvector` and simply overlooked the other function in the same expression.

Fixed with `stc_keywords_text(text[])`, an `IMMUTABLE STRICT PARALLEL SAFE`
wrapper. The assertion is safe for `text[]` specifically, which is the only type
it accepts.

**Bug 1 hid bug 2.** Neither is reachable without a real server.

### 3. The unfiltered paper listing had no usable index

Every index on `QuestionPaper` that orders by `year` is prefixed by `examId`,
`boardClassId` or `paperType`. The default browse — all live papers, newest
first — could use none of them, and fell back to a Seq Scan plus a top-N
heapsort over every row.

Added `idx_paper_live_year (year DESC, id DESC) WHERE live`, matching the keyset
cursor so the sort node disappears rather than merely getting cheaper.

```
before   Seq Scan + top-N heapsort, 3,000 rows    1.385 ms
after    Index Scan using idx_paper_live_year     0.090 ms
```

The gain is not the 15×; it is that the query stopped being linear in table
size. At 20,418 papers the old plan sorts every row on the most-visited listing
on the site.

## Three checks that could not fail

A theme worth recording: the verification tooling was less reliable than the
code it verified.

| Check | Defect |
| --- | --- |
| `PostgreSQL 15 or newer` | Read `rows[0].v`, but `SHOW server_version` returns a column named `server_version`. Read `undefined`, died on `.split()`. Now uses `current_setting('server_version_num')` — no string parsing. |
| `generated tsvector column is populated` | Counted non-`NULL` vectors and returned a string; it never threw. With `SearchDocument` empty it reported **"ok — 0 documents with a vector"**. This was the check that existed to catch bug 1, and it would have passed anyway. Now asserts `pg_attribute.attgenerated = 's'`. |
| `Handler writes outside a transaction` | Looked ahead a fixed 12 lines for the `tx` argument and cut at the first `');'`. `AuditHandler.handle` passes `tx` on line 49 of a call opening on line 34 — outside the window, so `args` became the whole window and the test failed open into a false violation. Now scans forward with balanced parentheses. |

The plan reporter had the same shape of problem in reverse: it flagged **any**
Seq Scan, producing 7 false alarms out of 10 on tables that were empty or had
fewer than 20 rows, where a Seq Scan is the correct plan. A report that is 70%
noise gets skimmed, and the one real finding gets skipped with the rest. It now
distinguishes a Seq Scan over ≥500 actual rows from one below it.

## Connection findings

### `pgbouncer=true` costs 1.08 s per query on Neon

| Endpoint | Parameters | Median `SELECT 1` |
| --- | --- | --- |
| pooled | `pgbouncer=true` | **1370 ms** |
| pooled | without `pgbouncer=true` | 283 ms |
| direct | — | 276 ms |

Isolated by elimination: `channel_binding` and `connection_limit` make no
difference; `pgbouncer=true` alone accounts for all of it, roughly four extra
round trips.

`.env.example` prescribes this flag and Prisma's documentation recommends it for
PgBouncer, so the API runtime would have carried a full second of dead time on
every endpoint.

**Resolved 2026-08-09 — flag removed.** Tested at 24-way concurrency over 192
parameterised queries against the pooled endpoint:

| | result | per query |
| --- | --- | ---: |
| with `pgbouncer=true` | 192/192 ok | 64 ms |
| without | 192/192 ok | **20 ms** |

Zero prepared-statement errors either way. The penalty ratio was 4.96x in
us-east-2 and 5.01x in ap-southeast-1 — constant across two regions 6,000 miles
apart, which shows the flag adds round trips rather than fixed overhead, and so
its cost scales with distance and never optimises away.

Watch the API logs for `prepared statement "s0" already exists`. That signature,
and only that one, means the flag has to go back.

### Bulk work belongs on the direct endpoint

The seed ran 3,000+ upserts. On the pooled endpoint it reached 161 rows in 13
minutes; on the direct endpoint the whole seed finished in 653 s.

## Re-measured after the region move (9 Aug 2026)

Both numbers below were flagged as round-trip bound rather than plan bound. The
move to `ap-southeast-1` confirmed it — no plan changed, and both fell in
proportion to latency:

| | us-east-2 | ap-southeast-1 | ratio |
| --- | ---: | ---: | ---: |
| Round trip (`SELECT 1`) | 276 ms | 93 ms | 2.97x |
| Seven facet aggregations | 4,171 ms | 1,541 ms | 2.71x |
| Recursive cycle guard | 609 ms | 175 ms | 3.48x |
| Full seed | 653 s | 214 s | 3.05x |

The facet transaction is still ~9 round trips; it is simply that each one now
costs a third of what it did. Co-locating the API with the database in Singapore
removes almost all of what remains.

## Still not covered

Unchanged from the `verify:e2e` footer — these need the worker process and live
provider accounts:

- `CACHE_REVALIDATE` delivery to the Next.js endpoint
- Cloudinary sign / confirm / replace round-trip
- IndexNow submission

They are enqueued and asserted as outbox rows; delivery is a separate step.

## The scripts are now typechecked (2026-08-09)

`tooling/scripts` is a workspace package (`@stc/scripts`) with its own
`tsconfig.json` on the same strict settings as the application. `turbo run
typecheck` covers 10 packages instead of 9, so CI now validates the
verification scripts alongside the code they verify.

Compiling them for the first time produced three classes of error:

| Error | Detail |
| --- | --- |
| `TS1470` in 3 files | `import.meta.url` is ESM-only, and the package resolved to CommonJS. `tsx` had been shimming it silently. Fixed by declaring `"type": "module"` — which is what the code always was. |
| `noUncheckedIndexedAccess`, 2 sites | `error.message.split('\n')[0]` is `string \| undefined` and fed straight into a `string`, in the failure path of both error reporters. |
| 9 × `groupBy` uncompilable | With a **literal** `by: ['year']`, Prisma's conditional type requires an `orderBy` key to be present; `exactOptionalPropertyTypes` then forbids `orderBy: undefined` as its value. The literal form cannot be written at all under this repo's settings. |

The `groupBy` finding is the substantive one. `QuestionPaperRepository.facetCounts`
had already solved it — variable-typed `by`, cast at the call site,
`$transaction(queries as never)` — while `verify-e2e` had drifted to a shape
that could never have compiled, and nothing noticed because it never was.

The faceting checks now build their queries through a shared `facetQueries()`
helper mirroring the repository, so the check exercises the construction it
claims to verify. No `ORDER BY` is emitted either way; results are unchanged
(12 vs 1 years, 85 buckets), confirming the rewrite preserved semantics.

Declaring `"type": "module"` changes how `tsx` executes these files, so all
four were re-run afterwards: arch-check 5/5, constraints 17/17,
`verify:e2e` 34/34, `db:plans` 10/10.

## Environment notes
- `prisma migrate` writes to `prisma/schema/migrations/`, not
  `prisma/migrations/`, because the schema folder is the migration root under
  `prismaSchemaFolder`. The manual SQL lives in `prisma/migrations/manual/` and
  is unaffected.
- Re-run `db:constraints` after every `migrate deploy` and after any
  `migrate reset`: a migration that recreates `SearchDocument` restores the
  plain column, and the `DO` block is what converts it back.
