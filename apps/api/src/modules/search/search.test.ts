import { describe, expect, it, vi } from 'vitest';

import { BusinessRuleError } from '../../core/errors/app-error.js';
import { SearchSourceRegistry, type ISearchDocumentSource } from '../../core/search/search-source.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { IQueueProvider, OutboxMessage } from '../../providers/queue/queue.provider.js';
import type { ISearchProvider, SearchHit } from '../../providers/search/search.provider.js';

import { SearchService } from './search.service.js';

/**
 * Search is meant to be pure orchestration, so these tests assert exactly that:
 * that it reads entity facts from the REGISTRY and never from a hardcoded list.
 *
 * The strongest test in this file is the last one — registering a brand-new
 * source makes it searchable, filterable and reindexable with no change to
 * SearchService.
 */

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;

function source(
  ownerType: string,
  entityLabel: string,
  options: { searchable?: boolean; ids?: string[] } = {},
): ISearchDocumentSource {
  return {
    ownerType: ownerType as ISearchDocumentSource['ownerType'],
    entityLabel,
    ...(options.searchable === false ? { searchable: false } : {}),
    build: vi.fn(async () => null),
    ...(options.ids
      ? {
          listIndexableIds: vi.fn(async (cursor: string | undefined) =>
            cursor ? { ids: [], nextCursor: null } : { ids: options.ids!, nextCursor: null },
          ),
        }
      : {}),
  };
}

function hit(entityLabel: string, title: string): SearchHit {
  return {
    ownerType: 'EXAM',
    ownerId: 'x',
    path: `/x/${title}`,
    title,
    summary: null,
    entityLabel,
    imageUrl: null,
    highlight: null,
    score: 1,
  };
}

function buildService(
  overrides: {
    sources?: ISearchDocumentSource[];
    hits?: SearchHit[];
    total?: number;
    suggestions?: Array<{ title: string; path: string; entityLabel: string }>;
  } = {},
) {
  const published: OutboxMessage[] = [];
  const logged: Array<{ normalizedQuery: string; resultCount: number }> = [];

  const registry = new SearchSourceRegistry().register(
    ...(overrides.sources ?? [
      source('EXAM', 'Exam', { ids: ['e1', 'e2'] }),
      source('BOARD', 'Board', { ids: ['b1'] }),
      source('QUESTION_PAPER', 'Previous Year Paper'),
      source('CATEGORY', 'Category', { searchable: false }),
    ]),
  );

  const provider: ISearchProvider = {
    name: 'postgres-fts',
    index: vi.fn(async () => undefined),
    indexMany: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    query: vi.fn(async () => ({
      hits: overrides.hits ?? [],
      total: overrides.total ?? (overrides.hits?.length ?? 0),
      tookMs: 3,
    })),
    suggest: vi.fn(async () => overrides.suggestions ?? []),
    healthy: vi.fn(async () => true),
  };

  const queue: IQueueProvider = {
    publish: vi.fn(async () => undefined),
    publishDetached: vi.fn(async (event: OutboxMessage) => {
      published.push(event);
    }),
    claim: vi.fn(async () => []),
    ack: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    deadLetter: vi.fn(async () => undefined),
    pendingCount: vi.fn(async () => 0),
  };

  const service = new SearchService({
    provider,
    registry,
    repository: {
      logQuery: vi.fn(async (params) => {
        logged.push({ normalizedQuery: params.normalizedQuery, resultCount: params.resultCount });
      }),
      topQueries: vi.fn(async () => [{ query: 'jee main', searches: 400 }]),
      zeroResultQueries: vi.fn(async () => [{ query: 'jee main 2027 paper', searches: 12 }]),
    },
    queue,
    cache: new MemoryCacheProvider(),
    logger: silentLogger,
    siteId: 'site_1',
  });

  return { service, provider, registry, published, logged };
}

