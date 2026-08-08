import type { CursorPayload, SortDirection } from '@stc/types';

/**
 * Opaque cursor encoding for keyset pagination.
 *
 * The cursor is ALWAYS composite: sort value plus the row id. A cursor on
 * `publishedAt` alone silently skips rows whenever two records share a
 * timestamp — which happens on every bulk import, so it is not a rare edge.
 *
 * base64url, not base64: cursors travel in query strings.
 */

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('v' in parsed) ||
      !('id' in parsed) ||
      !('d' in parsed)
    ) {
      return null;
    }
    const { v, id, d } = parsed as Record<string, unknown>;
    if (typeof id !== 'string') return null;
    if (typeof v !== 'string' && typeof v !== 'number') return null;
    if (d !== 'asc' && d !== 'desc') return null;
    return { v, id, d };
  } catch {
    return null;
  }
}

/**
 * A cursor is only valid for the direction it was minted for. Flipping the
 * sort while paginating would otherwise walk the wrong way through the index
 * and return duplicates.
 */
export function isCursorCompatible(payload: CursorPayload, dir: SortDirection): boolean {
  return payload.d === dir;
}

/** Builds the cursor for the last row of a page. */
export function cursorFrom(
  row: { id: string },
  sortValue: string | number | Date,
  dir: SortDirection,
): string {
  const v = sortValue instanceof Date ? sortValue.toISOString() : sortValue;
  return encodeCursor({ v, id: row.id, d: dir });
}
