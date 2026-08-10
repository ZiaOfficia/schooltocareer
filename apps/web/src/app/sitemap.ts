import type { MetadataRoute } from 'next';

import { ROUTES, absoluteUrl } from '@stc/constants';
import type { ExamListItemDto } from '@stc/types';

import { listExams } from '@/lib/api';
import { EXAM_SECTIONS } from '@/lib/exam-sections';

/**
 * ONE sitemap, served at /sitemap.xml.
 *
 * WHY NOT SHARDED. The previous version used `generateSitemaps()`, which emits
 * /sitemap/0.xml, /sitemap/1.xml … and — critically — does NOT generate an
 * index at /sitemap.xml. So robots.txt advertised a URL that 404'd, and the
 * only working sitemap was one nothing linked to.
 *
 * It also carried a silent bug. Next passes the shard `id` as a STRING from
 * the route segment, but the handler was typed `{ id: number }` and gated the
 * static routes behind `id === 0`. `"0" === 0` is false, so every static route
 * was skipped on every shard — the live sitemap contained exactly 160 exam
 * URLs and nothing else. TypeScript could not catch it because the type
 * annotation on a framework-supplied parameter is an assertion, not a check.
 *
 * A single file is correct until 50,000 URLs (the protocol limit). Current
 * live count is ~180; the launch projection is ~60,000, so sharding WILL be
 * needed. When it is, the fix is a hand-written `app/sitemap.xml/route.ts`
 * emitting a <sitemapindex> plus these shards — not `generateSitemaps` alone,
 * which is what created this problem.
 *
 * Two deliberate omissions: `priority` and `changefreq`. Google has said for
 * years that it ignores both. `lastModified` comes from the row's updatedAt,
 * so it cannot be inflated.
 */

export const revalidate = 3600;

/** 50,000 is the protocol limit. Warn well before it, not at it. */
const SHARD_THRESHOLD = 45_000;

/**
 * Only routes that actually RESOLVE. A sitemap listing a 404 is worse than
 * omitting it: it spends crawl budget and reports as an error in Search
 * Console. Legal pages are absent because they are not built yet — add them
 * here on the same commit that adds the page, never before.
 */
const STATIC_ROUTES = [
  ROUTES.home(),
  ROUTES.exams(),
  ROUTES.boards(),
  ROUTES.papers(),
  ROUTES.results(),
  ROUTES.blog(),
] as const;

/**
 * Cluster pages come from EXAM_SECTIONS — the SAME registry the route uses to
 * decide what renders.
 *
 * This previously listed all seven cluster routes from ROUTES, including
 * syllabus, exam-pattern and eligibility, none of which had a page. That put
 * 140 URLs in the sitemap that returned 404. ROUTES describes the whole
 * intended URL space including pages not yet built, so it is the wrong source
 * of truth for "what can be crawled today".
 *
 * Reading the registry means the two cannot drift: a section appears here only
 * once it renders, and adding one is a single edit in exam-sections.ts.
 */
const EXAM_CLUSTER = Object.values(EXAM_SECTIONS).map((section) => section.path);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
  }));

  // Deliberately NOT wrapped in try/catch. The tempting fallback — return the
  // static routes when the API is down — submits a six-URL sitemap for a site
  // with thousands, which reads to Google as mass removal. Throwing returns a
  // 5xx, which the crawler treats as temporary and retries.
  const exams = await listExams<ExamListItemDto>('limit=1000');

  for (const exam of exams) {
    const lastModified = new Date(exam.updatedAt);
    entries.push({ url: absoluteUrl(exam.path), lastModified });
    for (const route of EXAM_CLUSTER) {
      entries.push({ url: absoluteUrl(route(exam.slug)), lastModified });
    }
  }

  if (entries.length > SHARD_THRESHOLD) {
    console.warn(
      `[sitemap] ${entries.length} URLs — approaching the 50,000 limit. ` +
        'Split into shards plus a hand-written /sitemap.xml index before this grows further.',
    );
  }

  return entries;
}
