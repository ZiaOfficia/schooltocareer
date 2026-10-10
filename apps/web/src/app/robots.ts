import type { MetadataRoute } from 'next';

import { isIndexableDeployment } from '@stc/config';
import { NOINDEX_PATHS, SITE, absoluteUrl } from '@stc/constants';

import { deploymentEnv } from '@/lib/env';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const env = deploymentEnv();
  const indexable = isIndexableDeployment(env);

  // A preview deployment must disallow everything. An indexed preview is
  // duplicate content pointing at a host that will disappear, and it competes
  // with production for the same keywords while it lasts.
  if (!indexable) {
    // Loud, because the failure is silent otherwise. A production deployment
    // missing NEXT_PUBLIC_SITE_URL serves `Disallow: /` and looks completely
    // healthy — 200s everywhere, pages render, nothing errors — while being
    // invisible to every crawler. This line is the only warning you get.
    if (env.NODE_ENV === 'production') {
      console.warn(
        `[robots] EMITTING "Disallow: /" — the entire site is blocked from crawlers.\n` +
          `         NEXT_PUBLIC_SITE_URL is "${env.NEXT_PUBLIC_SITE_URL ?? '(unset)'}"\n` +
          `         and must be exactly "${SITE.ORIGIN}" for this deployment to be indexable.\n` +
          `         If this IS a preview deployment, that is correct — ignore.`,
      );
    }
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // These are crawlable-but-not-indexable at the page level (noindex,
        // follow). Disallowing them here as well would stop the crawler
        // reaching the links on them, which is the opposite of what we want —
        // so only genuinely private trees are blocked.
        disallow: NOINDEX_PATHS.filter((path) => path === '/admin' || path === '/api'),
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE.ORIGIN,
  };
}
