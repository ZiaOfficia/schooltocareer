import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

/**
 * `promisify` resolves to scrypt's THREE-argument overload and silently drops
 * the options parameter from the type, so passing `{ N, r, p, maxmem }` is a
 * compile error even though the runtime accepts it. Naming the signature here
 * is the narrowest fix; the alternative is an `as any` at both call sites.
 */
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing, on `node:crypto` scrypt.
 *
 * WHY NOT argon2 OR bcrypt. Both are native modules. This repository has no
 * native dependency today, builds on Windows and Linux from the same lockfile,
 * and deploys to a container that would have to compile them. scrypt is memory-
 * hard, in the standard library, and named in the OWASP password storage cheat
 * sheet as an acceptable choice when argon2id is unavailable. Adding a compiler
 * to the deploy for one login endpoint is not a trade worth making — and the
 * stored format below means switching later does not invalidate anything.
 *
 * STORED FORMAT — self-describing on purpose:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64>$<derived key base64>
 *
 * The parameters travel with the hash, so raising the cost later is a change to
 * `PARAMS` alone: existing hashes keep verifying against the parameters they
 * were created with, and re-hash on next login if that is ever added. A bare
 * `<salt>$<hash>` would have pinned the cost forever.
 */

/**
 * N = 2^15 (32 MiB with r=8). Roughly 100 ms on the deploy target.
 *
 * `maxmem` must be set explicitly: Node defaults to 32 MiB and this
 * configuration needs 32 MiB plus overhead, so the default fails with
 * "memory limit exceeded" — a failure that would only appear once a real
 * password was set, which is exactly the wrong time to discover it.
 */
const PARAMS = { N: 32_768, r: 8, p: 1 } as const;
const MAXMEM = 96 * 1024 * 1024;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAXMEM,
  })) as Buffer;

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Verifies a candidate against a stored hash.
 *
 * Returns false rather than throwing on a malformed or placeholder hash. The
 * seeded admin row carries `SEED_PLACEHOLDER_NOT_A_VALID_HASH` precisely so
 * nobody can sign in as it; that string must fail verification quietly, not
 * crash the login endpoint and turn an unusable account into a 500.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts as [string, string, string, string, string, string];
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(rawHash, 'base64');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  try {
    const derived = (await scrypt(
      password.normalize('NFKC'),
      Buffer.from(rawSalt, 'base64'),
      expected.length,
      { N, r, p, maxmem: MAXMEM },
    )) as Buffer;

    // Length is equal by construction above, so timingSafeEqual cannot throw.
    return timingSafeEqual(derived, expected);
  } catch {
    // Absurd stored parameters (a hand-edited row) must not 500 the endpoint.
    return false;
  }
}

/**
 * A hash that nothing can match, used to spend the same time on a missing user
 * as on a real one.
 *
 * Without this, "no such email" returns in ~1 ms and a wrong password takes
 * ~100 ms, which turns the login endpoint into a user enumeration oracle
 * regardless of how carefully the error message is worded.
 */
export const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
