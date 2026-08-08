import { describe, expect, it, vi } from 'vitest';

import { BusinessRuleError, GoneError, NotFoundError } from '../../core/errors/app-error.js';
import type { DomainEvent } from '../../core/events/domain-event.js';
import { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SlugRepository } from '../slug/slug.repository.js';
import { SlugService } from '../slug/slug.service.js';

import { BoardService, type BoardRepositoryPort } from './board.service.js';
import type { BoardRecord } from './board.types.js';

/**
 * The Board tests focus on what Board adds over Exam: HIERARCHY. Anything that
 * behaves identically to Exam is already covered by exam.service.test.ts, and
 * duplicating it would just make both suites slower to read.
 */

const baseBoard: BoardRecord = {
  id: 'board_1',
  slug: 'cbse',
  name: 'Central Board of Secondary Education',
  shortName: 'CBSE',
  type: 'CENTRAL',
  stateId: null,
  establishedYear: 1962,
  headquarters: 'New Delhi',
  officialWebsite: 'https://www.cbse.gov.in',
  logoId: null,
  description: 'd'.repeat(200),
  popularityScore: 500,
  status: 'DRAFT',
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  deletedAt: null,
  state: null,
  logo: null,
};

function buildService(
  overrides: {
    record?: BoardRecord | null;
    childSlugs?: string[];
    slugTaken?: boolean;
    history?: { entityId: string; newSlug: string; isActive: boolean } | null;
  } = {},
) {
  const record = overrides.record === undefined ? baseBoard : overrides.record;
  const childSlugs = overrides.childSlugs ?? ['class-10', 'class-12-science', 'class-12-commerce'];
  const captured: DomainEvent[] = [];
  const slugCalls: Array<Record<string, unknown>> = [];
  const cascadeCalls: Array<{ id: string; slug: string }> = [];

  const repository: BoardRepositoryPort = {
    findBySlug: vi.fn(async () => record),
    findById: vi.fn(async () => record),
    findDetailBySlug: vi.fn(async () => (record ? { ...record, classes: [] } : null)),
    listChildSlugs: vi.fn(async () => childSlugs),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    listCursor: vi.fn(async () => []),
    slugExists: vi.fn(async () => overrides.slugTaken ?? false),
    listPopularSlugs: vi.fn(async () => []),
    create: vi.fn(async (data) => ({ ...baseBoard, ...data }) as BoardRecord),
    update: vi.fn(async (_id, data) => ({ ...baseBoard, ...data }) as BoardRecord),
    setStatus: vi.fn(async (_id, status) => ({ ...baseBoard, status }) as BoardRecord),
    softDeleteCascade: vi.fn(async (id: string, slug: string) => {
      cascadeCalls.push({ id, slug });
      return { classes: 12, subjects: 96, chapters: 1240 };
    }),
    restore: vi.fn(async (_id, slug) => ({ ...baseBoard, slug, deletedAt: null }) as BoardRecord),
    runInTransaction: vi.fn(async (fn) => fn('TX')),
  };

  const slugRepository = {
    resolveHistorical: vi.fn(async () => overrides.history ?? null),
    recordChange: vi.fn(async (params: Record<string, unknown>) => {
      slugCalls.push(params);
    }),
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

  const search = {
    query: vi.fn(async () => ({ hits: [], total: 0, tookMs: 1 })),
  } as unknown as ISearchProvider;

  const service = new BoardService({
    repository,
    slugs: new SlugService(slugRepository),
    events,
    cache: new MemoryCacheProvider(),
    search,
    siteId: 'site_1',
  });

  return { service, repository, captured, slugCalls, cascadeCalls };
}

describe('BoardService.changeSlug — hierarchy cascade', () => {
  it('generates redirects for the board AND every class beneath it', async () => {
    const { service, slugCalls } = buildService();

    await service.changeSlug('board_1', 'central-board', 'rebrand');

    const redirects = slugCalls[0]!['redirects'] as Array<{ from: string; to: string }>;

    // The board's own templates...
    expect(redirects).toContainEqual({ from: '/board/cbse', to: '/board/central-board' });
    // ...plus one per live class, which is the part a naive rename would miss.
    expect(redirects).toContainEqual({
      from: '/board/cbse/class-10',
      to: '/board/central-board/class-10',
    });
    expect(redirects).toContainEqual({
      from: '/board/cbse/class-12-science',
      to: '/board/central-board/class-12-science',
    });

    // 3 board templates + 3 classes.
    expect(redirects).toHaveLength(6);
  });

  it('cascades cache tags for old and new child namespaces', async () => {
    const { service, captured } = buildService();
    await service.changeSlug('board_1', 'central-board', 'rebrand');

    const event = captured[0]!;
    expect(event.action).toBe('slug_changed');
    expect(event.cascadeTags).toContain('board:cbse:children');
    expect(event.cascadeTags).toContain('board:central-board:children');
    expect(event.cascadePaths).toContain('/board/cbse/class-10');
  });

  it('does everything inside one transaction', async () => {
    const { service, repository } = buildService();
    await service.changeSlug('board_1', 'central-board', 'rebrand');
    expect(repository.runInTransaction).toHaveBeenCalledOnce();
  });

  it('refuses a reserved slug before opening a transaction', async () => {
    const { service, repository } = buildService();
    await expect(service.changeSlug('board_1', 'admin', 'oops')).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });
});

describe('BoardService.softDelete — subtree cascade', () => {
  it('soft-deletes the class/subject/chapter subtree and reports counts', async () => {
    const { service, cascadeCalls } = buildService();

    const counts = await service.softDelete('board_1');

    expect(cascadeCalls).toHaveLength(1);
    expect(cascadeCalls[0]!.slug).toMatch(/^cbse__d\d+$/);
    expect(counts).toEqual({ classes: 12, subjects: 96, chapters: 1240 });
  });

  it('redirects every orphaned child URL, not just the board page', async () => {
    const { service, slugCalls } = buildService();
    await service.softDelete('board_1');

    const redirects = slugCalls[0]!['redirects'] as Array<{ from: string; to: string }>;
    expect(redirects).toContainEqual({ from: '/board/cbse/class-10', to: '/boards' });
    // Inactive history, so the old URL answers 410 rather than 301 into a 404.
    expect(slugCalls[0]!['isActive']).toBe(false);
  });
});

describe('BoardService — shared conventions still hold', () => {
  it('blocks publishing a board with no real description', async () => {
    const { service } = buildService({ record: { ...baseBoard, description: 'short' } });
    await expect(service.publish('board_1')).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('answers a renamed slug with its new target', async () => {
    const { service } = buildService({
      record: null,
      history: { entityId: 'board_1', newSlug: 'central-board', isActive: true },
    });
    await expect(service.getPublicBySlug('cbse')).rejects.toBeInstanceOf(GoneError);
  });

  it('404s an unknown slug', async () => {
    const { service } = buildService({ record: null, history: null });
    await expect(service.getPublicBySlug('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('serves the second read from cache', async () => {
    const { service, repository } = buildService();
    await service.getPublicBySlug('cbse');
    await service.getPublicBySlug('cbse');
    expect(repository.findDetailBySlug).toHaveBeenCalledOnce();
  });

  it('skips the write when nothing changed', async () => {
    const { service, repository } = buildService();
    await service.update('board_1', { name: baseBoard.name });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
