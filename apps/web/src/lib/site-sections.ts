/**
 * WHAT THE SITE HAS TODAY — the switch the navigation reads.
 *
 * The header, the footer, the home page and the sitemap all used to link to
 * Results and Articles, and every page carried a search box. Results and
 * Articles were empty lists and /search was a 404, so the three most-linked
 * things on the site led nowhere. That is what a reviewer — or a student —
 * meets first, and "low value content" is a fair name for it.
 *
 * A section is `false` here until it has something in it. Turning one on is a
 * one-word change, made on the commit that gives it content:
 *
 *   results  when at least one Result row is published
 *   blog     when at least one article is published
 *            (on: the articles in lib/articles)
 *   search   when /search exists AND the search index is being filled
 *            (it is not: no outbox worker runs, so the index is empty)
 *   practice when at least one paper's questions are published
 *            (on: JEE Main 8 Apr 2026 Shift 2, 75 questions)
 *   boards   when the per-board pages exist. /boards today lists 20 names
 *            that link nowhere and says "not built yet" — exactly the
 *            unfinished-site signal an AdSense reviewer reports as
 *            "low value content".
 *
 * The pages themselves stay reachable by URL and say plainly that they are
 * empty; they are simply not advertised, and are marked noindex.
 */
export const LIVE = {
  results: false,
  blog: true,
  search: false,
  practice: true,
  boards: false,
} as const;
