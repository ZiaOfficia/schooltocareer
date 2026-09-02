# Source acquisition — what Phase 0 actually found

**As of 3 Sep 2026.** Two fetch cycles over the 20 seeded sources. Numbers from
`pnpm sources:report`, not estimated.

## The headline

The first cycle reported **7 of 20 sources as blocked by robots.txt**, including
JEE Main, NEET and every CBSE page — the four highest-value sources on the list.

**Not one of them was blocked.** The true count of sources disallowed by
robots.txt is **zero**, and it has been zero the whole time.

The fetcher could not tell "the site told us not to" apart from "we could not
ask", and recorded both as `BLOCKED_BY_ROBOTS`. Those need opposite responses:
the first is settled policy that nobody should revisit, the second is a bug
report. Filing the second as the first is how a source disappears quietly and
permanently from a watch list.

This is fixed — `ROBOTS_UNAVAILABLE` is now a separate outcome, `Source.robotsError`
carries the verbatim reason, and the existing snapshots were reclassified in
migration `20260903120100`.

## What is really happening

| Condition | Count | Whose problem | Response |
| --- | ---: | --- | --- |
| Disallowed by robots.txt | **0** | The site's | Never fetch. None to act on. |
| Refused our client (bot wall) | **8** | Neither | Different route — but see below: NTA is already covered |
| Unreachable (DNS, TLS, timeout) | **3** | Mostly ours | Fix the URL or accept the failure |
| Fetching normally | **11** | — | These are what Phase 1 parses |

### The bot wall — 8 sources

`www.cbse.gov.in`, `jeemain.nta.nic.in`, `neet.nta.nic.in`, `ugcnet.nta.nic.in`,
`www.upsc.gov.in`, `cisce.org` sit behind an edge WAF (Akamai, mostly) that
answers **403 to any non-browser client** — including on `/robots.txt` itself,
which is why the misclassification happened. The same URLs open normally in a
browser.

**Measured, not assumed:** the User-Agent string makes no difference. Both the
current UA and the conventional `Mozilla/5.0 (compatible; Bot/1.0; +url)` form
that Googlebot and Bingbot use were tested against every walled host. All 403.
The block keys on client fingerprint — TLS handshake, header ordering, the
absence of browser headers — not on what we call ourselves.

**We are not going to defeat it.** Spoofing a browser's TLS fingerprint is
deliberate evasion of an access control, and it also destroys the one property
that makes our crawler defensible: a UA naming the site and a route to contact
us. Principle 2 says trust matters more than traffic, and that has to hold when
it is inconvenient.

So these eight sources need a **different route**, not a cleverer crawler:

- an official RSS or JSON feed where one exists (unchecked — worth an hour)
- the notification PDFs directly, which are often on a different, unwalled host
- a mirror authority: NTA's own `nta.ac.in` notice board **does** fetch cleanly
  and carries JEE and NEET notices, so the exam-specific subdomains may be
  redundant rather than essential
- manual editorial entry with provenance, for the handful that matter most

**The third option was tested, and it works.** `nta.ac.in` and
`nta.ac.in/NoticeBoardArchive` both fetch cleanly, and between them they carry
the notices the walled subdomains were wanted for:

| Term | `nta.ac.in` | `/NoticeBoardArchive` |
| --- | ---: | ---: |
| JEE | 71 | 179 |
| NEET | 56 | 126 |
| CUET | 119 | 224 |
| UGC NET | 36 | 125 |
| admit card | 94 | 218 |
| answer key | 147 | 341 |
| result | 111 | 229 |

(Occurrences in the tag-stripped body, both pages HTTP 200.) Content is mixed
English and Devanagari, which the search schema's Devanagari branch already
anticipates.

So for the NTA family — JEE Main, NEET, CUET, UGC NET, four of the highest-value
exams on the site — **the bot wall is not blocking**. The route was already on
the watch list. That leaves CBSE, CISCE and UPSC as the genuinely walled
authorities needing a different answer.

### Unreachable — 3 sources

| Source | Reason | Ours to fix? |
| --- | --- | --- |
| `cuet.nta.nic.in` | Connect timeout (IPv6) | Intermittent — fetched fine on cycle 1 |
| `cbseresults.nic.in` | HTTP 500 on `/robots.txt` | Theirs. Retry; the host itself is live |
| `www.ibps.in` | Incomplete TLS chain — server does not send its intermediate | Theirs. Do **not** work around by disabling verification |

### URLs that were simply wrong — 4, now corrected

Three seed URLs were broken in ways the old classifier hid, because every one of
them surfaced as "blocked by robots.txt":

| Was | Problem | Now |
| --- | --- | --- |
| `results.cbse.nic.in` | NXDOMAIN — does not resolve at all | `cbseresults.nic.in` |
| `www.rrbchennai.gov.in` | Cert altnames list the apex but not `www` | `rrbchennai.gov.in` — now fetching |
| `upsc.gov.in/whats-new` | Apex 307s to `www` **and drops the path** | `www.upsc.gov.in/whats-new` |
| `upsc.gov.in/examinations/...` | Same | `www.upsc.gov.in/examinations/...` |

Correcting a URL creates a new `Source` row, so the seeder now retires anything
no longer in `SOURCE_SEEDS` (status `DEAD`, history kept) instead of leaving the
broken row beside its own replacement, still being polled.

## What this changes for Phase 1

The plan assumed fact extraction would parse the official exam pages. **For the
four highest-value exams it cannot**, because we cannot fetch them at all — and
no amount of parser quality fixes an acquisition problem.

Before any extractor is written:

1. ~~Test whether `nta.ac.in` covers JEE and NEET.~~ **Done — it does.** The
   NTA family is served by a source we can already fetch. Parse that first; it
   is the highest value per unit of work on the list.
2. Find a route for CBSE, CISCE and UPSC — official feeds, or the PDF hosts,
   which are frequently on separate and unwalled infrastructure.
3. Decide, explicitly, which sources will be **editorially entered** rather than
   crawled — and make sure provenance treats a human-entered fact as a
   first-class citizen rather than a special case.

Point 3 is the one that changes the data model. It was not in the plan.

## A second thing the measurement caught

The NTA notice archive is **2.2 MB**, and `MAX_STORED_BYTES` was 512 kB — so we
were storing 23% of it and setting `rawTruncated`, which by the schema's own
rule means the body must never be parsed as though it were complete.

The source that just turned out to be the only viable route to four flagship
exams was therefore unusable by Phase 1, and nothing in the pipeline would have
said so: the fetch was recorded as a success.

Two fixes, both in `fetch-sources.task.ts`:

- the cap is now 4 MB (bodies are stored only on a change, and HTML TOASTs well)
- truncation is now applied by **UTF-8 byte length**, not `String.slice`, which
  counts UTF-16 code units. A cap named in bytes and applied with `slice` stored
  up to three times its budget for Devanagari — the script half these notices
  are published in.

## What is still unknown

Two cycles is not a month. Change rates here are meaningless so far — nine
sources show "100%" purely because the first fetch of anything counts as a
change. Cadence tuning needs weeks of data, and nothing above should be read as
a cadence recommendation yet.

What two cycles **were** enough to establish is which sources can be fetched at
all. That question did not need a month, and it is the one that changes the plan.
