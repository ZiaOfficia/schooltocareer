import type { OwnerType } from '@stc/types';

/**
 * Cache tags, shared by the API's cache-aside layer and Next.js
 * `revalidateTag`. Both sides must agree on the exact string or invalidation
 * silently no-ops — which is precisely the bug you cannot see in staging and
 * cannot miss in production.
 */

/** `BOARD_CLASS_SUBJECT` -> `board-class-subject`. */
export function entityKey(ownerType: OwnerType | string): string {
  return String(ownerType).toLowerCase().replace(/_/g, '-');
}

export const CACHE_TAGS = {
  /**
   * Entity-agnostic tags. These are what let ONE cache handler serve every
   * module — a per-entity `CACHE_TAGS.exam(...)` would force a cache handler
   * per module, which is the duplication the event system exists to avoid.
   */
  entity: (ownerType: OwnerType | string, slug: string) => `${entityKey(ownerType)}:${slug}`,
  entityList: (ownerType: OwnerType | string) => `${entityKey(ownerType)}:list`,
  entityChildren: (ownerType: OwnerType | string, slug: string) =>
    `${entityKey(ownerType)}:${slug}:children`,

  // Collections
  examList: () => 'exam:list',
  boardList: () => 'board:list',
  paperList: () => 'paper:list',
  resultList: () => 'result:list',
  contentList: (type: string) => `content:list:${type}`,
  categoryList: () => 'category:list',

  // Single entities
  exam: (slug: string) => `exam:${slug}`,
  board: (slug: string) => `board:${slug}`,
  boardClass: (boardSlug: string, classSlug: string) => `board-class:${boardSlug}:${classSlug}`,
  subject: (slug: string) => `subject:${slug}`,
  paper: (slug: string) => `paper:${slug}`,
  result: (slug: string) => `result:${slug}`,
  content: (path: string) => `content:${path}`,
  category: (slug: string) => `category:${slug}`,

  // Cross-cutting
  sections: (ownerType: OwnerType, ownerId: string) => `sections:${ownerType}:${ownerId}`,
  faqs: (ownerType: OwnerType, ownerId: string) => `faqs:${ownerType}:${ownerId}`,
  seo: (path: string) => `seo:${path}`,
  sitemap: () => 'sitemap',
  navigation: () => 'navigation',
  homepage: () => 'homepage',
} as const;

/**
 * Revalidation TTLs in seconds.
 *
 * Result and news pages are short because freshness is the product on
 * declaration day. Static reference pages are long because they change monthly
 * and every regeneration costs a database round trip across 100k URLs.
 */
export const REVALIDATE = {
  /** Home, navigation — changes when anything is published. */
  HOMEPAGE: 300,
  /** Results and news during an active cycle. */
  VOLATILE: 60,
  /** Exam/board hub pages. */
  ENTITY: 3600,
  /** Papers, notes, syllabus — the long tail. */
  LONG_TAIL: 86_400,
  /** Legal pages. */
  STATIC: 604_800,
  /** Sitemaps. */
  SITEMAP: 3600,
} as const;

/**
 * In-memory cache tier TTL cap.
 *
 * Until Redis exists, `delByTag` only invalidates the instance that handled the
 * request. Keeping the memory tier short bounds how stale a second Render
 * instance can be; Next.js ISR tag revalidation remains authoritative. When
 * this cap starts hurting, that is the signal to add Redis — not a date.
 */
export const MEMORY_CACHE_MAX_TTL_SECONDS = 60;

export const CACHE_KEY_SEPARATOR = ':' as const;
