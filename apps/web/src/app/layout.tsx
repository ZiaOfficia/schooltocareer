import { Plus_Jakarta_Sans, Sora } from 'next/font/google';
import type { ReactNode } from 'react';

import { AdSense } from '@/components/adsense';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { JsonLd, organizationSchema, websiteSchema } from '@/lib/seo/json-ld';
import { rootMetadata } from '@/lib/seo/metadata';

import './globals.css';

export const metadata = rootMetadata;

// next/font downloads these at build time and serves them from our own origin:
// no request to Google at runtime, and `swap` paints text in the fallback
// first, so a slow connection is never left looking at a blank heading.
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});
const display = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sora',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <body>
        {/* Keyboard users reach content without tabbing the whole nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:border focus:border-rule-hard focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>

        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />

        {/* Site-wide graph, emitted once. Page-level schema references these
            nodes by @id rather than repeating the publisher on every page. */}
        <JsonLd data={[organizationSchema(), websiteSchema()]} />

        {/* Renders nothing off production — see the component. */}
        <AdSense />
      </body>
    </html>
  );
}
