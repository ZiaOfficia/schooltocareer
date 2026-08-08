import type { UserRole, UserStatus } from './enums.js';

/**
 * The authenticated principal attached to `req.user` by the auth middleware.
 * Deliberately NOT the Prisma User model — this crosses the API boundary and
 * must never carry passwordHash, deletedAt, or anything else internal.
 */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  /** Resolved from role at authentication time; the app never re-derives it. */
  permissions: readonly string[];
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  /** Token version — bumping it on the user invalidates all issued tokens. */
  tv: number;
  iat: number;
  exp: number;
};

export type RefreshTokenPayload = {
  sub: string;
  /** Session id, so a single device can be revoked without a global logout. */
  sid: string;
  iat: number;
  exp: number;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
