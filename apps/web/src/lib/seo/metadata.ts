import type { Metadata } from 'next';

import {
  META_TEMPLATES,
  NOINDEX_PATHS,
  SEO_LIMITS,
  SITE,
  TITLE_TEMPLATE,
  absoluteUrl,
  fillTemplate,
  type MetaTemplateKey,
} from '@stc/constants';
import { isIndexableDeployment } from '@stc/config';

/**
 * EVERY page title, description and canonical in the product is produced here.
 *
 * Three things this centralisation buys, all of which are painful to retrofit:
 *
 * 1. One canonical origin. Absolute URLs derive from SITE.ORIGIN, never from
 *    the host serving the request — so a Vercel preview cannot self-canonicalise
 *    and start competing with production for its own keywords.
 * 2. One indexability decision. Previews and development emit `noindex`
 *    unconditionally, and /search is noindex,follow so its links are still
 *    crawled while the thin result page itself stays out of the index.
 * 3. Enforced limits. A description over 160 characters is silently truncated
 *    by Google mid-sentence; a title over 60 gets rewritten. Both cost
 *    click-through, and neither shows up in any test.
 */

type BuildInput = {
  /** Which META_TEMPLATES entry to fill. */
  template: MetaTemplateKey;
  /** Values for the `{placeholder}` tokens. */
  values: Record<string, string | number>;
  /** Site-relative path. Becomes the canonical. */
  path: string;
  /** Overrides the templated title entirely. Use sparingly. */
  title?: string;
  description?: string;
  image?: { url: string; alt: string } | null;
  /** ISO strings for article-type pages. */
  publishedTime?: string | null;
  modifiedTime?: string | null;
  /** Force noindex for a page that is otherwise indexable (e.g. a thin variant). */
  noindex?: boolean;
};

/**
 * Truncates on a word boundary rather than mid-word.
 *
 * Google truncating a description is not fatal; a description that ends
 * "...download the JEE Main 2026 sylla" reads as broken and costs the click.
 */
export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** A path is non-indexable if it sits under any NOINDEX_PATHS prefix. */
export function isNoindexPath(path: string): boolean {
  return NOINDEX_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function buildMetadata(input: BuildInput): Metadata {
  const tpl = META_TEMPLATES[input.template];

  const rawTitle = input.title ?? fillTemplate(tpl.title, input.values);
  const rawDescription = input.description ?? fillTemplate(tpl.description, input.values);

  // The root layout applies TITLE_TEMPLATE.DEFAULT ("%s | SchoolToCareer"), so
  // the string clamped here is NOT what appears in the SERP — the suffix is
  // added afterwards. Clamping to TITLE_MAX produced 78-character titles.
  // Reserve the suffix so the rendered total lands inside the limit.
  const suffixLength = TITLE_TEMPLATE.DEFAULT.replace('%s', '').length;
  const title = clamp(rawTitle, Math.max(20, SEO_LIMITS.TITLE_MAX - suffixLength));
  const description = clamp(rawDescription, SEO_LIMITS.DESCRIPTION_MAX);

  const canonical = absoluteUrl(input.path);

  // Indexable only when this is the real production deployment AND the path is
  // one we want in the index AND the page has not opted out.
  const indexable =
    isIndexableDeployment({
      NODE_ENV: process.env.NODE_ENV ?? 'development',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    }) &&
    !isNoindexPath(input.path) &&
    !input.noindex;

  const image = input.image
    ? [{ url: input.image.url, alt: input.image.alt, width: 1200, height: 630 }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      // `follow` stays true even when noindex: we still want the links on a
      // search results page crawled, because the destinations are the pages
      // worth indexing.
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: input.publishedTime ? 'article' : 'website',
      siteName: SITE.NAME,
      locale: SITE.DEFAULT_LOCALE,
      url: canonical,
      title: clamp(rawTitle, SEO_LIMITS.OG_TITLE_MAX),
      description: clamp(rawDescription, SEO_LIMITS.OG_DESCRIPTION_MAX),
      ...(image ? { images: image } : {}),
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE.TWITTER_HANDLE,
      title: clamp(rawTitle, SEO_LIMITS.OG_TITLE_MAX),
      description: clamp(rawDescription, SEO_LIMITS.DESCRIPTION_MAX),
      ...(image ? { images: image.map((i) => i.url) } : {}),
    },
  };
}

/**
 * Google Search Console verification.
 *
 * NOT a secret — it is emitted in the HTML of every page, which is how Google
 * reads it. It proves control of the property; it grants nothing. Safe to
 * commit, and it must stay committed: removing the tag un-verifies the
 * property and Search Console stops reporting.
 *
 * The value Search Console shows as `google-site-verification=TOKEN` is the
 * DNS TXT form. The meta tag takes the TOKEN alone.
 */
const GOOGLE_SITE_VERIFICATION = 'SkeZiHCIrXkGqq3Zuyky7ozuP3p0VBY-Li4NM9QVrjE';

/** Root metadata. The title template applies to every child route. */
export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE.ORIGIN),
  title: { default: TITLE_TEMPLATE.HOME, template: TITLE_TEMPLATE.DEFAULT },
  description: SITE.TAGLINE,
  applicationName: SITE.NAME,
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: { telephone: false, address: false, email: false },
  verification: { google: GOOGLE_SITE_VERIFICATION },
  // `.in` is a ccTLD, so India geo-targeting is implicit and cannot be
  // overridden in Search Console. Stated here so nobody adds a conflicting
  // hreflang later expecting it to help.
  other: { 'geo.region': SITE.COUNTRY },
};
