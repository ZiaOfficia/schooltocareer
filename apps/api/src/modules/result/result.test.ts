import { describe, expect, it, vi } from 'vitest';

import { REVALIDATE } from '@stc/constants';
import type { FacetCount } from '@stc/types';

import { BusinessRuleError, NotFoundError } from '../../core/errors/app-error.js';
import type { DomainEvent } from '../../core/events/domain-event.js';
import { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SlugRepository } from '../slug/slug.repository.js';
import { SlugService } from '../slug/slug.service.js';

import { cacheTtlFor, phaseOf, ResultService, type ResultRepositoryPort } from './result.service.js';
import type { ResultFacetField, ResultRecord } from './result.types.js';

/**
 * Result is the proving ground for the facet abstraction, so the facet tests
 * here deliberately assert the SAME behaviours as the paper module — if these
 * needed different helpers, the abstraction was wrong.
 *
 * The rest targets what Result adds: two independent lifecycles and
 * time-dependent caching.
 */

const HOUR = 3_600_000;

const baseResult: ResultRecord = {
  id: 'result_1',
  slug: 'jee-main-result-2026',
  title: 'JEE Main Result 2026: Date, Direct Link & Scorecard',
  resultType: 'EXAM',
  year: 2026,
  isDeclared: false,
  declaredAt: null,
  expectedAt: new Date(Date.now() + 30 * 24 * HOUR),
  status: 'PUBLISHED',
  publishedAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: new Date('2026-02-02T00:00:00Z'),
  createdAt: new Date('2026-02-01T00:00:00Z'),
  deletedAt: null,
  examId: 'exam_1',
  examYearId: null,
  boardId: null,
  boardClassId: null,
  officialUrl: 'https://jeemain.nta.nic.in',
  links: null,
  statistics: null,
  exam: { id: 'exam_1', slug: 'jee-main', shortName: 'JEE Main' },
  board: null,
};

function buildService(
  overrides: { record?: ResultRecord | null; facets?: Map<ResultFacetField, FacetCount[]> } = {},
) {
  const record = overrides.record === undefined ? baseResult : overrides.record;
  const captured: DomainEvent[] = [];
  const declareCalls: Array<Record<string, unknown>> = [];
  const facetQueries: Array<{ field: ResultFacetField; filters: Record<string, unknown> }> = [];

  const repository: ResultRepositoryPort = {
    findBySlug: vi.fn(async () => record),
    findById: vi.fn(async () => record),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    listUpcoming: vi.fn(async () => []),
    facetCounts: vi.fn(async (perField) => {
      for (const entry of perField) {
        facetQueries.push({ field: entry.field, filters: entry.filters as Record<string, unknown> });
      }
      return overrides.facets ?? new Map();
    }),
    slugExists: vi.fn(async () => false),
    create: vi.fn(async (data) => ({ ...baseResult, ...data }) as ResultRecord),
    update: vi.fn(async (_id, data) => ({ ...baseResult, ...data }) as ResultRecord),
    setStatus: vi.fn(async (_id, status) => ({ ...baseResult, status }) as ResultRecord),
    declare: vi.fn(async (_id, data) => {
      declareCalls.push(data as unknown as Record<string, unknown>);
      return { ...baseResult, isDeclared: true, declaredAt: data.declaredAt, links: data.links };
    }),
    retract: vi.fn(async () => ({ ...baseResult, isDeclared: false, declaredAt: null })),
    softDelete: vi.fn(async () => undefined),
    runInTransaction: vi.fn(async (fn) => fn('TX')),
  };

  const slugRepository = {
    resolveHistorical: vi.fn(async () => null),
    recordChange: vi.fn(async () => undefined),
    deactivateHistory: vi.fn(async () => undefined),
  } as unknown as SlugRepository;

  const events = new EventDispatcher({ debug: vi.fn(), error: vi.fn() } as never);
  events.register({
    name: 'capture',
    handles: ['created', 'updated', 'published', 'unpublished', 'slug_changed', 'deleted', 'restored'],
    handle: async (event) => {
      captured.push(event);
    },
  });

  const service = new ResultService({
    repository,
    slugs: new SlugService(slugRepository),
    events,
    cache: new MemoryCacheProvider(),
    search: { query: vi.fn(async () => ({ hits: [], total: 0, tookMs: 1 })) } as unknown as ISearchProvider,
    siteId: 'site_1',
  });

  return { service, repository, captured, declareCalls, facetQueries };
}

