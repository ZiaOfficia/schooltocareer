import { SITE, absoluteUrl } from '@stc/constants';

/**
 * Structured data.
 *
 * A note on realism, because structured data attracts cargo-culting: of the
 * types below, only BreadcrumbList reliably produces a visible SERP change for
 * a site like this. FAQPage rich results were restricted to authoritative
 * government and health sites in 2023 and will not render for us. It is still
 * worth emitting — it describes the page accurately for any consumer, and
 * costs nothing — but it is not a traffic lever, and shipping fake FAQs to
 * chase one is how sites earn manual actions.
 */

type Json = Record<string, unknown>;

/**
 * `<` is escaped so a title containing `</script>` cannot break out of the tag.
 * The data is ours, but it originates in a database an editor can write to,
 * which makes it untrusted input by the only definition that matters.
 */
function serialise(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- escaped above; the only way to emit ld+json
      dangerouslySetInnerHTML={{ __html: serialise(data) }}
    />
  );
}

/** Stable @id values so the graph nodes can reference each other. */
const ORG_ID = `${SITE.ORIGIN}/#organization`;
const SITE_ID = `${SITE.ORIGIN}/#website`;

export function organizationSchema(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.NAME,
    url: SITE.ORIGIN,
    logo: absoluteUrl('/images/logo.png'),
    description: SITE.TAGLINE,
    areaServed: { '@type': 'Country', name: 'India' },
  };
}

export function websiteSchema(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE.ORIGIN,
    name: SITE.NAME,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-IN',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.ORIGIN}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * The one type here that earns its place in the SERP.
 *
 * Fed from the same trail the visible breadcrumb renders, so the two cannot
 * disagree — a structured-data breadcrumb that contradicts the visible one is
 * a spam signal, not a bonus.
 */
export function breadcrumbSchema(trail: ReadonlyArray<{ name: string; path: string }>): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(items: ReadonlyArray<{ question: string; answer: string }>): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function articleSchema(input: {
  headline: string;
  description: string;
  path: string;
  publishedTime: string;
  modifiedTime: string;
  authorName?: string | null;
  imageUrl?: string | null;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.path) },
    datePublished: input.publishedTime,
    dateModified: input.modifiedTime,
    publisher: { '@id': ORG_ID },
    ...(input.authorName ? { author: { '@type': 'Person', name: input.authorName } } : {}),
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    inLanguage: 'en-IN',
  };
}

/**
 * A page whose subject is a named exam.
 *
 * Deliberately WebPage + `about`, not Event or Course. An exam sitting is
 * arguably an Event, but Event rich results are built for things you buy a
 * ticket to, and marking up 100 exam sittings that way invites a structured
 * data manual action. This describes the page truthfully and claims nothing.
 */
export function examPageSchema(input: {
  name: string;
  description: string;
  path: string;
  modifiedTime: string;
  conductingBody: string;
  officialWebsite?: string | null;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    dateModified: input.modifiedTime,
    isPartOf: { '@id': SITE_ID },
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-IN',
    about: {
      '@type': 'Thing',
      name: input.name,
      ...(input.officialWebsite ? { sameAs: input.officialWebsite } : {}),
      subjectOf: { '@type': 'Organization', name: input.conductingBody },
    },
  };
}
