import { createHash, randomBytes } from 'node:crypto';

/** Hashing helpers. Node-only — never import these into a client bundle. */

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Salted IP hash for rate limiting and download de-duplication.
 * Raw IPs are personal data; a salted hash gives the same uniqueness signal
 * without storing one.
 */
export function hashIp(ip: string, salt: string): string {
  return sha256(`${salt}:${ip}`).slice(0, 32);
}

/** Detects no-op reindexes and stale translations (SearchDocument.sourceHash). */
export function contentHash(
  parts: readonly (string | number | boolean | null | undefined)[],
): string {
  return sha256(parts.map((p) => p ?? '').join('\u0000')).slice(0, 40);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return sha256(token);
}
