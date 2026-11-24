# The website is static

Since 25 Nov 2026 the website (apps/web) does not call the API at runtime.
Every page is built at deploy time on Vercel from the **content snapshot** in
`apps/web/src/data/snapshot/*.json`, a copy of everything the API publishes:
exams, papers, digitised questions, chapters and mock tests.

Why: the API runs on a free Render instance that sleeps when idle. A sleeping
API made the first page view (or the first Googlebot visit) slow or failing.
Now no visitor and no crawler ever waits on it.

## Publishing a change to API data

Anything changed through the API or the database (a new paper, an exam-hub
edit with `pnpm exams:hubs`, an approved fact) only reaches the site after a
new snapshot:

```
STC_API_URL=https://schooltocareer.onrender.com pnpm content:snapshot
git add apps/web/src/data/snapshot
git commit -m "content: refresh snapshot"
git push
```

On Windows PowerShell:

```
$env:STC_API_URL="https://schooltocareer.onrender.com"; pnpm content:snapshot
```

The script waits for a sleeping API to wake, stays under its rate limit, and
rebuilds every question preview with the current maths-to-text code.

Content that lives in the repo already (board guides, articles, exam pattern
and syllabus pages) is unaffected: edit the files and push as before.

## What still needs the API

Only the snapshot script and the admin tools (`exams:hubs`, fact review).
The Render service can stay suspended between content updates.
