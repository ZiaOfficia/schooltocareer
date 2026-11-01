import type { ReactNode } from 'react';

import { ROUTES } from '@stc/constants';
import { LastUpdated, Section, TableOfContents, Wrap, contentsOf } from '@stc/ui';

import { PageHero } from '@/components/page-hero';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';

/** A bulleted list styled for the static pages' running text. */
export function Bullets({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="grid list-disc gap-2 pl-5 marker:text-ink-mute">
      {items.map((item, index) => (
        // Static, never reordered: the index is a stable key here.
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** An outbound link: new tab, no referrer leak, never passes ranking. */
export function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="underline" rel="nofollow noopener" target="_blank">
      {children}
    </a>
  );
}

export type StaticSection = {
  title: string;
  body: ReactNode;
};

/**
 * The one layout for the site's standing pages: about, contact, privacy
 * policy, terms and disclaimer.
 *
 * Written once so the five read as one publication, and so a change to how a
 * policy page looks is one edit (PRINCIPLES 5). Each page supplies only its
 * words; the hero, contents list, "updated" line and breadcrumb schema come
 * from here.
 *
 * `updated` is the date the text last changed in substance. It is shown to the
 * reader because a privacy policy without a date cannot be relied on.
 */
export function StaticPage({
  name,
  path,
  title,
  lede,
  updated,
  sections,
}: {
  /** Breadcrumb label. */
  name: string;
  path: string;
  title: string;
  lede: string;
  /** ISO date (YYYY-MM-DD) the text last changed in substance. */
  updated: string;
  sections: readonly StaticSection[];
}) {
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name, path },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />

      <PageHero trail={trail} title={title} lede={lede} meta={<LastUpdated iso={updated} />} />

      <Wrap>
        {sections.length > 3 ? (
          <TableOfContents
            className="mt-10"
            items={contentsOf(sections.map((section) => section.title))}
          />
        ) : null}

        {sections.map((section) => (
          <Section key={section.title} title={section.title}>
            <div className="grid max-w-[72ch] gap-4 text-[15.5px] leading-relaxed text-ink-soft">
              {section.body}
            </div>
          </Section>
        ))}
      </Wrap>
    </>
  );
}
