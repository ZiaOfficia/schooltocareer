/** Small collection and object helpers. No dependencies, fully tree-shakeable. */

export function groupBy<T, K extends string | number>(
  items: readonly T[],
  key: (item: T) => K,
): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function uniqueBy<T, K>(items: readonly T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sortBy<T>(
  items: readonly T[],
  key: (item: T) => string | number,
  dir: 'asc' | 'desc' = 'asc',
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    if (av === bv) return 0;
    return av < bv ? -sign : sign;
  });
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/** Drops undefined values — Prisma treats `undefined` as "no change" but JSON serialises it away. */
export function compact<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/** Shallow diff, for `changedFields` on revisions and audit rows. */
export function changedKeys<T extends object>(before: T, after: Partial<T>): string[] {
  return Object.keys(after).filter((k) => {
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    if (b instanceof Date && a instanceof Date) return b.getTime() !== a.getTime();
    if (Array.isArray(b) && Array.isArray(a)) return JSON.stringify(b) !== JSON.stringify(a);
    return b !== a;
  });
}
