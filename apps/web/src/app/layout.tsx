import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { JsonLd, organizationSchema, websiteSchema } from '@/lib/seo/json-ld';
import { rootMetadata } from '@/lib/seo/metadata';

import './globals.css';

export const metadata = rootMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body>
        {/* Keyboard users reach content without tabbing the whole nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:border-2 focus:border-rule-hard focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>

        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />

        {/* Site-wide graph, emitted once. Page-level schema references these
            nodes by @id rather than repeating the publisher on every page. */}
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
      </body>
    </html>
  );
}
