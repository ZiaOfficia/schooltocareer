/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The workspace packages ship TypeScript source, not built JS.
  transpilePackages: ['@stc/ui', '@stc/constants', '@stc/config', '@stc/types', '@stc/utils'],

  // Cloudinary is the only remote image host. Listing it explicitly means an
  // attacker cannot use our optimiser as an open proxy for arbitrary URLs.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' }],
    formats: ['image/avif', 'image/webp'],
  },

  // `www` -> apex is handled at the DNS/host layer; this covers the app layer
  // so a direct hit on a preview or a misconfigured host still collapses to one
  // canonical shape. Trailing slashes are a duplicate-content source.
  trailingSlash: false,

  poweredByHeader: false,

  /**
   * The workspace packages are TypeScript source compiled under NodeNext, so
   * their relative imports carry `.js` extensions that point at files which
   * only exist as `.ts`. Node and tsc both understand that; webpack does not,
   * and fails with "Can't resolve './roles.js'".
   *
   * Mapping the extension here is what lets apps/web consume the packages
   * as source rather than forcing every one of them to emit a build first.
   *
   * THIS IS ALSO WHY `dev` DOES NOT USE TURBOPACK. Turbopack ignores this
   * config and has no equivalent for extension aliasing, so `--turbopack`
   * resolved `./site.js` to nothing and reported "@stc/config has no exports"
   * — while `next build` compiled the same code fine. A dev server and a
   * production build that disagree about module resolution is a worse problem
   * than a slower dev server.
   */
  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
