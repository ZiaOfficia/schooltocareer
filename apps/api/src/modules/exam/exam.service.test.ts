import { describe, expect, it, vi } from 'vitest';

import { BusinessRuleError, GoneError, NotFoundError, VersionConflictError } from '../../core/errors/app-error.js';
import type { DomainEvent } from '../../core/events/domain-event.js';
import { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import { SlugService } from '../slug/slug.service.js';
import type { SlugRepository } from '../slug/slug.repository.js';

import { ExamService, type ExamRepositoryPort } from './exam.service.js';
import type { ExamRecord } from './exam.types.js';

/**
 * The service is tested with plain object fakes — no database, no Prisma, no
 * container. That is the payoff of every collaborator being a port.
 *
 * These tests assert BEHAVIOUR that would be expensive to discover in
 * production: that a rename writes history and redirects atomically, that a
 * thin page cannot be published, that a renamed URL answers 410-with-target
 * rather than 404.
 */

const baseRecord: ExamRecord = {
  id: 'exam_1',
  slug: 'jee-main',
  name: 'JEE Main',
  shortName: 'JEE Main',
  fullName: 'Joint Entrance Examination Main',
  conductingBody: 'National Testing Agency',
  categoryId: 'cat_1',
  boardId: null,
  level: 'NATIONAL',
  mode: 'ONLINE',
  frequency: 'BIANNUAL',
  educationLevel: 'UNDERGRADUATE',
  officialWebsite: 'https://jeemain.nta.nic.in',
  logoId: null,
  overview: 'x'.repeat(250),
  popularityScore: 100,
  isActive: true,
  status: 'DRAFT',
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  deletedAt: null,
  category: { id: 'cat_1', name: 'Engineering', slug: 'engineering' },
  board: null,
  logo: null,
};

function buildService(overrides: {
  record?: ExamRecord | null;
  slugTaken?: boolean;
  history?: { entityId: string; newSlug: string; isActive: boolean } | null;
} = {}) {
  const record = overrides.record === undefined ? baseRecord : overrides.record;
  const captured: DomainEvent[] = [];
  const slugCalls: Array<Record<string, unknown>> = [];

  const repository: ExamRepositoryPort = {
    findBySlug: vi.fn(async () => record),
    findById: vi.fn(async () => record),
    findDetailBySlug: vi.fn(async () => (record ? { ...record, years: [] } : null)),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    listCursor: vi.fn(async () => []),
    slugExists: vi.fn(async () => overrides.slugTaken ?? false),
    listPopularSlugs: vi.fn(async () => []),
    create: vi.fn(async (data) => ({ ...baseRecord, ...data }) as ExamRecord),
    update: vi.fn(async (_id, data) => ({ ...baseRecord, ...data }) as ExamRecord),
    setStatus: vi.fn(async (_id, status) => ({ ...baseRecord, status }) as ExamRecord),
    softDelete: vi.fn(async () => undefined),
    restore: vi.fn(async (_id, slug) => ({ ...baseRecord, slug, deletedAt: null }) as ExamRecord),
    // A fake transaction: runs the callback with a sentinel handle. Because the
    // service treats the handle as opaque, no database is needed to test it.
    runInTransaction: vi.fn(async (fn) => fn('TX')),
  };

  const slugRepository = {
    resolveHistorical: vi.fn(async () => overrides.history ?? null),
    recordChange: vi.fn(async (params: Record<string, unknown>) => {
      slugCalls.push(params);
    }),
    deactivateHistory: vi.fn(async () => undefined),
  } as unknown as SlugRepository;

  const events = new EventDispatcher({
    debug: vi.fn(),
    error: vi.fn(),
  } as never);
  events.register({
    name: 'capture',
    handles: ['created', 'updated', 'published', 'unpublished', 'slug_changed', 'deleted', 'restored'],
    handle: async (event) => {
      captured.push(event);
    },
  });

  const search = { query: vi.fn(async () => ({ hits: [], total: 0, tookMs: 1 })) } as unknown as ISearchProvider;

  const service = new ExamService({
    repository,
    slugs: new SlugService(slugRepository),
    events,
    cache: new MemoryCacheProvider(),
    search,
    siteId: 'site_1',
  });

  return { service, repository, captured, slugCalls };
}

describe('ExamService.publish', () => {
  it('refuses to publish a page too thin to deserve indexing', async () => {
    const { service } = buildService({ record: { ...baseRecord, overview: 'too short' } });
    await expect(service.publish('exam_1')).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('emits exam.published so search indexing and cache purge can subscribe', async () => {
    const { service, captured } = buildService();
    await service.publish('exam_1');
    expect(captured.map((e) => e.type)).toEqual(['exam.published']);
  });

  it('is idempotent — republishing an already-published exam is a no-op', async () => {
    const { service, captured } = buildService({ record: { ...baseRecord, status: 'PUBLISHED' } });
    await service.publish('exam_1');
    expect(captured).toHaveLength(0);
  });
});

describe('ExamService.changeSlug', () => {
  it('writes history and one redirect per registered sub-path, in one transaction', async () => {
    const { service, repository, slugCalls, captured } = buildService();

    await service.changeSlug('exam_1', 'jee-main-exam', 'rebrand');

    expect(repository.runInTransaction).toHaveBeenCalledOnce();
    expect(slugCalls).toHaveLength(1);
    const call = slugCalls[0]!;
    expect(call['oldSlug']).toBe('jee-main');
    expect(call['newSlug']).toBe('jee-main-exam');

    // ENTITY_PATH_TEMPLATES.EXAM currently has nine entries; the assertion is
    // that every one produced a redirect, not that the number is nine.
    const redirects = call['redirects'] as Array<{ from: string; to: string }>;
    expect(redirects.length).toBeGreaterThan(1);
    expect(redirects[0]).toEqual({ from: '/exam/jee-main', to: '/exam/jee-main-exam' });
    expect(redirects.every((r) => r.from.includes('jee-main') && r.to.includes('jee-main-exam'))).toBe(true);

    expect(captured.map((e) => e.type)).toEqual(['exam.slug_changed']);
  });

  it('rejects a reserved slug before touching the database', async () => {
    const { service, repository } = buildService();
    await expect(service.changeSlug('exam_1', 'admin', 'oops')).rejects.toBeInstanceOf(BusinessRuleError);
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a slug already taken by another exam', async () => {
    const { service } = buildService({ slugTaken: true });
    await expect(service.changeSlug('exam_1', 'neet-ug', 'clash')).rejects.toThrow();
  });
});

describe('ExamService.getPublicBySlug', () => {
  it('answers a renamed slug with the new target instead of a bare 404', async () => {
    const { service } = buildService({
      record: null,
      history: { entityId: 'exam_1', newSlug: 'jee-main-exam', isActive: true },
    });

    await expect(service.getPublicBySlug('jee-main')).rejects.toBeInstanceOf(GoneError);
  });

  it('404s a slug that never existed', async () => {
    const { service } = buildService({ record: null, history: null });
    await expect(service.getPublicBySlug('never-existed')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('serves the second read from cache', async () => {
    const { service, repository } = buildService();
    await service.getPublicBySlug('jee-main');
    await service.getPublicBySlug('jee-main');
    expect(repository.findDetailBySlug).toHaveBeenCalledOnce();
  });
});

describe('ExamService.update', () => {
  it('rejects a stale form submission rather than overwriting a newer edit', async () => {
    const { service } = buildService();
    await expect(
      service.update('exam_1', { name: 'Renamed', expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(VersionConflictError);
  });

  it('skips the write entirely when nothing actually changed', async () => {
    const { service, repository, captured } = buildService();
    await service.update('exam_1', { name: baseRecord.name });
    expect(repository.update).not.toHaveBeenCalled();
    expect(captured).toHaveLength(0);
  });

  it('reports only the fields that really changed', async () => {
    const { service, captured } = buildService();
    await service.update('exam_1', { name: 'JEE Main 2026', shortName: baseRecord.shortName });
    const event = captured[0];
    expect(event?.type).toBe('exam.updated');
    expect(event && 'changedFields' in event ? event.changedFields : []).toEqual(['name']);
  });
});

describe('ExamService.softDelete', () => {
  it('tombstones the slug and records the history as inactive', async () => {
    const { service, slugCalls, captured } = buildService();
    await service.softDelete('exam_1');

    const call = slugCalls[0]!;
    expect(call['oldSlug']).toBe('jee-main');
    expect(String(call['newSlug'])).toMatch(/^jee-main__d\d+$/);
    // Inactive, so the old URL resolves to a 410 rather than a 301 into a 404.
    expect(call['isActive']).toBe(false);
    expect(captured.map((e) => e.type)).toEqual(['exam.deleted']);
  });
});
