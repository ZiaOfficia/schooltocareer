import { CACHE_TAGS, PERMISSIONS, REVALIDATE } from '@stc/constants';
import type { Paginated } from '@stc/types';
import { tombstoneSlug } from '@stc/utils';
import type { CategoryCreateInput, CategoryListQuery, CategoryUpdateInput } from '@stc/validation';

import { getActorId } from '../../core/context.js';
import {
  BusinessRuleError,
  GoneError,
  NotFoundError,
  VersionConflictError,
} from '../../core/errors/app-error.js';
import type { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { buildOffsetMeta } from '../../core/pagination/paginator.js';
import { cacheKey, type ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { SlugService } from '../slug/slug.service.js';

import {
  toCategoryDto,
  toCategorySnapshot,
  toCategoryTreeDto,
  type CategoryDto,
  type CategoryTreeDto,
} from './category.dto.js';
import { categoryEvents, categoryPath } from './category.events.js';
import type { CategoryRepository } from './category.repository.js';
import type { CategoryListParams, CategoryRecord, CategoryWriteData } from './category.types.js';

/**
 * Category business logic.
 *
 * DOCUMENTED DEVIATION FROM THE MODULE TEMPLATE: there is no publish/unpublish.
 * Category is taxonomy, not content — the launch schema gives it no
 * PublishStatus, and a "draft category" is not a thing an editor means. Every
 * other convention (events, slug history, revisions, cache tags, optimistic
 * concurrency, transaction ownership) applies unchanged.
 *
 * What Category stresses: RECURSION. Reparenting must not create a cycle, and
 * both reparenting and renaming rewrite the URLs of an unbounded subtree.
 */

export type CategoryRepositoryPort = Pick<
  CategoryRepository,
  | 'findBySlug'
  | 'findById'
  | 'listAncestors'
  | 'listDescendants'
  | 'listTree'
  | 'list'
  | 'slugExists'
  | 'countEntries'
  | 'create'
  | 'update'
  | 'softDeleteAndPromoteChildren'
  | 'runInTransaction'
>;

export type CategoryServiceDeps = {
  repository: CategoryRepositoryPort;
  slugs: SlugService;
  events: EventDispatcher;
  cache: ICacheProvider;
  siteId: string;
};

export class CategoryService {
  constructor(private readonly deps: CategoryServiceDeps) {}

  // Reads

  async getPublicBySlug(slug: string): Promise<CategoryDto> {
    const key = cacheKey('category:detail', slug);
    const cached = await this.deps.cache.get<CategoryDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findBySlug(this.deps.siteId, slug);
    if (!record) await this.throwForMissingSlug(slug);

    const ancestors = await this.deps.repository.listAncestors(record!.id);
    const dto = toCategoryDto(record!, ancestors);

    await this.deps.cache.set(key, dto, {
      ttl: REVALIDATE.ENTITY,
      tags: [CACHE_TAGS.entity('CATEGORY', slug), CACHE_TAGS.entityList('CATEGORY'), CACHE_TAGS.navigation()],
    });
    return dto;
  }

  async getById(id: string): Promise<CategoryDto> {
    const record = await this.deps.repository.findById(id, { includeDeleted: true });
    if (!record) throw new NotFoundError('Category', id);
    const ancestors = await this.deps.repository.listAncestors(id);
    return toCategoryDto(record, ancestors);
  }

  /** The navigation menu. Cached under the `navigation` tag. */
  async getTree(type?: string): Promise<CategoryTreeDto[]> {
    const key = cacheKey('category:tree', this.deps.siteId, type ?? 'all');
    return this.deps.cache.wrap(
      key,
      async () => toCategoryTreeDto(await this.deps.repository.listTree(this.deps.siteId, type)),
      { ttl: REVALIDATE.ENTITY, tags: [CACHE_TAGS.navigation(), CACHE_TAGS.entityList('CATEGORY')] },
    );
  }

  async list(query: CategoryListQuery): Promise<Paginated<CategoryDto>> {
    const params: CategoryListParams = {
      siteId: this.deps.siteId,
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      type: query.type,
      parentId: query.parentId,
      rootsOnly: query.rootsOnly,
      search: query.search,
      includeDeleted: query.includeDeleted,
    };

    const { items, total } = await this.deps.repository.list(params);
    return {
      items: items.map((item) => toCategoryDto(item, [])),
      meta: buildOffsetMeta(query.page, query.perPage, total),
    };
  }

  // Mutations

  async create(input: CategoryCreateInput): Promise<CategoryDto> {
    const actorId = getActorId();

    if (input.parentId) await this.assertParentExists(input.parentId, input.type);

    const slug = input.slug
      ? await this.assertSlugFree(input.slug)
      : await this.deps.slugs.generate(input.name, (s) =>
          this.deps.repository.slugExists(this.deps.siteId, s),
        );

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const created = await this.deps.repository.create(
        { ...toWriteData(input), siteId: this.deps.siteId, slug, createdById: actorId },
        tx,
      );
      await this.deps.events.dispatch(
        categoryEvents.created(created, toCategorySnapshot(created), actorId),
        tx,
      );
      return created;
    });

    return toCategoryDto(record, []);
  }

  async update(id: string, input: CategoryUpdateInput): Promise<CategoryDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Category', id);

    if (input.expectedVersion !== undefined) {
      const current = before.updatedAt.getTime();
      if (input.expectedVersion !== current) {
        throw new VersionConflictError(input.expectedVersion, current);
      }
    }

    // Reparenting has its own endpoint — it rewrites descendant URLs and needs
    // the cycle guard, so it must not slip through as an ordinary field edit.
    if (input.parentId !== undefined && (input.parentId ?? null) !== before.parentId) {
      throw new BusinessRuleError('Use the move endpoint to change a category parent');
    }

    const patch = toPartialWriteData(input);
    const changedFields = Object.keys(patch).filter(
      (key) =>
        (before as unknown as Record<string, unknown>)[key] !==
        (patch as Record<string, unknown>)[key],
    );
    if (changedFields.length === 0) return toCategoryDto(before, []);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(id, { ...patch, updatedById: actorId }, tx);
      await this.deps.events.dispatch(
        categoryEvents.updated(updated, {
          before: toCategorySnapshot(before),
          snapshot: toCategorySnapshot(updated),
          changedFields,
          actorId,
          cascadeTags: [CACHE_TAGS.navigation()],
        }),
        tx,
      );
      return updated;
    });

    return toCategoryDto(record, []);
  }

  /**
   * Reparent, with a cycle guard.
   *
   * Moving a node under one of its own descendants creates a ring that no
   * traversal escapes — the recursive CTEs would spin until the depth guard
   * stops them, and the breadcrumb would never terminate. The database cannot
   * express this constraint, so it is enforced here.
   */
  async move(id: string, newParentId: string | null): Promise<CategoryDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Category', id);
    if ((before.parentId ?? null) === newParentId) return toCategoryDto(before, []);

    if (newParentId) {
      if (newParentId === id) {
        throw new BusinessRuleError('A category cannot be its own parent');
      }
      const parent = await this.deps.repository.findById(newParentId);
      if (!parent) throw new NotFoundError('Category', newParentId);
      if (parent.type !== before.type) {
        throw new BusinessRuleError(
          `Cannot move a ${before.type} category under a ${parent.type} category`,
        );
      }

      const descendants = await this.deps.repository.listDescendants(id);
      if (descendants.some((node) => node.id === newParentId)) {
        throw new BusinessRuleError(
          'Cannot move a category under one of its own descendants — that would create a cycle',
        );
      }
    }

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const moved = await this.deps.repository.update(
        id,
        { parentId: newParentId, updatedById: actorId },
        tx,
      );
      await this.deps.events.dispatch(
        categoryEvents.updated(moved, {
          before: toCategorySnapshot(before),
          snapshot: toCategorySnapshot(moved),
          changedFields: ['parentId'],
          actorId,
          // Every descendant's breadcrumb just changed.
          cascadeTags: [CACHE_TAGS.navigation(), CACHE_TAGS.entityChildren('CATEGORY', before.slug)],
        }),
        tx,
      );
      return moved;
    });

    return toCategoryDto(record, []);
  }

  async changeSlug(id: string, newSlug: string, reason: string): Promise<CategoryDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Category', id);
    if (before.slug === newSlug) return toCategoryDto(before, []);

    await this.deps.slugs.assertAvailable(newSlug, (s) =>
      this.deps.repository.slugExists(this.deps.siteId, s, id),
    );

    // ENTITY_PATH_TEMPLATES.CATEGORY carries both /blog/ and /news/ forms;
    // emitting a /news/ redirect for a blog category would be a live 301 to a
    // 404, so the irrelevant one is filtered out.
    const prefix = before.type === 'NEWS' ? '/news/' : '/blog/';
    const redirects = this.deps.slugs
      .buildRedirects('CATEGORY', before.slug, newSlug)
      .filter((redirect) => redirect.from.startsWith(prefix));

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        { slug: newSlug, updatedById: actorId },
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'CATEGORY',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug,
          reason: 'MANUAL_RENAME',
          actorId,
          redirects,
        },
        tx,
      );

      await this.deps.events.dispatch(
        categoryEvents.slugChanged(updated, {
          oldSlug: before.slug,
          reason,
          actorId,
          cascadeTags: [CACHE_TAGS.navigation()],
        }),
        tx,
      );

      return updated;
    });

    return toCategoryDto(record, []);
  }

  /**
   * Delete, promoting children one level rather than cascading.
   *
   * Deleting a category that still holds articles is refused outright: a
   * cascade there would silently unpublish real content, and reassigning
   * silently would hide the decision from the editor who has to make it.
   */
  async softDelete(id: string): Promise<{ promotedChildren: number }> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Category', id);

    const entryCount = await this.deps.repository.countEntries(id);
    if (entryCount > 0) {
      throw new BusinessRuleError(
        `This category still holds ${entryCount} article(s). Move them first.`,
        { entryCount },
      );
    }

    const tombstone = tombstoneSlug(before.slug);

    return this.deps.repository.runInTransaction(async (tx) => {
      const promoted = await this.deps.repository.softDeleteAndPromoteChildren(
        id,
        before.parentId,
        tombstone,
        actorId,
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'CATEGORY',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug: tombstone,
          reason: 'SOFT_DELETE',
          actorId,
          isActive: false,
          redirects: [
            { from: categoryPath(before.type, before.slug), to: before.type === 'NEWS' ? '/news' : '/blog' },
          ],
        },
        tx,
      );

      await this.deps.events.dispatch(
        categoryEvents.deleted(before, {
          redirectTo: before.type === 'NEWS' ? '/news' : '/blog',
          actorId,
        }),
        tx,
      );

      return { promotedChildren: promoted };
    });
  }

  // Internals

  private async assertParentExists(parentId: string, type: string): Promise<void> {
    const parent = await this.deps.repository.findById(parentId);
    if (!parent) throw new NotFoundError('Category', parentId);
    if (parent.type !== type) {
      throw new BusinessRuleError(`Cannot nest a ${type} category under a ${parent.type} category`);
    }
  }

  private async assertSlugFree(slug: string): Promise<string> {
    await this.deps.slugs.assertAvailable(slug, (s) =>
      this.deps.repository.slugExists(this.deps.siteId, s),
    );
    return slug;
  }

  private async throwForMissingSlug(slug: string): Promise<never> {
    const history = await this.deps.slugs.resolveHistorical('CATEGORY', slug);
    if (history?.isActive) throw new GoneError('Category', `/blog/${history.newSlug}`);
    if (history) throw new GoneError('Category', '/blog');
    throw new NotFoundError('Category', slug);
  }
}

function toWriteData(input: CategoryCreateInput): CategoryWriteData {
  return {
    name: input.name,
    type: input.type,
    parentId: input.parentId ?? null,
    description: input.description ?? null,
    order: input.order,
  };
}

function toPartialWriteData(input: CategoryUpdateInput): Partial<CategoryWriteData> {
  const out: Partial<CategoryWriteData> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.type !== undefined) out.type = input.type;
  if (input.description !== undefined) out.description = input.description ?? null;
  if (input.order !== undefined) out.order = input.order;
  return out;
}

export type { CategoryRecord };

export const CATEGORY_PERMISSIONS = {
  manage: PERMISSIONS.CATEGORY_MANAGE,
  changeSlug: PERMISSIONS.CONTENT_CHANGE_SLUG,
} as const;
