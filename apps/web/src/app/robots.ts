import type { MetadataRoute } from 'next';

import { NOINDEX_PATHS, SITE, absoluteUrl } from '@stc/constants';
import { isIndexableDeployment } from '@stc/config';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const indexable = isIndexableDeployment({
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  // A preview deployment must disallow everything. An indexed preview is
  // duplicate content pointing at a host that will disappear, and it competes
  // with production for the same keywords while it lasts.
  if (!indexable) {
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
