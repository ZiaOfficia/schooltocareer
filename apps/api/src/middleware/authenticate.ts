import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { jwtVerify, type JWTPayload } from 'jose';

import { permissionsForRole } from '@stc/constants';
import { USER_ROLE, type AuthUser, type UserRole } from '@stc/types';

import { attachUser } from '../core/context.js';
import { TokenExpiredError, UnauthenticatedError } from '../core/errors/app-error.js';

/**
 * Bearer-token authentication.
 *
 * Permissions are resolved from the role HERE, once, and carried on the
 * principal. Every downstream check reads `user.permissions`, so swapping the
 * role enum for database-backed RBAC in Phase 2 changes this one function and
 * nothing else.
 */
export function authenticate(secret: Uint8Array, options: { optional?: boolean } = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractBearer(req);

    if (!token) {
      if (options.optional) {
        next();
        return;
      }
      next(new UnauthenticatedError());
      return;
    }

    try {
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        clockTolerance: 5,
      });

      const user = toAuthUser(payload);
      if (!user) {
        next(new UnauthenticatedError('Token payload is malformed'));
        return;
      }

      attachUser(user);
      next();
    } catch (error) {
      if (isExpired(error)) {
        next(new TokenExpiredError());
        return;
      }
      next(new UnauthenticatedError('Invalid access token'));
    }
  };
}

/** Reads the token without requiring it — public endpoints that personalise. */
export function optionalAuthenticate(secret: Uint8Array): RequestHandler {
  return authenticate(secret, { optional: true });
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function toAuthUser(payload: JWTPayload): AuthUser | null {
  const { sub, email, role } = payload as { sub?: string; email?: string; role?: string };
  if (!sub || !email || !role) return null;
  if (!(USER_ROLE as readonly string[]).includes(role)) return null;

  const typedRole = role as UserRole;
  return {
    id: sub,
    email,
    name: (payload['name'] as string | undefined) ?? email,
    role: typedRole,
    status: 'ACTIVE',
    permissions: permissionsForRole(typedRole),
  };
}

function isExpired(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'ERR_JWT_EXPIRED'
  );
}
