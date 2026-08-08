import type { UserRole } from '@stc/types';

/**
 * Role slugs. Never write 'admin' as a string literal anywhere else.
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  AUTHOR: 'AUTHOR',
} as const satisfies Record<UserRole, UserRole>;

/**
 * Rank, for "at least this role" checks. Higher wins.
 * Ranking is NOT a substitute for permissions — it only answers questions like
 * "can this user manage that user", never "can this user publish".
 */
export const ROLE_RANK: Record<UserRole, number> = {
  ADMIN: 30,
  EDITOR: 20,
  AUTHOR: 10,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  EDITOR: 'Editor',
  AUTHOR: 'Author',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Full access, including users, settings, SEO and destructive actions.',
  EDITOR: 'Creates and publishes all content. Cannot manage users or settings.',
  AUTHOR: 'Creates and edits own drafts. Cannot publish.',
};

export function hasRankAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
