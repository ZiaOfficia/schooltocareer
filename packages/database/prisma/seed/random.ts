/**
 * Deterministic pseudo-random source.
 *
 * The seed MUST produce the same database every time: a verification suite that
 * asserts "3,000 papers, 412 of them from 2024" is worthless if the numbers
 * move between runs, and an EXPLAIN plan captured against one dataset cannot be
 * compared to a plan captured against another.
 *
 * mulberry32 — small, fast, and good enough for generating fixture data.
 */
export function createRandom(seed = 0x5eed_1234) {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    int: (min: number, max: number): number => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    /** Picks `count` distinct items, or all of them if there are fewer. */
    sample: <T>(items: readonly T[], count: number): T[] => {
      const pool = [...items];
      const out: T[] = [];
      while (out.length < count && pool.length > 0) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]!);
      }
      return out;
    },
    bool: (probability = 0.5): boolean => next() < probability,
    /** A date within the last `years`, biased towards recent. */
    pastDate: (years = 5): Date => {
      const span = years * 365 * 86_400_000;
      const skew = next() ** 2; // squaring clusters values near zero → recent
      return new Date(Date.now() - skew * span);
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

/**
 * Stable ids.
 *
 * Explicit rather than `cuid()` so the seed is IDEMPOTENT — re-running upserts
 * the same rows instead of duplicating them, and a verification script can
 * reference `seed_exam_jee-main` directly without a lookup.
 */
export function seedId(kind: string, key: string | number): string {
  return `seed_${kind}_${String(key)}`.slice(0, 60);
}
