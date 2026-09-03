import type { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { describe, expect, it, vi } from 'vitest';

import { PERMISSIONS, type Permission } from '@stc/constants';

import { runWithContext } from '../../core/context.js';
import { ForbiddenError, UnauthenticatedError } from '../../core/errors/app-error.js';
import { createLogger } from '../../core/logger.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

import { hashPassword, verifyPassword } from './auth.password.js';
import { AuthService, ttlSeconds, type AuthRepositoryPort } from './auth.service.js';
import type { AuthUserRecord } from './auth.repository.js';

/**
 * Authentication exists here for exactly one reason: to make the fact-review
 * API reachable by a NAMED human. So these tests are less about "login works"
 * and more about the properties that make an approval trustworthy — the token
 * must carry a real user id, and it must be accepted by the same middleware
 * that guards the approval route.
 */

const SECRET = new TextEncoder().encode('test-secret-at-least-32-characters-long!!');
const PASSWORD = 'a-real-editor-password';

const logger = createLogger({ level: 'silent', pretty: false, service: 'test' });

async function buildService(
  overrides: Partial<AuthUserRecord> | null = {},
): Promise<{ service: AuthService; logins: string[] }> {
  const logins: string[] = [];

  const user: AuthUserRecord | null =
    overrides === null
      ? null
      : {
          id: 'user_editor',
          email: 'editor@schooltocareer.local',
          name: 'Real Editor',
          role: 'EDITOR',
          status: 'ACTIVE',
          passwordHash: await hashPassword(PASSWORD),
          deletedAt: null,
          ...overrides,
        };

  const repository: AuthRepositoryPort = {
    findForLogin: vi.fn(async () => user),
    recordLogin: vi.fn(async (id: string) => {
      logins.push(id);
    }),
  };

  return {
    service: new AuthService({
      repository,
      accessSecret: SECRET,
      accessTtl: '15m',
      logger,
    }),
    logins,
  };
}

describe('password hashing', () => {
  it('round-trips a password', async () => {
    const hash = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('not-the-password', hash)).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it('stores its parameters, so the cost can be raised without breaking old hashes', async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.split('$').slice(0, 4)).toEqual(['scrypt', '32768', '8', '1']);
  });

  it('refuses the seed placeholder instead of throwing on it', async () => {
    // The seeded admin row carries this exact string so nobody can sign in as
    // it. It must fail verification quietly — a crash here would turn an
    // unusable account into a 500 on the login endpoint.
    expect(await verifyPassword('anything', 'SEED_PLACEHOLDER_NOT_A_VALID_HASH')).toBe(false);
  });

  it('refuses a malformed or hand-edited hash rather than throwing', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$notanumber$8$1$c2FsdA==$aGFzaA==')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$32768$8$1$c2FsdA==$')).toBe(false);
  });
});

