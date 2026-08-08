import { describe, expect, it, vi } from 'vitest';

import { DependencyError } from '../core/errors/dependency-error.js';
import { SearchSourceRegistry } from '../core/search/search-source.js';
import type { ClaimedMessage, IQueueProvider } from '../providers/queue/queue.provider.js';
import type { ISearchProvider } from '../providers/search/search.provider.js';

import { SearchDeleteHandler, SearchUpsertHandler } from './handlers/search.handlers.js';
import type { IOutboxHandler } from './handlers/outbox-handler.js';
import { OutboxWorker, DEFAULT_WORKER_OPTIONS } from './outbox.worker.js';

/**
 * The worker is driven through `runOnce()` rather than `start()`, so the tests
 * never sleep and never race a timer.
 */

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as never;

function message(overrides: Partial<ClaimedMessage> = {}): ClaimedMessage {
  return {
    id: 1n,
    eventType: 'SEARCH_UPSERT',
    ownerType: 'EXAM',
    ownerId: 'exam_1',
    payload: {},
    attempts: 1,
    ...overrides,
  };
}

function buildQueue(batch: ClaimedMessage[]) {
  const acked: bigint[] = [];
  const failed: Array<{ id: bigint; retryIn: number }> = [];
  const dead: Array<{ id: bigint; error: string }> = [];
  let served = false;

  const queue: IQueueProvider = {
    publish: vi.fn(async () => undefined),
    publishDetached: vi.fn(async () => undefined),
    claim: vi.fn(async () => {
      if (served) return [];
      served = true;
      return batch;
    }),
    ack: vi.fn(async (id: bigint) => {
      acked.push(id);
    }),
    fail: vi.fn(async (id: bigint, _e: string, retryIn: number) => {
      failed.push({ id, retryIn });
    }),
    deadLetter: vi.fn(async (id: bigint, error: string) => {
      dead.push({ id, error });
    }),
    pendingCount: vi.fn(async () => 0),
  };

  return { queue, acked, failed, dead };
}

describe('OutboxWorker', () => {
  it('acks a message its handler processed', async () => {
    const { queue, acked } = buildQueue([message()]);
    const handler: IOutboxHandler = {
      name: 'ok',
      handles: 'SEARCH_UPSERT',
      handle: vi.fn(async () => undefined),
    };

    const worker = new OutboxWorker({ queue, logger: silentLogger }).register(handler);
    await worker.runOnce();

    expect(handler.handle).toHaveBeenCalledOnce();
    expect(acked).toEqual([1n]);
    expect(worker.getStats().processed).toBe(1);
  });

  it('retries with exponential backoff on a transient failure', async () => {
    const { queue, failed, dead } = buildQueue([message({ attempts: 2 })]);
    const worker = new OutboxWorker({ queue, logger: silentLogger }).register({
      name: 'flaky',
      handles: 'SEARCH_UPSERT',
      handle: vi.fn(async () => {
        throw new Error('connection reset');
      }),
    });

    await worker.runOnce();

    expect(dead).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.retryIn).toBeGreaterThan(0);
  });

  it('dead-letters a permanent failure immediately instead of burning retries', async () => {
    const { queue, failed, dead } = buildQueue([message({ attempts: 1 })]);
    const worker = new OutboxWorker({ queue, logger: silentLogger }).register({
      name: 'misconfigured',
      handles: 'SEARCH_UPSERT',
      handle: vi.fn(async () => {
        throw new DependencyError('401 from revalidation endpoint', { permanent: true });
      }),
    });

    await worker.runOnce();

    expect(failed).toHaveLength(0);
    expect(dead).toHaveLength(1);
    expect(worker.getStats().deadLettered).toBe(1);
  });

  it('dead-letters once attempts are exhausted', async () => {
    const { queue, dead } = buildQueue([message({ attempts: 99 })]);
    const worker = new OutboxWorker({ queue, logger: silentLogger }).register({
      name: 'always-fails',
      handles: 'SEARCH_UPSERT',
      handle: vi.fn(async () => {
        throw new Error('still broken');
      }),
    });

    await worker.runOnce();
    expect(dead).toHaveLength(1);
  });

  it('acks an unroutable event rather than leaving a poison row', async () => {
    const { queue, acked } = buildQueue([message({ eventType: 'SITEMAP_PING' })]);
    const worker = new OutboxWorker({ queue, logger: silentLogger });

    await worker.runOnce();

    expect(acked).toEqual([1n]);
    expect(worker.getStats().skipped).toBe(1);
  });

  it('reclaims stranded PROCESSING rows on the first pass', async () => {
    const { queue } = buildQueue([]);
    const reclaimStale = vi.fn(async () => 3);

    const worker = new OutboxWorker({ queue, logger: silentLogger, reclaimStale });
    await worker.runOnce();

    expect(reclaimStale).toHaveBeenCalledWith(DEFAULT_WORKER_OPTIONS.staleAfterMs);
    expect(worker.getStats().reclaimed).toBe(3);
  });

  it('does not reclaim again inside the interval', async () => {
    const { queue } = buildQueue([]);
    const reclaimStale = vi.fn(async () => 0);
    const worker = new OutboxWorker({ queue, logger: silentLogger, reclaimStale });

    await worker.runOnce();
    await worker.runOnce();

    expect(reclaimStale).toHaveBeenCalledOnce();
  });
});

describe('SearchUpsertHandler', () => {
  const search = {
    index: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  } as unknown as ISearchProvider;

  it('removes the document when the source says it should not be indexed', async () => {
    vi.mocked(search.remove).mockClear();
    const registry = new SearchSourceRegistry().register({
      ownerType: 'EXAM',
      entityLabel: 'Exam',
      build: async () => null, // unpublished or deleted
    });

    await new SearchUpsertHandler(registry, search, silentLogger).handle(message());

    expect(search.remove).toHaveBeenCalledWith('EXAM', 'exam_1');
  });

  it('skips quietly when a module has no registered search source', async () => {
    vi.mocked(search.index).mockClear();
    const registry = new SearchSourceRegistry();

    await new SearchUpsertHandler(registry, search, silentLogger).handle(
      message({ ownerType: 'JOB' }),
    );

    expect(search.index).not.toHaveBeenCalled();
  });

  it('indexes the document the source produced', async () => {
    vi.mocked(search.index).mockClear();
    const doc = {
      siteId: 'site_1',
      ownerType: 'EXAM' as const,
      ownerId: 'exam_1',
      locale: 'EN' as const,
      path: '/exam/jee-main',
      title: 'JEE Main',
      entityLabel: 'Exam',
    };
    const registry = new SearchSourceRegistry().register({
      ownerType: 'EXAM',
      entityLabel: 'Exam',
      build: async () => doc,
    });

    await new SearchUpsertHandler(registry, search, silentLogger).handle(message());

    expect(search.index).toHaveBeenCalledWith(doc);
  });

  it('delete handler is repeatable — it only deactivates', async () => {
    vi.mocked(search.remove).mockClear();
    const handler = new SearchDeleteHandler(search);
    await handler.handle(message({ eventType: 'SEARCH_DELETE' }));
    await handler.handle(message({ eventType: 'SEARCH_DELETE' }));
    expect(search.remove).toHaveBeenCalledTimes(2);
  });
});
