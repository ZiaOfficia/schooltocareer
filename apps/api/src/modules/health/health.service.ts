import type { ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { IQueueProvider } from '../../providers/queue/queue.provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';

import type { HealthRepository } from './health.repository.js';

/** Per-dependency budget for the readiness probe. */
const CHECK_TIMEOUT_MS = 1_500;

/** Resolves to `fallback` on timeout or rejection — a probe never throws. */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise.catch(() => fallback), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type LivenessReport = {
  status: 'ok';
  uptimeSeconds: number;
  version: string;
  startedAt: string;
};

export type ReadinessReport = {
  status: 'ready' | 'degraded';
  checks: {
    database: { ok: boolean; latencyMs: number };
    search: { ok: boolean };
    queue: { ok: boolean; pending: number };
    cache: { ok: boolean; entries: number; hitRate: number };
  };
};

/**
 * Liveness vs readiness are genuinely different questions, and conflating them
 * is how a transient database blip turns into a restart loop.
 *
 *   liveness  — "is this process alive?"  If it fails, restart the container.
 *   readiness — "can it serve traffic?"   If it fails, stop routing to it.
 *
 * Liveness therefore touches NOTHING external. A slow database must never
 * cause Render to kill a healthy process.
 */
export class HealthService {
  private readonly startedAt = new Date();

  constructor(
    private readonly repository: HealthRepository,
    private readonly deps: {
      search: ISearchProvider;
      queue: IQueueProvider;
      cache: ICacheProvider;
      version: string;
    },
  ) {}

  liveness(): LivenessReport {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      version: this.deps.version,
      startedAt: this.startedAt.toISOString(),
    };
  }

  async readiness(): Promise<ReadinessReport> {
    // Every check is time-boxed. A dead database takes ~4s to fail its TCP
    // connect, which is long enough to blow the platform's health-check timeout
    // and turn "one dependency is down" into a restart loop.
    const [database, searchOk, pending] = await Promise.all([
      withTimeout(this.repository.ping(), CHECK_TIMEOUT_MS, { ok: false, latencyMs: -1 }),
      withTimeout(this.deps.search.healthy(), CHECK_TIMEOUT_MS, false),
      withTimeout(this.deps.queue.pendingCount(), CHECK_TIMEOUT_MS, -1),
    ]);

    const cacheStats = this.deps.cache.stats();
    const lookups = cacheStats.hits + cacheStats.misses;

    const checks: ReadinessReport['checks'] = {
      database,
      search: { ok: searchOk },
      queue: { ok: pending >= 0, pending },
      cache: {
        ok: true,
        entries: cacheStats.entries,
        hitRate: lookups === 0 ? 0 : Math.round((cacheStats.hits / lookups) * 100) / 100,
      },
    };

    // Only the database is fatal. Search being down should degrade search, not
    // take the whole site offline — 100k cached pages still render fine.
    return { status: checks.database.ok ? 'ready' : 'degraded', checks };
  }
}
