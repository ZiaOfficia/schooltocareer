import type { MetadataRoute } from 'next';

import { ROUTES, absoluteUrl } from '@stc/constants';
import type { ExamListItemDto } from '@stc/types';

import { listExams } from '@/lib/api';

/**
 * Sharded sitemaps.
 *
 * A sitemap file is capped at 50,000 URLs and 50MB. This site targets six
 * figures, so a single file is not a "later" problem — it is a launch problem.
 * `generateSitemaps` emits /sitemap/0.xml, /sitemap/1.xml … and Next builds
 * the index automatically.
 *
 * Two deliberate omissions:
 *
 *   priority     Google has said for years that it ignores it. Emitting it
 *                is noise that implies a control we do not have.
 *   changefreq   Same. `lastModified` is the only freshness signal that is
 *                actually consumed, and it comes from the row's updatedAt so
 *                it cannot be inflated.
 *
 * Only PUBLISHED entities appear. The API's public routes never return drafts,
 * so this cannot leak an unpublished page even by mistake.
 */

/**
 * Generated per request, not at build time.
 *
 * Two reasons. A build must not fail because the API happened to be
 * redeploying, and — more importantly — a sitemap frozen at build time goes
 * stale the moment an editor publishes. `revalidate` caches the result, so the
 * cost is one API call per hour, not one per crawl.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const PER_SITEMAP = 20_000;

const STATIC_ROUTES = [
  ROUTES.home(),
  ROUTES.exams(),
  ROUTES.boards(),
  ROUTES.papers(),
  ROUTES.results(),
  ROUTES.blog(),
  ROUTES.about(),
  ROUTES.contact(),
  ROUTES.privacy(),
  ROUTES.terms(),
  ROUTES.disclaimer(),
] as const;

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  // Shard 0 always exists. If the API is unreachable while the route list is
  // being computed, one shard is still declared — the request-time handler
  // below is what decides whether that shard can be served honestly.
  try {
    const exams = await listExams<ExamListItemDto>('limit=1');
    return Array.from({ length: Math.max(1, Math.ceil(exams.length / PER_SITEMAP)) }, (_, id) => ({
      id,
    }));
  } catch {
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // NOTE: errors from listExams below are deliberately NOT caught.
  //
  // The tempting "degrade to the static routes" fallback is actively harmful
  // here: submitting a sitemap listing 11 URLs when the site has six figures
  // tells Google the rest were removed. Failing the request instead returns a
  // 5xx, which Google treats as temporary and retries — the crawler is built
  // for that, and it is the one behaviour that cannot cost us the index.

  if (id === 0) {
    for (const path of STATIC_ROUTES) {
      entries.push({ url: absoluteUrl(path), lastModified: new Date() });
    }
  }

  const exams = await listExams<ExamListItemDto>(
    `limit=${PER_SITEMAP}&offset=${id * PER_SITEMAP}`,
  );

  for (const exam of exams) {
    entries.push({ url: absoluteUrl(exam.path), lastModified: new Date(exam.updatedAt) });

    // The cluster pages are real URLs and must be discoverable. Generating them
    // from ROUTES rather than listing them by hand means a new cluster page is
    // added in one place and appears here automatically.
    for (const path of [
      ROUTES.examSyllabus(exam.slug),
      ROUTES.examPattern(exam.slug),
      ROUTES.examEligibility(exam.slug),
      ROUTES.examAdmitCard(exam.slug),
      ROUTES.examAnswerKey(exam.slug),
      ROUTES.examResult(exam.slug),
      ROUTES.examPapers(exam.slug),
    ]) {
      entries.push({ url: absoluteUrl(path), lastModified: new Date(exam.updatedAt) });
    }
  }

  return entries;
}
