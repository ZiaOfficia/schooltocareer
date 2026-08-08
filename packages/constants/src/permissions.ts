import type { UserRole } from '@stc/types';

/**
 * Permission keys, in `subject:action` form.
 *
 * Authorisation is checked ONLY through these keys, never by comparing
 * `user.role === 'ADMIN'` inline. That indirection is why Phase 2 can replace
 * the `User.role` enum with real Role/Permission tables without touching a
 * single call site — ROLE_PERMISSIONS below gets replaced by a DB lookup and
 * nothing else changes.
 */
export const PERMISSIONS = {
  // Content
  CONTENT_READ: 'content:read',
  CONTENT_CREATE: 'content:create',
  CONTENT_UPDATE: 'content:update',
  CONTENT_UPDATE_OWN: 'content:update-own',
  CONTENT_DELETE: 'content:delete',
  CONTENT_PUBLISH: 'content:publish',
  CONTENT_ROLLBACK: 'content:rollback',
  CONTENT_CHANGE_SLUG: 'content:change-slug',

  // Taxonomy / reference data
  BOARD_MANAGE: 'board:manage',
  EXAM_MANAGE: 'exam:manage',
  EXAM_PUBLISH: 'exam:publish',
  SUBJECT_MANAGE: 'subject:manage',
  CATEGORY_MANAGE: 'category:manage',

  // Papers & results
  PAPER_MANAGE: 'paper:manage',
  PAPER_PUBLISH: 'paper:publish',
  RESULT_MANAGE: 'result:manage',
  RESULT_PUBLISH: 'result:publish',

  // Media
  MEDIA_UPLOAD: 'media:upload',
  MEDIA_DELETE: 'media:delete',

  // SEO
  SEO_MANAGE: 'seo:manage',
  REDIRECT_MANAGE: 'redirect:manage',

  // Platform
  USER_MANAGE: 'user:manage',
  SETTINGS_MANAGE: 'settings:manage',
  CACHE_PURGE: 'cache:purge',
  SEARCH_REINDEX: 'search:reindex',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as readonly Permission[];

const AUTHOR_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.CONTENT_READ,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE_OWN,
  PERMISSIONS.MEDIA_UPLOAD,
];

const EDITOR_PERMISSIONS: readonly Permission[] = [
  ...AUTHOR_PERMISSIONS,
  PERMISSIONS.CONTENT_UPDATE,
  PERMISSIONS.CONTENT_DELETE,
  PERMISSIONS.CONTENT_PUBLISH,
  PERMISSIONS.CONTENT_ROLLBACK,
  PERMISSIONS.CONTENT_CHANGE_SLUG,
  PERMISSIONS.BOARD_MANAGE,
  PERMISSIONS.EXAM_MANAGE,
  PERMISSIONS.EXAM_PUBLISH,
  PERMISSIONS.SUBJECT_MANAGE,
  PERMISSIONS.CATEGORY_MANAGE,
  PERMISSIONS.PAPER_MANAGE,
  PERMISSIONS.PAPER_PUBLISH,
  PERMISSIONS.RESULT_MANAGE,
  PERMISSIONS.RESULT_PUBLISH,
  PERMISSIONS.MEDIA_DELETE,
  PERMISSIONS.SEO_MANAGE,
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  EDITOR: EDITOR_PERMISSIONS,
  AUTHOR: AUTHOR_PERMISSIONS,
};

/**
 * The ONLY authorisation predicate in the codebase.
 * Pure and dependency-free, so it is identical in the API, the admin UI (to
 * hide controls) and workers.
 */
export function can(
  principal: { role: UserRole; permissions?: readonly string[] },
  permission: Permission,
): boolean {
  if (principal.permissions) return principal.permissions.includes(permission);
  return ROLE_PERMISSIONS[principal.role].includes(permission);
}

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
