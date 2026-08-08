/**
 * Cache abstraction.
 *
 * Ships with MemoryCacheProvider. Swapping to Redis is a new implementation of
 * this interface plus one line in the container — no service changes.
 *
 * KNOWN LIMITATION of the memory implementation: on more than one Render
 * instance, `delByTag` only clears the instance that handled the request. That
 * is bounded by keeping TTLs short (MEMORY_CACHE_MAX_TTL_SECONDS) and letting
 * Next.js ISR tag revalidation be authoritative. When that stops being
 * acceptable, that is the trigger to add Redis — not a date on a roadmap.
 */
export interface ICacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  /** Invalidates every key registered under any of these tags. */
  delByTag(tags: readonly string[]): Promise<void>;
  clear(): Promise<void>;
  /** Cache-aside in one call: hit returns cached, miss runs `factory` and stores. */
  wrap<T>(key: string, factory: () => Promise<T>, options?: CacheSetOptions): Promise<T>;
  stats(): CacheStats;
}

export type CacheSetOptions = {
  /** Seconds. Capped by the implementation. */
  ttl?: number;
  tags?: readonly string[];
};

export type CacheStats = {
  hits: number;
  misses: number;
  entries: number;
  evictions: number;
};

/** Builds a namespaced key. Never concatenate cache keys by hand. */
export function cacheKey(namespace: string, ...parts: Array<string | number>): string {
  return [namespace, ...parts.map(String)].join(':');
}
