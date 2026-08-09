#!/usr/bin/env node
/**
 * Generates the production secrets, in the shape you paste into a dashboard.
 *
 *   node tooling/scripts/gen-secrets.mjs
 *
 * Run it in YOUR terminal. Not through a chat tool, not in CI logs, not
 * anywhere that keeps a transcript — the whole point is that the value exists
 * in exactly two places: your clipboard and the host's secret store.
 *
 * Lengths come from the zod schema in packages/config/src/env.ts. Where the
 * schema sets a minimum, this generates comfortably above it: the minimum is
 * the point at which boot fails, not the point at which the value is strong.
 */
import { randomBytes } from 'node:crypto';

/** base64url so the value is safe in a URL, a header and a shell without quoting. */
const gen = (bytes) => randomBytes(bytes).toString('base64url');

const secrets = [
  {
    key: 'JWT_ACCESS_SECRET',
    value: gen(48),
    note: 'min 32. MUST differ from the refresh secret.',
  },
  {
    key: 'JWT_REFRESH_SECRET',
    value: gen(48),
    note: 'min 32. If equal to the access secret, a refresh token verifies as an access token.',
  },
  {
    key: 'IP_HASH_SALT',
    value: gen(24),
    note: 'min 16. Rotating it resets rate-limit buckets and breaks download de-duplication.',
  },
  {
    key: 'REVALIDATE_SECRET',
    value: gen(32),
    note: 'min 24. Set the SAME value on Render (API) and Vercel (web) or revalidation 401s.',
  },
];

console.log('\nProduction secrets — paste into the host, then close this terminal.\n');

for (const { key, value, note } of secrets) {
  console.log(`${key}=${value}`);
  console.log(`  # ${note}\n`);
}

const [access, refresh] = secrets;
if (access.value === refresh.value) {
  console.error('IMPOSSIBLE COLLISION — regenerate. Do not use these.');
  process.exit(1);
}

console.log('Where each one goes:');
console.log('  Render  (stc-api)     all four');
console.log('  Render  (stc-worker)  REVALIDATE_SECRET only');
console.log('  Vercel  (web)         REVALIDATE_SECRET only — identical to the API\n');
