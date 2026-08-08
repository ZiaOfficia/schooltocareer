import { describe, expect, it, vi } from 'vitest';

import { BusinessRuleError, ForbiddenError, NotFoundError, VersionConflictError } from '../../core/errors/app-error.js';
import { runWithContext } from '../../core/context.js';
import type { AuthUser } from '@stc/types';
import type { DomainEvent } from '../../core/events/domain-event.js';
import { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SlugRepository } from '../slug/slug.repository.js';
import { SlugService } from '../slug/slug.service.js';

import { BlogService, type BlogRepositoryPort } from './blog.service.js';
import type { PostRecord } from './blog.types.js';

/**
 * Blog is the editorial workflow module, so the tests target the workflow:
 * autosave vs revisions, scheduling, rollback, and row-level authorship.
 */

const AUTHOR = {
  id: 'user_author',
  email: 'a@test',
  name: 'Author',
  role: 'AUTHOR' as const,
  status: 'ACTIVE' as const,
  permissions: ['content:read', 'content:create', 'content:update-own', 'media:upload'],
};

const EDITOR = {
  ...AUTHOR,
  id: 'user_editor',
  role: 'EDITOR' as const,
  permissions: [...AUTHOR.permissions, 'content:update', 'content:publish', 'content:rollback'],
};

const basePost: PostRecord = {
  id: 'post_1',
  siteId: 'site_1',
  slug: 'how-to-crack-jee-main',
  path: '/blog/exam-prep/how-to-crack-jee-main',
  type: 'ARTICLE',
  title: 'How to Crack JEE Main in Six Months',
  subtitle: null,
  excerpt: 'A realistic six-month plan.',
  bodyHtml: `<p>${'word '.repeat(700)}</p>`,
  bodyJson: null,
  locale: 'EN',
  status: 'DRAFT',
  publishedAt: null,
  readingMinutes: 4,
  isFeatured: false,
  viewCount: 0,
  version: 3,
  updatedAt: new Date('2026-02-02T00:00:00Z'),
  createdAt: new Date('2026-02-01T00:00:00Z'),
  deletedAt: null,
  authorId: AUTHOR.id,
  categoryId: 'cat_1',
  featuredImageId: 'media_1',
  publishedRevisionId: null,
  examId: 'exam_1',
  boardId: null,
  boardClassSubjectId: null,
  chapterId: null,
  author: { id: AUTHOR.id, name: 'Author', slug: 'author' },
  category: { id: 'cat_1', name: 'Exam Prep', slug: 'exam-prep', type: 'BLOG' },
  featuredImage: { id: 'media_1', secureUrl: 'https://cdn/i.jpg', altText: 'x', blurDataUrl: null },
};

function asUser(user: AuthUser, fn: () => Promise<unknown>) {
  return runWithContext(
    {
      requestId: 'r1',
      correlationId: 'r1',
      startedAt: Date.now(),
      method: 'POST',
      path: '/',
      ip: '127.0.0.1',
      user,
    },
    fn,
  );
}

function buildService(overrides: { record?: PostRecord | null; snapshot?: Record<string, unknown> | null } = {}) {
  const record = overrides.record === undefined ? basePost : overrides.record;
  const captured: DomainEvent[] = [];
  const draftSaves: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const publishes: Array<Record<string, unknown>> = [];

  const repository: BlogRepositoryPort = {
    findByPath: vi.fn(async () => record),
    findById: vi.fn(async () => record),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    listCursor: vi.fn(async () => []),
    facetCounts: vi.fn(async () => new Map()),
    slugExists: vi.fn(async () => false),
    listDueForPublication: vi.fn(async () => []),
    create: vi.fn(async (data) => ({ ...basePost, ...data }) as PostRecord),
    update: vi.fn(async (_id, data) => {
      updates.push(data as unknown as Record<string, unknown>);
      return { ...basePost, ...data } as PostRecord;
    }),
    publish: vi.fn(async (_id, params) => {
      publishes.push(params as unknown as Record<string, unknown>);
      return { ...basePost, status: 'PUBLISHED', publishedAt: params.publishedAt } as PostRecord;
    }),
    markPublished: vi.fn(async () => undefined),
    setStatus: vi.fn(async (_id, status) => ({ ...basePost, status }) as PostRecord),
    softDelete: vi.fn(async () => undefined),
    runInTransaction: vi.fn(async (fn) => fn('TX')),
  };

  const events = new EventDispatcher({ debug: vi.fn(), error: vi.fn() } as never);
  events.register({
    name: 'capture',
    handles: ['created', 'updated', 'published', 'unpublished', 'slug_changed', 'deleted', 'restored'],
    handle: async (event) => {
      captured.push(event);
    },
  });

  const service = new BlogService({
    repository,
    drafts: {
      save: vi.fn(async (params) => {
        draftSaves.push(params as unknown as Record<string, unknown>);
        return { id: 'd1', authorId: params.authorId, payload: params.payload, baseVersion: params.baseVersion, savedAt: new Date() };
      }),
      findFor: vi.fn(async () => null),
      listFor: vi.fn(async () => []),
      discard: vi.fn(async () => undefined),
    },
    revisions: {
      listFor: vi.fn(async () => []),
      getSnapshot: vi.fn(async () => overrides.snapshot ?? null),
    },
    slugs: new SlugService({
      resolveHistorical: vi.fn(async () => null),
      recordChange: vi.fn(async () => undefined),
      deactivateHistory: vi.fn(async () => undefined),
    } as unknown as SlugRepository),
    events,
    cache: new MemoryCacheProvider(),
    search: { query: vi.fn(async () => ({ hits: [], total: 0, tookMs: 1 })) } as unknown as ISearchProvider,
    siteId: 'site_1',
  });

  return { service, repository, captured, draftSaves, updates, publishes };
}

