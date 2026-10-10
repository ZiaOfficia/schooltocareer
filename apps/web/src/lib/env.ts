/**
 * The web app's one reader of process.env (lint RULE 4: everything else reads
 * configuration from here).
 *
 * Each variable is read as a literal `process.env.NAME`. That is not style:
 * Next.js inlines NEXT_PUBLIC_* values into the client bundle only when the
 * access is written out in full, so a loop or a destructure would silently
 * ship `undefined` to the browser.
 *
 * Values are read when the function is called, not when the module loads, so
 * a server route picks up the deployment's runtime environment.
 */

/** What decides whether this deployment is the indexable production site. */
export function deploymentEnv(): { NODE_ENV: string; NEXT_PUBLIC_SITE_URL: string | undefined } {
  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
}

/** The AdSense publisher id, when one is configured for this deployment. */
export function adsenseClientEnv(): string | undefined {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
}

/** Server-only values. Never import into a client component. */
export function serverEnv(): { API_BASE_URL: string | undefined; REVALIDATE_SECRET: string | undefined } {
  return {
    API_BASE_URL: process.env.API_BASE_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
  };
}