describe('SearchService — orchestration only', () => {
  it('derives the filterable kinds from the registry, not a hardcoded list', async () => {
    const { service, provider } = buildService();

    await service.search({ q: 'jee main', type: ['Exam', 'Board'], page: 1, perPage: 20 });

    expect(vi.mocked(provider.query).mock.calls[0]![0].entityLabels).toEqual(['Exam', 'Board']);
  });

  it('excludes sources that opted out of site search', async () => {
    const { service } = buildService();
    // Category is crawlable and in the sitemap, but a search for "JEE" should
    // return articles, not the category listing them.
    await expect(
      service.search({ q: 'jee', type: ['Category'], page: 1, perPage: 20 }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('reports the allowed kinds when an unknown one is requested', async () => {
    const { service } = buildService();
    await expect(
      service.search({ q: 'jee', type: ['Spaceship'], page: 1, perPage: 20 }),
    ).rejects.toMatchObject({
      details: { allowed: expect.arrayContaining(['Exam', 'Board']) },
    });
  });

  it('short-circuits a query too short to be meaningful', async () => {
    const { service, provider } = buildService();
    const result = await service.search({ q: 'a', page: 1, perPage: 20 });
    expect(result.hits).toEqual([]);
    expect(provider.query).not.toHaveBeenCalled();
  });

  it('builds the kind facet from the registry, including zero-count kinds', async () => {
    const { service } = buildService({
      hits: [hit('Exam', 'JEE Main'), hit('Exam', 'JEE Advanced')],
      total: 2,
    });

    const result = await service.search({ q: 'jee', page: 1, perPage: 20 });
    const group = result.facets[0]!;

    const labels = group.buckets.map((b) => b.value);
    expect(labels).toContain('Exam');
    // Present with a count of zero rather than missing — a filter that vanishes
    // is a filter the user cannot reason about.
    expect(labels).toContain('Board');
    expect(group.buckets.find((b) => b.value === 'Exam')!.count).toBe(2);
  });

  it('offers suggestions when a search finds nothing', async () => {
    const { service } = buildService({
      hits: [],
      total: 0,
      suggestions: [{ title: 'JEE Main', path: '/exam/jee-main', entityLabel: 'Exam' }],
    });

    const result = await service.search({ q: 'jee mian', page: 1, perPage: 20 });
    expect(result.suggestions).toHaveLength(1);
  });

  it('logs the query — a zero-result search is a content gap', async () => {
    const { service, logged } = buildService({ hits: [], total: 0 });
    await service.search({ q: 'NEET 2027 Answer Key', page: 1, perPage: 20 });

    // Wait a tick for the fire-and-forget log.
    await new Promise((resolve) => setImmediate(resolve));
    expect(logged[0]).toEqual({ normalizedQuery: 'neet 2027 answer key', resultCount: 0 });
  });
});

describe('SearchService.reindex', () => {
  it('enqueues one outbox event per row and reuses the existing worker', async () => {
    const { service, published } = buildService();

    const result = await service.reindex({});

    // No bespoke reindex pipeline: the same SEARCH_UPSERT path an edit takes,
    // so a reindex cannot produce a different document than an edit would.
    expect(published.map((e) => e.eventType)).toEqual([
      'SEARCH_UPSERT',
      'SEARCH_UPSERT',
      'SEARCH_UPSERT',
    ]);
    expect(result.enqueued).toBe(3);
    expect(result.sources).toEqual(['EXAM', 'BOARD']);
  });

  it('skips sources that cannot enumerate their rows', async () => {
    const { service, result } = { ...buildService(), result: null };
    const outcome = await service.reindex({});
    // QUESTION_PAPER registered no listIndexableIds, so it is event-driven only.
    expect(outcome.sources).not.toContain('QUESTION_PAPER');
    expect(result).toBeNull();
  });

  it('can target a single source', async () => {
    const { service, published } = buildService();
    const outcome = await service.reindex({ ownerType: 'BOARD' });
    expect(outcome.sources).toEqual(['BOARD']);
    expect(published).toHaveLength(1);
  });

  it('refuses when nothing matches, and says what is available', async () => {
    const { service } = buildService();
    await expect(service.reindex({ ownerType: 'NOPE' })).rejects.toMatchObject({
      details: { available: expect.arrayContaining(['EXAM', 'BOARD']) },
    });
  });
});

describe('the registry is the only coupling point', () => {
  it('a brand-new source becomes searchable and reindexable with no SearchService change', async () => {
    const { service, published } = buildService({
      sources: [
        source('EXAM', 'Exam', { ids: ['e1'] }),
        // A module that did not exist when SearchService was written.
        source('SCHOLARSHIP', 'Scholarship', { ids: ['s1', 's2'] }),
      ],
    });

    const health = await service.health();
    expect(health.sources).toContain('Scholarship');

    const outcome = await service.reindex({ ownerType: 'SCHOLARSHIP' });
    expect(outcome.enqueued).toBe(2);
    expect(published.every((e) => e.ownerType === 'SCHOLARSHIP')).toBe(true);

    // And it is immediately filterable.
    await expect(
      service.search({ q: 'merit', type: ['Scholarship'], page: 1, perPage: 20 }),
    ).resolves.toBeDefined();
  });
});
