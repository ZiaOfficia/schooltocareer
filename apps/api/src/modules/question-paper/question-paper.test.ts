import { describe, expect, it, vi } from 'vitest';

import type { FacetCount } from '@stc/types';

import { BusinessRuleError, NotFoundError } from '../../core/errors/app-error.js';
import type { DomainEvent } from '../../core/events/domain-event.js';
import { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { buildFacetGroup, whereForFacet } from '../../core/query/facet-builder.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SlugRepository } from '../slug/slug.repository.js';
import { SlugService } from '../slug/slug.service.js';

import { QuestionPaperService, type PaperRepositoryPort } from './question-paper.service.js';
import type { PaperFacetField, PaperRecord } from './question-paper.types.js';

/**
 * Two concerns here:
 *   1. The shared facet builder — the abstraction that has to hold for Result,
 *      Search and College, so it is tested directly.
 *   2. What QuestionPaper adds: file versioning and import de-duplication.
 */

const basePaper: PaperRecord = {
  id: 'paper_1',
  slug: 'jee-main-2024-shift-1-physics',
  dedupeKey: 'jee-main|-|-|physics|2024|s1|-|EN|PREVIOUS_YEAR',
  title: 'JEE Main 2024 Shift 1 Physics Question Paper',
  paperType: 'PREVIOUS_YEAR',
  year: 2024,
  shift: 'S1',
  setCode: null,
  locale: 'EN',
  hasSolution: true,
  downloadCount: 4210,
  status: 'DRAFT',
  publishedAt: null,
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  examId: 'exam_1',
  boardId: null,
  boardClassId: null,
  subjectId: 'subject_1',
  totalQuestions: 90,
  totalMarks: 300,
  durationMin: 180,
  exam: { id: 'exam_1', slug: 'jee-main', shortName: 'JEE Main' },
  subject: { id: 'subject_1', slug: 'physics', name: 'Physics' },
  board: null,
  boardClass: null,
  files: [
    {
      id: 'file_1',
      fileRole: 'PAPER',
      locale: 'EN',
      version: 1,
      publishedAt: null,
      media: {
        id: 'media_1',
        secureUrl: 'https://cdn/paper.pdf',
        bytes: 2_400_000n,
        pageCount: 24,
        mimeType: 'application/pdf',
      },
    },
  ],
};

function buildService(
  overrides: {
    record?: PaperRecord | null;
    dedupeHit?: { id: string; slug: string } | null;
    facets?: Map<PaperFacetField, FacetCount[]>;
  } = {},
) {
  const record = overrides.record === undefined ? basePaper : overrides.record;
  const captured: DomainEvent[] = [];
  const fileCalls: Array<Record<string, unknown>> = [];
  const facetQueries: Array<{ field: PaperFacetField; filters: Record<string, unknown> }> = [];

  const repository: PaperRepositoryPort = {
    findBySlug: vi.fn(async () => record),
    findById: vi.fn(async () => record),
    findByDedupeKey: vi.fn(async () => overrides.dedupeHit ?? null),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    listCursor: vi.fn(async () => []),
    facetCounts: vi.fn(async (perField) => {
      for (const entry of perField) {
        facetQueries.push({ field: entry.field, filters: entry.filters as Record<string, unknown> });
      }
      return overrides.facets ?? new Map();
    }),
    slugExists: vi.fn(async () => false),
    create: vi.fn(async (data) => ({ ...basePaper, ...data }) as PaperRecord),
    update: vi.fn(async (_id, data) => ({ ...basePaper, ...data }) as PaperRecord),
    setStatus: vi.fn(async (_id, status) => ({ ...basePaper, status }) as PaperRecord),
    addFileVersion: vi.fn(async (params) => {
      fileCalls.push(params as unknown as Record<string, unknown>);
      return { version: 2 };
    }),
    listFileVersions: vi.fn(async () => []),
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

  const service = new QuestionPaperService({
    repository,
    slugs: new SlugService(slugRepository),
    events,
    cache: new MemoryCacheProvider(),
    search: { query: vi.fn(async () => ({ hits: [], total: 0, tookMs: 1 })) } as unknown as ISearchProvider,
    siteId: 'site_1',
  });

  return { service, repository, captured, fileCalls, facetQueries };
}

describe('facet builder — the shared abstraction', () => {
  const spec = { field: 'year', label: 'Year', kind: 'multi' as const, sort: 'value-desc' as const };

  it('keeps a selected option visible even when it now yields zero results', () => {
    const group = buildFacetGroup({
      spec: { ...spec, hideZero: true },
      counts: [
        { value: 2024, count: 312 },
        { value: 2023, count: 289 },
      ],
      selected: [2019],
    });

    // Without this, the checkbox the user just ticked vanishes and they cannot
    // untick it — the single most common faceted-search bug.
    const bucket = group.buckets.find((b) => b.value === 2019);
    expect(bucket).toBeDefined();
    expect(bucket!.count).toBe(0);
    expect(bucket!.selected).toBe(true);
  });

  it('pins selected options above the display limit', () => {
    const counts: FacetCount[] = Array.from({ length: 30 }, (_, i) => ({
      value: 2024 - i,
      count: 100 - i,
    }));

    const group = buildFacetGroup({
      spec: { ...spec, limit: 5 },
      counts,
      selected: [2000],
    });

    expect(group.buckets[0]!.value).toBe(2000);
    expect(group.buckets).toHaveLength(5);
    expect(group.totalOptions).toBeGreaterThan(5);
  });

  it('sorts years chronologically, not by popularity', () => {
    const group = buildFacetGroup({
      spec,
      counts: [
        { value: 2019, count: 900 },
        { value: 2024, count: 12 },
        { value: 2022, count: 400 },
      ],
      selected: [],
    });

    expect(group.buckets.map((b) => b.value)).toEqual([2024, 2022, 2019]);
  });

  it('drops null aggregation rows', () => {
    const group = buildFacetGroup({
      spec,
      counts: [{ value: null, count: 40 }, { value: 2024, count: 10 }],
      selected: [],
    });
    expect(group.buckets).toHaveLength(1);
  });

  it('whereForFacet removes only the facet’s own filter', () => {
    const filters = { year: [2024], examId: ['e1'], subjectId: ['s1'] };
    expect(whereForFacet(filters, 'year')).toEqual({ examId: ['e1'], subjectId: ['s1'] });
    expect(filters.year).toEqual([2024]);
  });
});

describe('QuestionPaperService.list — disjunctive faceting', () => {
  it('computes each facet against the filters minus its own', async () => {
    const { service, facetQueries } = buildService();

    await service.list(
      {
        page: 1,
        perPage: 20,
        sortBy: 'year',
        sortDir: 'desc',
        withFacets: true,
        includeDeleted: false,
        year: [2024],
        examId: ['exam_1'],
      } as never,
      { publicOnly: true },
    );

    const yearQuery = facetQueries.find((q) => q.field === 'year')!;
    const examQuery = facetQueries.find((q) => q.field === 'examId')!;

    // The year facet must NOT be restricted to 2024, or the user can never
    // switch years. Every other facet still respects it.
    expect(yearQuery.filters['year']).toBeUndefined();
    expect(yearQuery.filters['examId']).toEqual(['exam_1']);
    expect(examQuery.filters['year']).toEqual([2024]);
    expect(examQuery.filters['examId']).toBeUndefined();
  });

  it('skips facet aggregation entirely when not requested', async () => {
    const { service, repository } = buildService();
    await service.list(
      { page: 1, perPage: 20, sortBy: 'year', sortDir: 'desc', withFacets: false, includeDeleted: false } as never,
      { publicOnly: true },
    );
    expect(repository.facetCounts).not.toHaveBeenCalled();
  });

  it('caches the unfiltered panel and recomputes filtered ones', async () => {
    const { service, repository } = buildService();
    const base = { page: 1, perPage: 20, sortBy: 'year', sortDir: 'desc', withFacets: true, includeDeleted: false };

    await service.list(base as never, { publicOnly: true });
    await service.list(base as never, { publicOnly: true });
    // The landing-page panel is computed once, not once per visitor.
    expect(repository.facetCounts).toHaveBeenCalledOnce();

    await service.list({ ...base, year: [2024] } as never, { publicOnly: true });
    expect(repository.facetCounts).toHaveBeenCalledTimes(2);
  });
});

describe('QuestionPaperService — file versioning', () => {
  it('adds a new version rather than overwriting', async () => {
    const { service, fileCalls } = buildService();

    const result = await service.addFile('paper_1', {
      mediaId: 'media_2',
      fileRole: 'PAPER',
      locale: 'EN',
      changeNote: 'Board reissued with corrections',
    });

    expect(result.version).toBe(2);
    expect(fileCalls[0]!['changeNote']).toBe('Board reissued with corrections');
  });

  it('refuses to publish a paper with no file attached', async () => {
    const { service } = buildService({ record: { ...basePaper, files: [] } });
    await expect(service.publish('paper_1')).rejects.toThrow(/no paper file/i);
  });

  it('refuses to publish a paper attached to neither an exam nor a class', async () => {
    const { service } = buildService({
      record: { ...basePaper, examId: null, boardClassId: null },
    });
    await expect(service.publish('paper_1')).rejects.toBeInstanceOf(BusinessRuleError);
  });
});

describe('QuestionPaperService.create — import de-duplication', () => {
  it('rejects a paper whose dedupe key already exists', async () => {
    const { service } = buildService({
      dedupeHit: { id: 'paper_9', slug: 'existing-paper' },
    });

    await expect(
      service.create({
        title: 'JEE Main 2024 Shift 1 Physics',
        paperType: 'PREVIOUS_YEAR',
        year: 2024,
        locale: 'EN',
        status: 'DRAFT',
        examId: 'exam_1',
      } as never),
    ).rejects.toThrow(/identical paper already exists/i);
  });

  it('404s an unknown id', async () => {
    const { service } = buildService({ record: null });
    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
