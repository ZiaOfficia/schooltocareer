import { SITE } from '@stc/constants';
import type { Locale } from '@stc/types';

/** Runtime site configuration. Values that vary per environment come from env. */
export type SiteConfig = {
  key: string;
  name: string;
  shortName: string;
  tagline: string;
  /** Where this deployment is served. Differs per environment. */
  url: string;
  /** What absolute URLs are built from. Always the apex in production. */
  canonicalOrigin: string;
  defaultLocale: Locale;
  locales: readonly Locale[];
  twitterHandle: string;
  organization: {
    name: string;
    logoPath: string;
    sameAs: readonly string[];
  };
};

/**
 * Builds the runtime site config.
 *
 * `url` is where the app is SERVED — localhost in development, a
 * `*.vercel.app` host on a preview deploy. `canonicalOrigin` is what every
 * absolute URL is built from, and in production it is always the apex domain.
 *
 * Keeping them separate is what stops a preview deployment emitting canonicals
 * that point at itself. A preview that self-canonicalises can get indexed and
 * compete with production for its own keywords.
 */
export function buildSiteConfig(input: {
  url: string;
  name?: string;
  /** Overridden only in tests. Production and preview both canonicalise to the apex. */
  canonicalOrigin?: string;
}): SiteConfig {
  return {
    key: 'schooltocareer',
    name: input.name ?? SITE.NAME,
    shortName: SITE.SHORT_NAME,
    tagline: SITE.TAGLINE,
    url: input.url.replace(/\/$/, ''),
    canonicalOrigin: (input.canonicalOrigin ?? SITE.ORIGIN).replace(/\/$/, ''),
    defaultLocale: 'EN',
    locales: ['EN'],
    twitterHandle: SITE.TWITTER_HANDLE,
    organization: {
      name: input.name ?? SITE.NAME,
      logoPath: '/images/logo.png',
      sameAs: [],
    },
  };
}

/**
 * Whether this deployment may be indexed.
 *
 * Preview and development builds must emit `noindex` regardless of anything
 * else — an indexed preview is duplicate content pointing at a host that will
 * disappear.
 */
export function isIndexableDeployment(env: {
  NODE_ENV: string;
  NEXT_PUBLIC_SITE_URL?: string | undefined;
}): boolean {
  return env.NODE_ENV === 'production' && env.NEXT_PUBLIC_SITE_URL === SITE.ORIGIN;
}
