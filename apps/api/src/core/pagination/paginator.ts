import { PAGINATION } from '@stc/constants';
import type { CursorPageMeta, OffsetPageMeta, SortDirection } from '@stc/types';
import { cursorFrom, decodeCursor, isCursorCompatible } from '@stc/utils';

import { InvalidCursorError } from '../errors/app-error.js';

/**
 * Pagination primitives shared by every repository.
 *
 * Offset and cursor are not interchangeable styles — see
 * packages/types/src/pagination.ts for which endpoints get which and why.
 */

export type OffsetArgs = { skip: number; take: number };

export function toOffsetArgs(page: number, perPage: number): OffsetArgs {
  const safePerPage = Math.min(Math.max(1, perPage), PAGINATION.MAX_PER_PAGE);
  return { skip: (Math.max(1, page) - 1) * safePerPage, take: safePerPage };
}

export function buildOffsetMeta(page: number, perPage: number, total: number): OffsetPageMeta {
  const totalPages = perPage > 0 ? Math.ceil(total / perPage) : 0;
  return {
    kind: 'offset',
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Keyset pagination arguments.
 *
 * `take: perPage + 1` is deliberate — fetching one extra row is how we know
 * whether a next page exists without a second `COUNT(*)` query. The extra row
 * is stripped before it reaches the client.
 */
export type CursorArgs<TSortField extends string> = {
  take: number;
  cursorFilter: CursorFilter<TSortField> | undefined;
  orderBy: Array<Record<string, SortDirection>>;
};

export type CursorFilter<TSortField extends string> = {
  OR: [
    { [K in TSortField]?: { lt: unknown } | { gt: unknown } },
    { AND: Array<Record<string, unknown>> },
  ];
};

export function toCursorArgs<TSortField extends string>(params: {
  cursor?: string;
  perPage: number;
  sortField: TSortField;
  sortDir: SortDirection;
  /** Converts the encoded cursor value back to the column's runtime type. */
  parseValue?: (raw: string | number) => unknown;
}): CursorArgs<TSortField> {
  const perPage = Math.min(Math.max(1, params.perPage), PAGINATION.MAX_PER_PAGE);
  const op = params.sortDir === 'desc' ? 'lt' : 'gt';

  const orderBy: Array<Record<string, SortDirection>> = [
    { [params.sortField]: params.sortDir },
    // Tie-breaker. Without it, rows sharing a sort value are returned in an
    // arbitrary order and keyset pagination silently skips or repeats them.
    { id: params.sortDir },
  ];

  if (!params.cursor) {
    return { take: perPage + 1, cursorFilter: undefined, orderBy };
  }

  const payload = decodeCursor(params.cursor);
  if (!payload || !isCursorCompatible(payload, params.sortDir)) {
    throw new InvalidCursorError();
  }

  const value = params.parseValue ? params.parseValue(payload.v) : payload.v;

  // (sortField, id) > (v, id) expressed as a Prisma-compatible predicate.
  const cursorFilter = {
    OR: [
      { [params.sortField]: { [op]: value } },
      { AND: [{ [params.sortField]: value }, { id: { [op]: payload.id } }] },
    ],
  } as CursorFilter<TSortField>;

  return { take: perPage + 1, cursorFilter, orderBy };
}

/** Strips the probe row and mints the next cursor. */
export function buildCursorPage<T extends { id: string }>(
  rows: T[],
  params: {
    perPage: number;
    sortDir: SortDirection;
    getSortValue: (row: T) => string | number | Date;
    currentCursor?: string;
  },
): { items: T[]; meta: CursorPageMeta } {
  const hasNext = rows.length > params.perPage;
  const items = hasNext ? rows.slice(0, params.perPage) : rows;
  const last = items.at(-1);

  return {
    items,
    meta: {
      kind: 'cursor',
      perPage: params.perPage,
      nextCursor:
        hasNext && last ? cursorFrom(last, params.getSortValue(last), params.sortDir) : null,
      prevCursor: params.currentCursor ?? null,
      hasNext,
    },
  };
}

/**
 * Deep offset pagination is refused rather than served.
 * `OFFSET 2000` is a scan-and-discard of 2,000 rows, and pages that deep are
 * crawl-budget leaks nobody links to.
 */
export function assertPageIsServable(page: number): void {
  if (page > PAGINATION.MAX_INDEXABLE_PAGE) {
    throw new InvalidCursorError();
  }
}
