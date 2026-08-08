import { describe, expect, it, vi } from 'vitest';

import { BusinessRuleError, NotFoundError } from '../../core/errors/app-error.js';
import type { DomainEvent } from '../../core/events/domain-event.js';
import { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { SlugRepository } from '../slug/slug.repository.js';
import { SlugService } from '../slug/slug.service.js';

import { toCategoryTreeDto } from './category.dto.js';
import { CategoryService, type CategoryRepositoryPort } from './category.service.js';
import type { CategoryRecord, CategoryTreeNode } from './category.types.js';

/**
 * These tests target what Category adds over Exam and Board: RECURSION.
 * Cycle prevention, tree assembly, and the delete rules that keep a taxonomy
 * from silently unpublishing content.
 */

const root: CategoryRecord = {
  id: 'cat_root',
  siteId: 'site_1',
  slug: 'exam-prep',
  name: 'Exam Prep',
  type: 'BLOG',
  parentId: null,
  description: 'Guides and strategy',
  order: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  deletedAt: null,
  entryCount: 0,
};

function buildService(
  overrides: {
    record?: CategoryRecord | null;
    byId?: Record<string, CategoryRecord>;
    descendants?: CategoryTreeNode[];
    entryCount?: number;
  } = {},
) {
  const record = overrides.record === undefined ? root : overrides.record;
  const captured: DomainEvent[] = [];
  const slugCalls: Array<Record<string, unknown>> = [];
  const promoteCalls: Array<{ id: string; newParent: string | null }> = [];

  const repository: CategoryRepositoryPort = {
    findBySlug: vi.fn(async () => record),
    findById: vi.fn(async (id: string) => overrides.byId?.[id] ?? record),
    listAncestors: vi.fn(async () => []),
    listDescendants: vi.fn(async () => overrides.descendants ?? []),
    listTree: vi.fn(async () => []),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    slugExists: vi.fn(async () => false),
    countEntries: vi.fn(async () => overrides.entryCount ?? 0),
    create: vi.fn(async (data) => ({ ...root, ...data }) as CategoryRecord),
    update: vi.fn(async (_id, data) => ({ ...root, ...data }) as CategoryRecord),
    softDeleteAndPromoteChildren: vi.fn(async (id: string, parentId: string | null) => {
      promoteCalls.push({ id, newParent: parentId });
      return 3;
    }),
    runInTransaction: vi.fn(async (fn) => fn('TX')),
  };

  const slugRepository = {
    resolveHistorical: vi.fn(async () => null),
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

  const service = new CategoryService({
    repository,
    slugs: new SlugService(slugRepository),
    events,
    cache: new MemoryCacheProvider(),
    siteId: 'site_1',
  });

  return { service, repository, captured, slugCalls, promoteCalls };
}

describe('CategoryService.move — cycle prevention', () => {
  const child: CategoryRecord = { ...root, id: 'cat_child', slug: 'strategy', parentId: 'cat_root' };

  it('refuses to move a node under its own descendant', async () => {
    const { service, repository } = buildService({
      byId: { cat_root: root, cat_child: child },
      descendants: [
        { id: 'cat_child', slug: 'strategy', name: 'Strategy', type: 'BLOG', parentId: 'cat_root', order: 0, depth: 1 },
      ],
    });

    await expect(service.move('cat_root', 'cat_child')).rejects.toThrow(/cycle/i);
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('refuses to make a node its own parent', async () => {
    const { service } = buildService();
    await expect(service.move('cat_root', 'cat_root')).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('refuses to nest a BLOG category under a NEWS category', async () => {
    const newsParent: CategoryRecord = { ...root, id: 'cat_news', type: 'NEWS', slug: 'updates' };
    const { service } = buildService({ byId: { cat_root: root, cat_news: newsParent } });
    await expect(service.move('cat_root', 'cat_news')).rejects.toThrow(/NEWS/);
  });

  it('allows a legitimate move and cascades navigation cache', async () => {
    const parent: CategoryRecord = { ...root, id: 'cat_parent', slug: 'study' };
    const { service, captured } = buildService({
      byId: { cat_root: root, cat_parent: parent },
      descendants: [],
    });

    await service.move('cat_root', 'cat_parent');

    const event = captured[0]!;
    expect(event.changedFields).toEqual(['parentId']);
    expect(event.cascadeTags).toContain('navigation');
  });

  it('rejects reparenting through the ordinary update endpoint', async () => {
    const { service } = buildService();
    await expect(service.update('cat_root', { parentId: 'cat_other' })).rejects.toThrow(
      /move endpoint/,
    );
  });
});

describe('CategoryService.softDelete', () => {
  it('refuses to delete a category that still holds articles', async () => {
    const { service, repository } = buildService({ entryCount: 42 });
    await expect(service.softDelete('cat_root')).rejects.toThrow(/42 article/);
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('promotes children one level instead of cascading the delete', async () => {
    const child = { ...root, id: 'cat_child', parentId: 'cat_root' };
    const { service, promoteCalls } = buildService({ byId: { cat_child: child } });

    const result = await service.softDelete('cat_child');

    // Children are re-parented to the deleted node's parent, not orphaned and
    // not deleted along with it.
    expect(promoteCalls[0]).toEqual({ id: 'cat_child', newParent: 'cat_root' });
    expect(result.promotedChildren).toBe(3);
  });
});

describe('CategoryService.changeSlug', () => {
  it('emits only the redirect matching the category type', async () => {
    const { service, slugCalls } = buildService();
    await service.changeSlug('cat_root', 'exam-preparation', 'clarity');

    const redirects = slugCalls[0]!['redirects'] as Array<{ from: string; to: string }>;
    // ENTITY_PATH_TEMPLATES.CATEGORY holds both /blog/ and /news/ forms; a
    // /news/ redirect for a BLOG category would be a live 301 into a 404.
    expect(redirects).toEqual([{ from: '/blog/exam-prep', to: '/blog/exam-preparation' }]);
  });
});

describe('toCategoryTreeDto', () => {
  it('rebuilds nesting from the flat depth-ordered CTE rows', () => {
    const flat: CategoryTreeNode[] = [
      { id: 'a', slug: 'a', name: 'A', type: 'BLOG', parentId: null, order: 0, depth: 0 },
      { id: 'b', slug: 'b', name: 'B', type: 'BLOG', parentId: null, order: 1, depth: 0 },
      { id: 'a1', slug: 'a1', name: 'A1', type: 'BLOG', parentId: 'a', order: 0, depth: 1 },
      { id: 'a1x', slug: 'a1x', name: 'A1X', type: 'BLOG', parentId: 'a1', order: 0, depth: 2 },
    ];

    const tree = toCategoryTreeDto(flat);

    expect(tree).toHaveLength(2);
    expect(tree[0]!.children[0]!.id).toBe('a1');
    expect(tree[0]!.children[0]!.children[0]!.id).toBe('a1x');
    expect(tree[1]!.children).toHaveLength(0);
    expect(tree[0]!.path).toBe('/blog/a');
  });

  it('drops a node whose parent is missing rather than losing the whole tree', () => {
    const orphaned: CategoryTreeNode[] = [
      { id: 'a', slug: 'a', name: 'A', type: 'BLOG', parentId: null, order: 0, depth: 0 },
      { id: 'x', slug: 'x', name: 'X', type: 'BLOG', parentId: 'missing', order: 0, depth: 1 },
    ];
    const tree = toCategoryTreeDto(orphaned);
    expect(tree.map((n) => n.id)).toEqual(['a', 'x']);
  });
});

describe('CategoryService.getById', () => {
  it('404s an unknown id', async () => {
    const { service } = buildService({ record: null });
    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