describe('BlogService — autosave is not a revision', () => {
  it('writes a draft row and no revision', async () => {
    const { service, captured, draftSaves } = buildService();

    await asUser(AUTHOR, () =>
      service.autosave('post_1', { payload: { title: 'half-written' }, baseVersion: 3 }),
    );

    expect(draftSaves).toHaveLength(1);
    // Autosaving into ContentRevision produces 200 junk rows per article, so an
    // autosave must emit NO event either - the event is what becomes a revision.
    expect(captured).toHaveLength(0);
  });

  it('reports a conflict instead of throwing — never cost the writer their words', async () => {
    const { service } = buildService();

    const result = (await asUser(AUTHOR, () =>
      service.autosave('post_1', { payload: { title: 'x' }, baseVersion: 1 }),
    )) as { conflict: boolean };

    expect(result.conflict).toBe(true);
  });

  it('a manual save DOES write a revision', async () => {
    const { service, captured } = buildService();
    await asUser(EDITOR, () => service.update('post_1', { title: 'A Much Better Title Here' }));
    // Exactly ONE event, so exactly ONE revision. Blog previously appended a
    // revision directly AND emitted this event, producing two rows per save.
    expect(captured).toHaveLength(1);
    expect(captured[0]!.revisionType).toBeUndefined();
  });
});

describe('BlogService — row-level authorship', () => {
  it("stops an author editing someone else's post", async () => {
    const { service } = buildService({ record: { ...basePost, authorId: 'someone_else' } });
    await expect(
      asUser(AUTHOR, () => service.update('post_1', { title: 'Trying To Edit This Post' })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lets an editor edit anyone’s post', async () => {
    const { service } = buildService({ record: { ...basePost, authorId: 'someone_else' } });
    await expect(
      asUser(EDITOR, () => service.update('post_1', { title: 'Editors Can Edit Anything' })),
    ).resolves.toBeDefined();
  });

  it('stops an author publishing', async () => {
    const { service } = buildService();
    await expect(asUser(AUTHOR, () => service.publish('post_1', {}))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a stale expectedVersion', async () => {
    const { service } = buildService();
    await expect(
      asUser(EDITOR, () => service.update('post_1', { title: 'Stale Save Attempt Here', expectedVersion: 1 })),
    ).rejects.toBeInstanceOf(VersionConflictError);
  });
});

describe('BlogService.publish — scheduling needs no extra column', () => {
  it('publishes immediately when no time is given', async () => {
    const { service, captured, publishes } = buildService();
    await asUser(EDITOR, () => service.publish('post_1', {}));

    expect(publishes).toHaveLength(1);
    expect(captured.map((e) => e.action)).toEqual(['published']);
  });

  it('a future time leaves the row DRAFT with publishedAt ahead', async () => {
    const { service, updates, publishes, captured } = buildService();
    const when = new Date(Date.now() + 3 * 86_400_000);

    await asUser(EDITOR, () => service.publish('post_1', { publishAt: when }));

    // Scheduled: the row is updated, NOT published.
    expect(publishes).toHaveLength(0);
    expect(updates[0]!['publishedAt']).toEqual(when);
    // And it must NOT emit `published` — that would index a page nobody can read.
    expect(captured.map((e) => e.action)).toEqual(['updated']);
    expect(captured[0]!.snapshot?.['scheduledFor']).toBe(when.toISOString());
  });

  it('blocks publishing a page that scores too low to deserve indexing', async () => {
    const { service } = buildService({
      record: { ...basePost, bodyHtml: '<p>too short</p>', excerpt: null, featuredImageId: null },
    });
    await expect(asUser(EDITOR, () => service.publish('post_1', {}))).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
  });

  it('reports the indexability score and missing fields on refusal', async () => {
    const { service } = buildService({
      record: { ...basePost, bodyHtml: '<p>thin</p>', excerpt: null, featuredImageId: null, categoryId: null },
    });

    await expect(asUser(EDITOR, () => service.publish('post_1', {}))).rejects.toMatchObject({
      details: expect.objectContaining({ missingFields: expect.arrayContaining(['excerpt']) }),
    });
  });
});

describe('BlogService.rollback', () => {
  it('writes a NEW revision rather than rewinding history', async () => {
    const { service, captured } = buildService({
      snapshot: { title: 'The Original Title', bodyHtml: '<p>original</p>', excerpt: 'orig' },
    });

    await asUser(EDITOR, () => service.rollback('post_1', { version: 2 }));

    // The intent rides on the event; AuditHandler is the sole revision writer.
    expect(captured).toHaveLength(1);
    expect(captured[0]!.revisionType).toBe('ROLLBACK');
    expect(captured[0]!.rollbackOfVersion).toBe(2);
  });

  it('restores only content fields, never identity or audit columns', async () => {
    const { service, updates } = buildService({
      snapshot: {
        title: 'The Original Title',
        bodyHtml: '<p>original</p>',
        id: 'SOMETHING_ELSE',
        authorId: 'ATTACKER',
        status: 'PUBLISHED',
        version: 99,
      },
    });

    await asUser(EDITOR, () => service.rollback('post_1', { version: 2 }));

    const patch = updates[0]!;
    expect(patch['title']).toBe('The Original Title');
    expect(patch['id']).toBeUndefined();
    expect(patch['authorId']).toBeUndefined();
    expect(patch['status']).toBeUndefined();
  });

  it('404s a version that does not exist', async () => {
    const { service } = buildService({ snapshot: null });
    await expect(
      asUser(EDITOR, () => service.rollback('post_1', { version: 99 })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
