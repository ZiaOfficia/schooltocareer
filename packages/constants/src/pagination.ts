/**
 * Pagination limits. `MAX_PER_PAGE` is a denial-of-service guard as much as a
 * UX choice — without it, `?perPage=100000` is a free full-table scan for any
 * anonymous caller.
 */

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,

  /** Admin data tables. */
  ADMIN_PER_PAGE: 25,
  ADMIN_MAX_PER_PAGE: 200,

  /** Public feeds — cursor-paginated. */
  FEED_PER_PAGE: 12,

  /** Search results. */
  SEARCH_PER_PAGE: 20,
  SEARCH_MAX_RESULTS: 1000,

  /**
   * Offset pagination beyond this page is refused (410) and marked noindex.
   * Deep pagination burns crawl budget on pages nobody links to, and
   * `OFFSET 2000` is a scan-and-discard of 2,000 rows.
   */
  MAX_INDEXABLE_PAGE: 50,

  /** URLs per sitemap file. Google's hard limit is 50,000. */
  SITEMAP_PAGE_SIZE: 10_000,

  /** Batch size for the outbox worker and bulk importers. */
  WORKER_BATCH_SIZE: 100,
} as const;

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

/**
 * Sortable fields per resource. The query parser rejects anything not listed —
 * an allowlist, because `?sortBy=passwordHash` on a naive implementation is
 * both an information leak and an unindexed sort.
 */
export const SORTABLE_FIELDS = {
  exam: ['name', 'popularityScore', 'createdAt', 'updatedAt', 'publishedAt'],
  board: ['name', 'popularityScore', 'establishedYear', 'createdAt'],
  questionPaper: ['year', 'title', 'downloadCount', 'publishedAt', 'createdAt'],
  result: ['year', 'declaredAt', 'title', 'createdAt'],
  content: ['publishedAt', 'title', 'viewCount', 'createdAt', 'updatedAt'],
  category: ['order', 'name', 'createdAt'],
  media: ['createdAt', 'bytes', 'usageCount'],
} as const satisfies Record<string, readonly string[]>;

export type SortableResource = keyof typeof SORTABLE_FIELDS;
export type SortableField<R extends SortableResource> = (typeof SORTABLE_FIELDS)[R][number];

/**
 * `as const satisfies` rather than a plain annotation: it preserves the literal
 * types (so schemas can consume them as enum members) AND checks at compile
 * time that every default is actually in that resource's allowlist.
 */
export const DEFAULT_SORT = {
  exam: { field: 'popularityScore', dir: 'desc' },
  board: { field: 'popularityScore', dir: 'desc' },
  questionPaper: { field: 'year', dir: 'desc' },
  result: { field: 'year', dir: 'desc' },
  content: { field: 'publishedAt', dir: 'desc' },
  category: { field: 'order', dir: 'asc' },
  media: { field: 'createdAt', dir: 'desc' },
} as const satisfies {
  [R in SortableResource]: { field: SortableField<R>; dir: (typeof SORT_DIRECTIONS)[number] };
};