describe('Result — two independent lifecycles', () => {
  it('publishes the page before the result exists, so it can rank early', async () => {
    const { service } = buildService({ record: { ...baseResult, status: 'DRAFT' } });
    const published = await service.publish('result_1');
    // Published but explicitly not declared: the page is live and awaiting.
    expect(published.status).toBe('PUBLISHED');
    expect(published.isDeclared).toBe(false);
    expect(published.phase).toBe('EXPECTED');
  });

  it('refuses to declare on a draft page', async () => {
    const { service } = buildService({ record: { ...baseResult, status: 'DRAFT' } });
    await expect(
      service.declare('result_1', { links: [{ label: 'Check', url: 'https://x.test/r' }] }),
    ).rejects.toThrow(/Publish the result page before declaring/);
  });

  it('declaration is idempotent — two operators pressing the button is normal', async () => {
    const { service, repository, captured } = buildService({
      record: { ...baseResult, isDeclared: true, declaredAt: new Date() },
    });

    await service.declare('result_1', { links: [{ label: 'Check', url: 'https://x.test/r' }] });

    expect(repository.declare).not.toHaveBeenCalled();
    expect(captured).toHaveLength(0);
  });

  it('rejects a declaration timestamped in the future', async () => {
    const { service } = buildService();
    await expect(
      service.declare('result_1', {
        declaredAt: new Date(Date.now() + 6 * HOUR),
        links: [{ label: 'Check', url: 'https://x.test/r' }],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('emits published on declaration so search and sitemap subscribe', async () => {
    const { service, captured, declareCalls } = buildService();

    await service.declare('result_1', {
      links: [{ label: 'Scorecard', url: 'https://x.test/scorecard' }],
      statistics: { appeared: 1_200_000, passPercentage: 78.2 },
    });

    expect(declareCalls[0]!['links']).toHaveLength(1);
    expect(captured.map((e) => e.action)).toEqual(['published', 'updated']);
    expect(captured[1]!.cascadeTags).toContain('homepage');
  });

  it('blocks unpublishing a declared result until it is retracted', async () => {
    const { service } = buildService({
      record: { ...baseResult, isDeclared: true, declaredAt: new Date() },
    });
    await expect(service.unpublish('result_1')).rejects.toThrow(/Retract the declaration/);
  });

  it('blocks deleting a declared result until it is retracted', async () => {
    const { service } = buildService({
      record: { ...baseResult, isDeclared: true, declaredAt: new Date() },
    });
    await expect(service.softDelete('result_1')).rejects.toThrow(/Retract the declaration/);
  });

  it('retraction requires a reason and records it in the snapshot', async () => {
    const { service, captured } = buildService({
      record: { ...baseResult, isDeclared: true, declaredAt: new Date() },
    });

    await service.retract('result_1', { reason: 'Board withdrew the link' });

    expect(captured[0]!.snapshot?.['retractionReason']).toBe('Board withdrew the link');
  });
});

describe('phaseOf', () => {
  it('derives the phase rather than storing it', () => {
    expect(phaseOf({ isDeclared: false, declaredAt: null, expectedAt: null })).toBe('AWAITED');
    expect(phaseOf({ isDeclared: false, declaredAt: null, expectedAt: new Date() })).toBe('EXPECTED');
    expect(phaseOf({ isDeclared: true, declaredAt: new Date(), expectedAt: null })).toBe('DECLARED');
  });

  it('treats isDeclared without declaredAt as not yet declared', () => {
    // Guards against a partial write leaving the page claiming a declaration
    // it cannot evidence.
    expect(phaseOf({ isDeclared: true, declaredAt: null, expectedAt: null })).toBe('AWAITED');
  });
});

describe('cacheTtlFor — time-dependent caching', () => {
  it('is volatile inside the 48h window before an expected declaration', () => {
    const ttl = cacheTtlFor({
      isDeclared: false,
      declaredAt: null,
      expectedAt: new Date(Date.now() + 6 * HOUR),
    });
    expect(ttl).toBe(REVALIDATE.VOLATILE);
  });

  it('stays volatile when a result is OVERDUE — students refresh hardest then', () => {
    const ttl = cacheTtlFor({
      isDeclared: false,
      declaredAt: null,
      expectedAt: new Date(Date.now() - 3 * HOUR),
    });
    expect(ttl).toBe(REVALIDATE.VOLATILE);
  });

  it('is volatile just after declaration, when links and stats are still landing', () => {
    const ttl = cacheTtlFor({
      isDeclared: true,
      declaredAt: new Date(Date.now() - HOUR),
      expectedAt: null,
    });
    expect(ttl).toBe(REVALIDATE.VOLATILE);
  });

  it('drops to long-tail once the result has settled', () => {
    const ttl = cacheTtlFor({
      isDeclared: true,
      declaredAt: new Date(Date.now() - 30 * 24 * HOUR),
      expectedAt: null,
    });
    expect(ttl).toBe(REVALIDATE.LONG_TAIL);
  });

  it('uses the normal entity TTL for a distant expected result', () => {
    const ttl = cacheTtlFor({
      isDeclared: false,
      declaredAt: null,
      expectedAt: new Date(Date.now() + 90 * 24 * HOUR),
    });
    expect(ttl).toBe(REVALIDATE.ENTITY);
  });
});

describe('Result faceting — reuses the shared builder unchanged', () => {
  it('computes each facet disjunctively, exactly as papers do', async () => {
    const { service, facetQueries } = buildService();

    await service.list(
      {
        page: 1,
        perPage: 20,
        sortBy: 'year',
        sortDir: 'desc',
        withFacets: true,
        includeDeleted: false,
        year: [2026],
        isDeclared: true,
      } as never,
      { publicOnly: true },
    );

    const yearQuery = facetQueries.find((q) => q.field === 'year')!;
    const declaredQuery = facetQueries.find((q) => q.field === 'isDeclared')!;

    expect(yearQuery.filters['year']).toBeUndefined();
    expect(yearQuery.filters['isDeclared']).toBe(true);
    expect(declaredQuery.filters['isDeclared']).toBeUndefined();
    expect(declaredQuery.filters['year']).toEqual([2026]);
  });

  it('supports a boolean facet — the first in the system', async () => {
    const facets = new Map<ResultFacetField, FacetCount[]>([
      ['isDeclared', [{ value: true, count: 120 }, { value: false, count: 45 }]],
    ]);
    const { service } = buildService({ facets });

    const page = await service.list(
      { page: 1, perPage: 20, sortBy: 'year', sortDir: 'desc', withFacets: true, includeDeleted: false } as never,
      { publicOnly: true },
    );

    const group = page.facets.find((f) => f.field === 'isDeclared')!;
    expect(group.kind).toBe('boolean');
    expect(group.buckets.map((b) => b.label)).toEqual(['Declared', 'Awaited']);
  });

  it('skips aggregation when facets are not requested', async () => {
    const { service, repository } = buildService();
    await service.list(
      { page: 1, perPage: 20, sortBy: 'year', sortDir: 'desc', withFacets: false, includeDeleted: false } as never,
      { publicOnly: true },
    );
    expect(repository.facetCounts).not.toHaveBeenCalled();
  });
});

describe('ResultService.getById', () => {
  it('404s an unknown id', async () => {
    const { service } = buildService({ record: null });
    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
