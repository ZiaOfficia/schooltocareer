import { defineEvents } from '../../core/events/define-events.js';

/**
 * Category domain events.
 *
 * The path builder needs the category`s TYPE (a blog category lives at
 * /blog/:slug, a news one at /news/:slug), so the subject carries it. This is
 * the first module where the canonical path is not derivable from the slug
 * alone - and `defineEvents` handled it without modification.
 */
export type CategorySubject = { id: string; slug: string; type: string };

export const categoryEvents = defineEvents<CategorySubject>(
  'category',
  'CATEGORY',
  (category) => categoryPath(category.type, category.slug),
);

export function categoryPath(type: string, slug: string): string {
  return type === 'NEWS' ? `/news/${slug}` : `/blog/${slug}`;
}