describe('login', () => {
  it('issues a token the existing authenticate() middleware accepts', async () => {
    const { service } = await buildService();
    const result = await service.login({ email: 'editor@schooltocareer.local', password: PASSWORD });

    // Verified with the SAME secret and algorithm the middleware uses. If this
    // passes, the token opens the fact-review route.
    const { payload } = await jwtVerify(result.accessToken, SECRET, { algorithms: ['HS256'] });

    expect(payload.sub).toBe('user_editor');
    expect(payload['role']).toBe('EDITOR');
    expect(payload['email']).toBe('editor@schooltocareer.local');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('returns a principal whose permissions include fact approval', async () => {
    // The whole point of the module. An EDITOR must be able to approve a fact,
    // or the activation gate is still unreachable.
    const { service } = await buildService();
    const result = await service.login({ email: 'editor@schooltocareer.local', password: PASSWORD });

    expect(result.user.id).toBe('user_editor');
    expect(result.user.permissions).toContain(PERMISSIONS.FACT_APPROVE);
    expect(result.user.permissions).toContain(PERMISSIONS.FACT_REVIEW);
  });

  it('never returns the password hash', async () => {
    const { service } = await buildService();
    const result = await service.login({ email: 'editor@schooltocareer.local', password: PASSWORD });
    expect(JSON.stringify(result)).not.toContain('scrypt$');
  });

  it('records the sign-in against the real user', async () => {
    const { service, logins } = await buildService();
    await service.login({ email: 'editor@schooltocareer.local', password: PASSWORD });
    expect(logins).toEqual(['user_editor']);
  });

  it('normalises the email, so case cannot create a second identity', async () => {
    const { service } = await buildService();
    const result = await service.login({
      email: '  EDITOR@SchoolToCareer.local  ',
      password: PASSWORD,
    });
    expect(result.user.id).toBe('user_editor');
  });
});

describe('login refusals', () => {
  it('rejects a wrong password', async () => {
    const { service } = await buildService();
    await expect(
      service.login({ email: 'editor@schooltocareer.local', password: 'wrong' }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects an unknown account', async () => {
    const { service } = await buildService(null);
    await expect(
      service.login({ email: 'nobody@schooltocareer.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects an account with no usable password — the seeded admin', async () => {
    // This is the exact state that made the fact API unreachable. It must stay
    // unreachable through this route.
    const { service } = await buildService({
      passwordHash: 'SEED_PLACEHOLDER_NOT_A_VALID_HASH',
    });
    await expect(
      service.login({ email: 'editor@schooltocareer.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects a suspended account even with the right password', async () => {
    const { service } = await buildService({ status: 'SUSPENDED' });
    await expect(
      service.login({ email: 'editor@schooltocareer.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects a soft-deleted account even with the right password', async () => {
    const { service } = await buildService({ deletedAt: new Date() });
    await expect(
      service.login({ email: 'editor@schooltocareer.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('gives the SAME message for every failure, so it cannot enumerate accounts', async () => {
    const cases = await Promise.all([
      buildService(null),
      buildService(),
      buildService({ status: 'SUSPENDED' }),
      buildService({ deletedAt: new Date() }),
    ]);

    const messages = await Promise.all(
      cases.map(async ({ service }, index) =>
        service
          .login({
            email: 'editor@schooltocareer.local',
            password: index === 1 ? 'wrong-password' : PASSWORD,
          })
          .then(() => 'SUCCEEDED')
          .catch((error: Error) => error.message),
      ),
    );

    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toBe('Incorrect email or password');
  });

  it('does not record a sign-in for a refused attempt', async () => {
    const { service, logins } = await buildService();
    await service
      .login({ email: 'editor@schooltocareer.local', password: 'wrong' })
      .catch(() => undefined);
    expect(logins).toEqual([]);
  });
});

/**
 * The join that actually matters.
 *
 * Every test above proves the token is well-formed. These prove it opens the
 * door it was built for: the real `authenticate()` middleware accepts it, the
 * real `requirePermission(FACT_APPROVE)` gate passes, and an AUTHOR — who may
 * write blog drafts — is still refused. Verifying the token with `jwtVerify`
 * alone would have proved none of that.
 */
describe('the token opens the fact-approval route', () => {
  type Outcome = { error?: Error };

  /** Runs authenticate() then requirePermission() exactly as the route does. */
  async function runGate(
    token: string | null,
    permission: Permission,
  ): Promise<Outcome> {
    return runWithContext(
      {
        requestId: 'r',
        correlationId: 'c',
        startedAt: Date.now(),
        method: 'POST',
        path: '/api/v1/admin/fact-changes/x/approve',
        ip: '127.0.0.1',
      },
      async () => {
        const req = {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        } as unknown as Request;
        const res = {} as Response;

        const outcome: Outcome = {};
        const capture = (error?: unknown): void => {
          if (error instanceof Error) outcome.error = error;
        };

        await new Promise<void>((resolve) => {
          authenticate(SECRET)(req, res, ((error?: unknown) => {
            capture(error);
            resolve();
          }) as NextFunction);
        });
        if (outcome.error) return outcome;

        requirePermission(permission)(req, res, capture as NextFunction);
        return outcome;
      },
    );
  }

  it('an EDITOR token passes authenticate() and the fact:approve gate', async () => {
    const { service } = await buildService();
    const { accessToken } = await service.login({
      email: 'editor@schooltocareer.local',
      password: PASSWORD,
    });

    const outcome = await runGate(accessToken, PERMISSIONS.FACT_APPROVE);
    expect(outcome.error).toBeUndefined();
  });

  it('an AUTHOR token is authenticated but REFUSED fact:approve', async () => {
    // Authorisation is unchanged by this module — an AUTHOR may draft content
    // and must not be able to publish an exam date.
    const { service } = await buildService({ role: 'AUTHOR' });
    const { accessToken } = await service.login({
      email: 'editor@schooltocareer.local',
      password: PASSWORD,
    });

    const outcome = await runGate(accessToken, PERMISSIONS.FACT_APPROVE);
    expect(outcome.error).toBeInstanceOf(ForbiddenError);
  });

  it('no token is still rejected — the route does not open up', async () => {
    const outcome = await runGate(null, PERMISSIONS.FACT_APPROVE);
    expect(outcome.error).toBeInstanceOf(UnauthenticatedError);
  });

  it('a token signed with a different secret is rejected', async () => {
    const { service } = await buildService();
    const { accessToken } = await service.login({
      email: 'editor@schooltocareer.local',
      password: PASSWORD,
    });
    // Same token, verified against the wrong secret by the middleware.
    const outcome = await runWithContext(
      {
        requestId: 'r',
        correlationId: 'c',
        startedAt: Date.now(),
        method: 'GET',
        path: '/',
        ip: '127.0.0.1',
      },
      async () => {
        const req = { headers: { authorization: `Bearer ${accessToken}` } } as unknown as Request;
        const result: Outcome = {};
        await new Promise<void>((resolve) => {
          authenticate(new TextEncoder().encode('a-completely-different-secret-32ch!!'))(
            req,
            {} as Response,
            ((error?: unknown) => {
              if (error instanceof Error) result.error = error;
              resolve();
            }) as NextFunction,
          );
        });
        return result;
      },
    );
    expect(outcome.error).toBeInstanceOf(UnauthenticatedError);
  });
});

describe('ttlSeconds', () => {
  it('parses the units the env uses', () => {
    expect(ttlSeconds('15m')).toBe(900);
    expect(ttlSeconds('2h')).toBe(7_200);
    expect(ttlSeconds('30d')).toBe(2_592_000);
    expect(ttlSeconds('45s')).toBe(45);
    expect(ttlSeconds('900')).toBe(900);
  });

  it('falls back rather than returning NaN', () => {
    expect(ttlSeconds('nonsense')).toBe(900);
  });
});
