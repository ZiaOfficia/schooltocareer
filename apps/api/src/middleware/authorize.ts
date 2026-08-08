import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { can, type Permission } from '@stc/constants';

import { getCurrentUser } from '../core/context.js';
import { ForbiddenError, UnauthenticatedError } from '../core/errors/app-error.js';

/**
 * Permission gate. Always `can(user, PERMISSIONS.X)` — never a role comparison.
 *
 * Route-level authorisation covers "may this user call this endpoint at all".
 * Row-level rules ("may this author edit THIS post") live in the service,
 * because only the service has the row. Attempting row-level checks in
 * middleware means fetching the row twice.
 */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const user = getCurrentUser();
    if (!user) {
      next(new UnauthenticatedError());
      return;
    }

    const missing = permissions.find((permission) => !can(user, permission));
    if (missing) {
      next(new ForbiddenError(missing));
      return;
    }
    next();
  };
}

/** Passes when the caller holds ANY of the listed permissions. */
export function requireAnyPermission(...permissions: Permission[]): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const user = getCurrentUser();
    if (!user) {
      next(new UnauthenticatedError());
      return;
    }
    if (!permissions.some((permission) => can(user, permission))) {
      next(new ForbiddenError(permissions[0]));
      return;
    }
    next();
  };
}

/**
 * Ownership helper for services.
 *
 * The pattern it encodes: a user with the broad permission may act on any row;
 * otherwise they need the "-own" permission AND to actually own the row.
 * Returns a boolean rather than throwing so callers can fall through to a 404
 * where leaking existence would itself be a disclosure.
 */
export function canActOnRow(params: {
  broadPermission: Permission;
  ownPermission: Permission;
  ownerId: string | null | undefined;
}): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (can(user, params.broadPermission)) return true;
  return can(user, params.ownPermission) && params.ownerId === user.id;
}

export function assertCanActOnRow(params: {
  broadPermission: Permission;
  ownPermission: Permission;
  ownerId: string | null | undefined;
}): void {
  if (!canActOnRow(params)) {
    throw new ForbiddenError(params.broadPermission);
  }
}
