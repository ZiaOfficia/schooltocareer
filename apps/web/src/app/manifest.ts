import type { MetadataRoute } from 'next';

import { SITE } from '@stc/constants';

/**
 * Web app manifest — what Android uses for "Add to Home screen".
 *
 * The favicon, SVG icon and Apple touch icon are NOT listed here: Next picks
 * those up from `favicon.ico`, `icon.svg` and `apple-icon.png` beside this
 * file and emits the <link> tags itself.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.NAME,
    short_name: SITE.NAME,
    description: SITE.TAGLINE,
    start_url: '/',
    display: 'standalone',
    theme_color: '#12355B',
    background_color: '#F6F4EF',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      // The mark sits well inside the safe zone on a full-bleed navy square,
      // so the same file serves as the maskable icon.
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
