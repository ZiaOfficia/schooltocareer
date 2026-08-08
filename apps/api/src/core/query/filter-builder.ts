import type { SortDirection } from '@stc/types';

/**
 * Filter/search/sort helpers shared by repositories.
 *
 * These build plain objects, not Prisma calls — the repository owns the query,
 * this just removes the copy-paste of assembling `where` clauses in 20 modules.
 */

/**
 * Drops undefined entries. Prisma treats `undefined` as "no condition", but an
 * object literal full of them is unreadable and easy to get wrong when a filter
 * is conditionally applied.
 */
export function whereAnd(...clauses: Array<Record<string, unknown> | undefined | false>): Record<
  string,
  unknown
> {
  const active = clauses.filter(
    (c): c is Record<string, unknown> => !!c && Object.keys(c).length > 0,
  );
  if (active.length === 0) return {};
  if (active.length === 1) return active[0]!;
  return { AND: active };
}

/** Applies a filter only when the value is present. */
export function when<T>(
  value: T | undefined | null,
  build: (value: T) => Record<string, unknown>,
): Record<string, unknown> | undefined {
  return value === undefined || value === null || value === '' ? undefined : build(value);
}

/**
 * Case-insensitive contains, for admin table search only.
 *
 * NOT for public search — `ILIKE '%term%'` cannot use a B-tree index and turns
 * into a sequential scan. Public search goes through ISearchProvider against
 * SearchDocument's GIN index.
 */
export function iContains(fields: readonly string[], term: string | undefined) {
  if (!term?.trim()) return undefined;
  const value = term.trim();
  return {
    OR: fields.map((field) => ({ [field]: { contains: value, mode: 'insensitive' as const } })),
  };
}

/** Inclusive range filter; omits the bound that was not supplied. */
export function between(
  field: string,
  min: number | Date | undefined,
  max: number | Date | undefined,
): Record<string, unknown> | undefined {
  if (min === undefined && max === undefined) return undefined;
  const range: Record<string, unknown> = {};
  if (min !== undefined) range['gte'] = min;
  if (max !== undefined) range['lte'] = max;
  return { [field]: range };
}

export function inList(field: string, values: readonly string[] | undefined) {
  return values?.length ? { [field]: { in: values } } : undefined;
}

/**
 * The soft-delete predicate.
 *
 * The Prisma client extension applies this automatically; this exists for the
 * explicit `withDeleted` paths (admin trash views) where the extension is
 * bypassed and the intent must be visible in the code.
 */
export function notDeleted(includeDeleted = false): Record<string, unknown> | undefined {
  return includeDeleted ? undefined : { deletedAt: null };
}

/** Public reads only ever see published, non-deleted rows. */
export function publiclyVisible(): Record<string, unknown> {
  return { status: 'PUBLISHED', deletedAt: null };
}

export function orderBy(
  field: string,
  dir: SortDirection,
): Array<Record<string, SortDirection>> {
  return [{ [field]: dir }, { id: dir }];
}
