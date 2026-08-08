/**
 * Two pagination shapes, chosen per endpoint — not per developer preference.
 *
 *   OFFSET  — admin tables and any page that must show "Page 7 of 42".
 *             Only where total pages are bounded and small.
 *   CURSOR  — every public feed (blog, news, papers, search results).
 *             `OFFSET 50000` makes PostgreSQL scan and discard 50,000 rows.
 *
 * The rule lives in docs/architecture/: if a list can exceed ~50 pages or is
 * publicly crawlable, it is cursor-paginated.
 */

export type SortDirection = 'asc' | 'desc';

export type OffsetPageMeta = {
  kind: 'offset';
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type CursorPageMeta = {
  kind: 'cursor';
  perPage: number;
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
};

export type PageMeta = OffsetPageMeta | CursorPageMeta;

export type Paginated<T> = {
  items: T[];
  meta: PageMeta;
};

/** Normalised list query, produced by the query parser middleware. */
export type ListQuery<TSortField extends string = string, TFilters = Record<string, unknown>> = {
  page: number;
  perPage: number;
  cursor?: string;
  sortBy: TSortField;
  sortDir: SortDirection;
  search?: string;
  filters: TFilters;
};

/**
 * Opaque cursor payload. Encoded base64url so clients cannot construct one and
 * accidentally depend on its shape. Always a composite of the sort key plus the
 * tie-breaking id — a cursor on `publishedAt` alone skips rows when two records
 * share a timestamp, which happens constantly on bulk imports.
 */
export type CursorPayload = {
  /** Value of the sort column at the boundary row. */
  v: string | number;
  /** Tie-breaker: the row id. */
  id: string;
  /** Sort direction the cursor was minted for — rejected if the query flips. */
  d: SortDirection;
};
