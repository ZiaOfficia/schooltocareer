import Script from 'next/script';

import { isIndexableDeployment } from '@stc/config';
import { ADSENSE } from '@stc/constants';

/**
 * The AdSense loader, emitted once from the root layout.
 *
 * GATED ON THE DEPLOYMENT, not just on the client id being present. A preview
 * build serves the same pages on a `*.vercel.app` host, and running ads on a
 * host that is not the approved property — while `robots.ts` is simultaneously
 * telling crawlers `Disallow: /` there — is the kind of thing that gets an
 * AdSense account restricted rather than a page unranked. Same predicate the
 * robots and canonical logic already use, so the three cannot disagree about
 * what "production" means.
 *
 * `afterInteractive` rather than `beforeInteractive`: the tag is not needed to
 * render anything, and blocking first paint on an ad script is the fastest way
 * to lose the LCP budget this site is built around.
 */
export function AdSense() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? ADSENSE.CLIENT;

  const indexable = isIndexableDeployment({
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!indexable || !client) return null;

  return (
    <Script
      id="adsbygoogle-init"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}
