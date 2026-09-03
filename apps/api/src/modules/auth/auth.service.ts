import { SignJWT } from 'jose';

import { permissionsForRole } from '@stc/constants';
import type { AuthUser, UserRole } from '@stc/types';
import type { LoginInput } from '@stc/validation';

import { UnauthenticatedError } from '../../core/errors/app-error.js';
import type { AppLogger } from '../../core/logger.js';

import { DUMMY_HASH, verifyPassword } from './auth.password.js';
import type { AuthRepository } from './auth.repository.js';

/**
 * MINIMAL REVIEWER AUTHENTICATION.
 *
 * Exists for one reason: the fact-review API is the only path that may write
 * canonical exam data, it is correctly gated behind `authenticate()`, and
 * nothing in this codebase could issue a token — so no human could reach it.
 *
 * WHAT THIS DELIBERATELY IS NOT:
 *
 *   no public registration      staff accounts are created operationally
 *   no password reset           no mail transport exists to send one
 *   no refresh tokens           `Session` and `refreshSchema` exist and stay
 *                               unused; an access token is sufficient to reach
 *                               the review queue, and a session store is a
 *                               revocation design, not a login one
 *   no OAuth, no MFA, no admin UI
 *
 * Each of those is a real feature with real requirements. Shipping a hollow
 * version of any of them to look complete would be worse than their absence.
 *
 * The token it issues is verified by the EXISTING `authenticate()` middleware
 * and authorised by the EXISTING `can()`/`permissionsForRole` system. Nothing
 * about authorisation changes here.
 */

export type AuthRepositoryPort = Pick<AuthRepository, 'findForLogin' | 'recordLogin'>;

export type AuthServiceDeps = {
  repository: AuthRepositoryPort;
  /** Same secret `authenticate()` verifies with. */
  accessSecret: Uint8Array;
  /** e.g. "15m". Parsed by jose. */
  accessTtl: string;
  logger: AppLogger;
};

export type LoginResult = {
  accessToken: string;
  /** Seconds. The client refreshes by signing in again — see above. */
  expiresIn: number;
  user: AuthUser;
};

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  /**
   * Verifies credentials and issues an access token.
   *
   * ONE ERROR for every failure mode — unknown address, wrong password,
   * suspended, deleted, no password set. A response that distinguishes them
   * tells an attacker which addresses are real, and the endpoint is rate
   * limited precisely because that is worth knowing.
   *
   * The reason IS logged, because an operator debugging "I cannot sign in"
   * needs it and the log is not a public surface.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.deps.repository.findForLogin(email);

    // Spend the same time on a missing user as on a real one. Without this the
    // endpoint answers "no such email" in about a millisecond and "wrong
    // password" in about a hundred, which is a user-enumeration oracle no
    // amount of careful wording fixes.
    const stored = user?.passwordHash ?? DUMMY_HASH;
    const passwordMatches = await verifyPassword(input.password, stored);

    const failure = this.reasonToRefuse(user, passwordMatches);
    if (failure) {
      this.deps.logger.warn({ email, reason: failure }, 'login refused');
      throw new UnauthenticatedError('Incorrect email or password');
    }

    // `reasonToRefuse` returning null establishes this.
    const principal = user!;

    const permissions = permissionsForRole(principal.role as UserRole);
    const accessToken = await new SignJWT({
      email: principal.email,
      name: principal.name,
      role: principal.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(principal.id)
      .setIssuedAt()
      .setExpirationTime(this.deps.accessTtl)
      .sign(this.deps.accessSecret);

    await this.deps.repository.recordLogin(principal.id);

    this.deps.logger.info(
      { userId: principal.id, role: principal.role },
      'reviewer signed in',
    );

    return {
      accessToken,
      expiresIn: ttlSeconds(this.deps.accessTtl),
      user: {
        id: principal.id,
        email: principal.email,
        name: principal.name,
        role: principal.role as UserRole,
        status: principal.status,
        permissions,
      },
    };
  }

  /**
   * Why this attempt is refused, or null to allow it.
   *
   * Every branch is checked AFTER the password comparison above, so the work
   * done is identical whichever branch is taken.
   */
  private reasonToRefuse(
    user: { status: string; deletedAt: Date | null; passwordHash: string } | null,
    passwordMatches: boolean,
  ): string | null {
    if (!user) return 'no such account';
    // The seeded row carries a placeholder specifically so it cannot be used.
    if (!user.passwordHash.startsWith('scrypt$')) return 'no usable password set';
    if (!passwordMatches) return 'wrong password';
    if (user.deletedAt) return 'account deleted';
    if (user.status !== 'ACTIVE') return `account ${user.status.toLowerCase()}`;
    return null;
  }
}

/** "15m" / "2h" / "900s" -> seconds. Mirrors what jose accepts. */
export function ttlSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const multiplier = { s: 1, m: 60, h: 3_600, d: 86_400 }[unit] ?? 1;
  return value * multiplier;
}
