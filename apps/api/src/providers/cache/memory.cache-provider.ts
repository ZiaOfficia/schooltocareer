import { MEMORY_CACHE_MAX_TTL_SECONDS } from '@stc/constants';

import type { CacheSetOptions, CacheStats, ICacheProvider } from './cache.provider.js';

type Entry = {
  value: unknown;
  expiresAt: number;
  tags: readonly string[];
};

/**
 * In-process LRU with TTL and tag invalidation.
 *
 * Deliberately simple: no background sweeper thread. Expired entries are
 * evicted lazily on read and opportunistically when the cache is full, which
 * keeps the event loop free — a timer scanning 10,000 entries every second is
 * a worse trade than a stale entry occupying memory for a few extra seconds.
 *
 * In-flight de-duplication matters more than it looks: when a popular page
 * expires under load, 200 concurrent requests would otherwise each run the
 * factory and hit the database. `inFlight` collapses them into one query.
 */
export class MemoryCacheProvider implements ICacheProvider {
  private readonly store = new Map<string, Entry>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private readonly maxEntries = 5_000) {}

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.remove(key);
      this.misses++;
      return undefined;
    }
    // LRU touch: re-insert to move to the end of Map iteration order.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    const ttl = Math.min(options.ttl ?? MEMORY_CACHE_MAX_TTL_SECONDS, MEMORY_CACHE_MAX_TTL_SECONDS);
    const tags = options.tags ?? [];

    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOldest();
    }

    this.remove(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000, tags });

    for (const tag of tags) {
      let keys = this.tagIndex.get(tag);
      if (!keys) {
        keys = new Set();
        this.tagIndex.set(tag, keys);
      }
      keys.add(key);
    }
  }

  async del(key: string): Promise<void> {
    this.remove(key);
  }

  async delByTag(tags: readonly string[]): Promise<void> {
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (!keys) continue;
      for (const key of keys) this.remove(key);
      this.tagIndex.delete(tag);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.tagIndex.clear();
    this.inFlight.clear();
  }

  async wrap<T>(key: string, factory: () => Promise<T>, options: CacheSetOptions = {}): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    // Collapse concurrent misses on the same key into a single factory call.
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = factory()
      .then(async (value) => {
        await this.set(key, value, options);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.store.size,
      evictions: this.evictions,
    };
  }

  private remove(key: string): void {
    const entry = this.store.get(key);
    if (!entry) return;
    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(key);
    }
    this.store.delete(key);
  }

  private evictOldest(): void {
    // Map preserves insertion order, and `get` re-inserts on hit, so the first
    // key is the least recently used.
    const oldest = this.store.keys().next();
    if (!oldest.done) {
      this.remove(oldest.value);
      this.evictions++;
    }
  }
}
