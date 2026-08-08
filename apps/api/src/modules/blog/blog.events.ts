import { defineEvents } from '../../core/events/define-events.js';

/**
 * Post events.
 *
 * The path depends on the content TYPE and its category - a NEWS item lives at
 * /news/:category/:slug, an ARTICLE at /blog/:category/:slug - so the subject
 * carries the resolved path rather than recomputing it. ContentEntry stores
 * `path` as a real column for exactly this reason: it is the canonical URL and
 * every consumer must agree on it.
 */
export type PostSubject = { id: string; slug: string; path: string };

export const postEvents = defineEvents<PostSubject>(
  'post',
  'CONTENT_ENTRY',
  (post) => post.path,
);

/** Builds the canonical path. The one place URL shape is decided. */
export function postPath(type: string, categorySlug: string | null, slug: string): string {
  const section = type === 'NEWS' ? 'news' : 'blog';
  return categorySlug ? `/${section}/${categorySlug}/${slug}` : `/${section}/${slug}`;
}