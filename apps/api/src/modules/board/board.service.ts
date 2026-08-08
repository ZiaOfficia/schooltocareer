import { CACHE_TAGS, PERMISSIONS, PREBUILD_TOP_N, REVALIDATE, ROUTES } from '@stc/constants';
import type { PageMeta, Paginated } from '@stc/types';
import { tombstoneSlug, untombstoneSlug } from '@stc/utils';
import type { BoardCreateInput, BoardListQuery, BoardUpdateInput } from '@stc/validation';

import { getActorId } from '../../core/context.js';
import {
  BusinessRuleError,
  GoneError,
  NotFoundError,
  VersionConflictError,
} from '../../core/errors/app-error.js';
import type { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { buildCursorPage, buildOffsetMeta } from '../../core/pagination/paginator.js';
import { cacheKey, type ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SlugService } from '../slug/slug.service.js';

import {
  toBoardDetailDto,
  toBoardDto,
  toBoardListItemDto,
  toBoardSnapshot,
  type BoardDetailDto,
  type BoardDto,
  type BoardListItemDto,
} from './board.dto.js';
import { boardEvents } from './board.events.js';
import type { BoardRepository } from './board.repository.js';
import type { BoardCursorParams, BoardListParams, BoardRecord, BoardWriteData } from './board.types.js';

/**
 * Board business logic.
 *
 * Structurally identical to ExamService — same transaction ownership, same
 * emit-events-never-side-effects rule, same port-based dependencies.
 *
 * What Board adds, and what makes it a real test of the abstraction rather than
 * a copy: HIERARCHY. A board owns classes, which own subjects, which own
 * chapters. Two operations have to account for that, and both are handled
 * without new infrastructure:
 *
 *   changeSlug  — every descendant URL changes, so the rename generates
 *                 redirects for child paths too and cascades cache tags.
 *   softDelete  — the subtree must be soft-deleted with it, because
 *                 ON DELETE CASCADE does not fire on an UPDATE.
 */

export type BoardRepositoryPort = Pick<
  BoardRepository,
  | 'findBySlug'
  | 'findById'
  | 'findDetailBySlug'
  | 'listChildSlugs'
  | 'list'
  | 'listCursor'
  | 'slugExists'
  | 'listPopularSlugs'
  | 'create'
  | 'update'
  | 'setStatus'
  | 'softDeleteCascade'
  | 'restore'
  | 'runInTransaction'
>;

export type BoardServiceDeps = {
  repository: BoardRepositoryPort;
  slugs: SlugService;
  events: EventDispatcher;
  cache: ICacheProvider;
  search: ISearchProvider;
  siteId: string;
};

const DELETED_FALLBACK_PATH = ROUTES.boards();

export class BoardService {
  constructor(private readonly deps: BoardServiceDeps) {}

  // Public reads (cache-aside)

  async getPublicBySlug(slug: string): Promise<BoardDetailDto> {
    const key = cacheKey('board:detail', slug);

    const cached = await this.deps.cache.get<BoardDetailDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findDetailBySlug(slug, { publicOnly: true });
    if (!record) await this.throwForMissingSlug(slug);

    const dto = toBoardDetailDto(record!);
    await this.deps.cache.set(key, dto, {
      ttl: REVALIDATE.ENTITY,
      tags: [
        CACHE_TAGS.entity('BOARD', slug),
        CACHE_TAGS.entityList('BOARD'),
        // Tagged as children too, so a class change can purge the parent hub
        // page without knowing the board's cache key.
        CACHE_TAGS.entityChildren('BOARD', slug),
      ],
    });
    return dto;
  }

  async getById(id: string, options: { includeDeleted?: boolean } = {}): Promise<BoardDto> {
    const record = await this.deps.repository.findById(id, options);
    if (!record) throw new NotFoundError('Board', id);
    return toBoardDto(record);
  }

  // Listing

  async list(query: BoardListQuery, options: { publicOnly: boolean }): Promise<Paginated<BoardListItemDto>> {
    const params: BoardListParams = {
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      type: query.type,
      stateId: query.stateId,
      stateSlug: query.stateSlug,
      status: query.status,
      search: query.search,
      publicOnly: options.publicOnly,
      includeDeleted: options.publicOnly ? false : query.includeDeleted,
    };

    const { items, total } = await this.deps.repository.list(params);
    return {
      items: items.map(toBoardListItemDto),
      meta: buildOffsetMeta(query.page, query.perPage, total),
    };
  }

  async listCursor(query: {
    cursor?: string | undefined;
    perPage: number;
    sortBy: string;
    sortDir: 'asc' | 'desc';
  }): Promise<{ items: BoardListItemDto[]; meta: PageMeta }> {
    const params: BoardCursorParams = {
      cursor: query.cursor,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      publicOnly: true,
    };

    const rows = await this.deps.repository.listCursor(params);
    const page = buildCursorPage(rows, {
      perPage: query.perPage,
      sortDir: query.sortDir,
      getSortValue: (row) =>
        (row as unknown as Record<string, string | number | Date>)[query.sortBy] ?? row.id,
      ...(query.cursor !== undefined ? { currentCursor: query.cursor } : {}),
    });

    return { items: page.items.map(toBoardListItemDto), meta: page.meta };
  }

  async search(query: string, limit: number) {
    return this.deps.search.query({
      siteId: this.deps.siteId,
      query,
      entityLabels: ['Board'],
      limit,
    });
  }

  async listPopularSlugs(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.deps.repository.listPopularSlugs(PREBUILD_TOP_N.BOARDS);
  }

  // Mutations

  async create(input: BoardCreateInput): Promise<BoardDto> {
    const actorId = getActorId();

    const slug = input.slug
      ? await this.assertSlugFree(input.slug)
      : await this.deps.slugs.generate(input.name, (s) => this.deps.repository.slugExists(s), {
          qualifier: input.shortName,
        });

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const created = await this.deps.repository.create(
        { ...toWriteData(input), slug, createdById: actorId },
        tx,
      );

      await this.deps.events.dispatch(
        boardEvents.created(created, toBoardSnapshot(created), actorId),
        tx,
      );

      if (created.status === 'PUBLISHED') {
        await this.deps.events.dispatch(
          boardEvents.published(created, toBoardSnapshot(created), actorId),
          tx,
        );
      }

      return created;
    });

    return toBoardDto(record);
  }

  async update(id: string, input: BoardUpdateInput): Promise<BoardDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Board', id);

    if (input.expectedVersion !== undefined) {
      const current = versionOf(before);
      if (input.expectedVersion !== current) {
        throw new VersionConflictError(input.expectedVersion, current);
      }
    }

    const patch = toPartialWriteData(input);
    const changedFields = Object.keys(patch).filter(
      (key) =>
        (before as unknown as Record<string, unknown>)[key] !==
        (patch as Record<string, unknown>)[key],
    );

    if (changedFields.length === 0) return toBoardDto(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(id, { ...patch, updatedById: actorId }, tx);

      await this.deps.events.dispatch(
        boardEvents.updated(updated, {
          before: toBoardSnapshot(before),
          snapshot: toBoardSnapshot(updated),
          changedFields,
          actorId,
          // The board name shows on every class page's breadcrumb.
          cascadeTags: [CACHE_TAGS.entityChildren('BOARD', updated.slug)],
        }),
        tx,
      );

      return updated;
    });

    return toBoardDto(record);
  }

  async publish(id: string): Promise<BoardDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Board', id);
    if (before.status === 'PUBLISHED') return toBoardDto(before);

    assertPublishable(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const published = await this.deps.repository.setStatus(id, 'PUBLISHED', actorId, tx);
      await this.deps.events.dispatch(
        boardEvents.published(published, toBoardSnapshot(published), actorId),
        tx,
      );
      return published;
    });

    return toBoardDto(record);
  }

  async unpublish(id: string): Promise<BoardDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Board', id);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.setStatus(id, 'DRAFT', actorId, tx);
      await this.deps.events.dispatch(boardEvents.unpublished(updated, actorId), tx);
      return updated;
    });

    return toBoardDto(record);
  }

  /**
   * Rename, WITH descendant cascade.
   *
   * `/board/cbse/class-10` becomes `/board/central-board/class-10`. The board's
   * own templates come from ENTITY_PATH_TEMPLATES; the child paths are built
   * here from the live class slugs, because only this service knows which
   * classes exist. All of it lands in one transaction, so a rename can never
   * ship without the redirects that preserve its ranking.
   */
  async changeSlug(id: string, newSlug: string, reason: string): Promise<BoardDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Board', id);
    if (before.slug === newSlug) return toBoardDto(before);

    await this.deps.slugs.assertAvailable(newSlug, (s) => this.deps.repository.slugExists(s, id));

    const childSlugs = await this.deps.repository.listChildSlugs(id);

    const redirects = [
      ...this.deps.slugs.buildRedirects('BOARD', before.slug, newSlug),
      ...childSlugs.map((childSlug) => ({
        from: ROUTES.boardClass(before.slug, childSlug),
        to: ROUTES.boardClass(newSlug, childSlug),
      })),
    ];

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        { slug: newSlug, updatedById: actorId },
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'BOARD',
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
        boardEvents.slugChanged(updated, {
          oldSlug: before.slug,
          reason,
          actorId,
          cascadeTags: [
            CACHE_TAGS.entityChildren('BOARD', before.slug),
            CACHE_TAGS.entityChildren('BOARD', newSlug),
          ],
          cascadePaths: redirects.map((redirect) => redirect.from),
        }),
        tx,
      );

      return updated;
    });

    return toBoardDto(record);
  }

  /**
   * Soft delete, cascading through classes, subjects and chapters.
   *
   * Without the cascade, a deleted board's chapter pages stay published and
   * indexed — reachable by direct URL and still in the sitemap.
   */
  async softDelete(id: string): Promise<{ classes: number; subjects: number; chapters: number }> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Board', id);

    const tombstone = tombstoneSlug(before.slug);
    const childSlugs = await this.deps.repository.listChildSlugs(id);

    return this.deps.repository.runInTransaction(async (tx) => {
      const counts = await this.deps.repository.softDeleteCascade(id, tombstone, actorId, tx);

      const redirects = [
        ...this.deps.slugs.buildDeletionRedirects('BOARD', before.slug, DELETED_FALLBACK_PATH),
        ...childSlugs.map((childSlug) => ({
          from: ROUTES.boardClass(before.slug, childSlug),
          to: DELETED_FALLBACK_PATH,
        })),
      ];

      await this.deps.slugs.recordRename(
        {
          entityType: 'BOARD',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug: tombstone,
          reason: 'SOFT_DELETE',
          actorId,
          isActive: false,
          redirects,
        },
        tx,
      );

      await this.deps.events.dispatch(
        boardEvents.deleted(before, {
          redirectTo: DELETED_FALLBACK_PATH,
          actorId,
          cascadePaths: redirects.map((redirect) => redirect.from),
        }),
        tx,
      );

      return counts;
    });
  }

  async restore(id: string): Promise<BoardDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id, { includeDeleted: true });
    if (!before) throw new NotFoundError('Board', id);
    if (!before.deletedAt) throw new BusinessRuleError('This board is not deleted');

    const original = untombstoneSlug(before.slug);
    if (await this.deps.repository.slugExists(original, id)) {
      throw new BusinessRuleError(
        `The original slug '${original}' is now in use. Restore it under a different slug.`,
      );
    }

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const restored = await this.deps.repository.restore(id, original, actorId, tx);
      await this.deps.events.dispatch(
        boardEvents.restored(restored, toBoardSnapshot(restored), actorId),
        tx,
      );
      return restored;
    });

    return toBoardDto(record);
  }

  // Internals

  private async assertSlugFree(slug: string): Promise<string> {
    await this.deps.slugs.assertAvailable(slug, (s) => this.deps.repository.slugExists(s));
    return slug;
  }

  private async throwForMissingSlug(slug: string): Promise<never> {
    const history = await this.deps.slugs.resolveHistorical('BOARD', slug);
    if (history?.isActive) throw new GoneError('Board', ROUTES.board(history.newSlug));
    if (history) throw new GoneError('Board', DELETED_FALLBACK_PATH);
    throw new NotFoundError('Board', slug);
  }
}

// Pure helpers

/**
 * Publishing gate. A board hub page with no description is a navigation stub —
 * it earns no ranking and dilutes the ones that do.
 */
export function assertPublishable(record: BoardRecord): void {
  const missing: string[] = [];
  if (!record.description || record.description.trim().length < 150) missing.push('description');
  if (!record.shortName) missing.push('shortName');
  if (missing.length > 0) {
    throw new BusinessRuleError(`Cannot publish: ${missing.join(', ')} must be completed first`, {
      missing,
    });
  }
}

function versionOf(record: BoardRecord): number {
  return record.updatedAt.getTime();
}

function toWriteData(input: BoardCreateInput): BoardWriteData {
  return {
    name: input.name,
    shortName: input.shortName,
    type: input.type,
    stateId: input.stateId ?? null,
    establishedYear: input.establishedYear ?? null,
    headquarters: input.headquarters ?? null,
    officialWebsite: input.officialWebsite || null,
    logoId: input.logoId ?? null,
    description: input.description ?? null,
    status: input.status,
  };
}

function toPartialWriteData(input: BoardUpdateInput): Partial<BoardWriteData> {
  const out: Partial<BoardWriteData> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.shortName !== undefined) out.shortName = input.shortName;
  if (input.type !== undefined) out.type = input.type;
  if (input.stateId !== undefined) out.stateId = input.stateId ?? null;
  if (input.establishedYear !== undefined) out.establishedYear = input.establishedYear ?? null;
  if (input.headquarters !== undefined) out.headquarters = input.headquarters ?? null;
  if (input.officialWebsite !== undefined) out.officialWebsite = input.officialWebsite || null;
  if (input.logoId !== undefined) out.logoId = input.logoId ?? null;
  if (input.description !== undefined) out.description = input.description ?? null;
  if (input.status !== undefined) out.status = input.status;
  return out;
}

export const BOARD_PERMISSIONS = {
  manage: PERMISSIONS.BOARD_MANAGE,
  publish: PERMISSIONS.BOARD_MANAGE,
  changeSlug: PERMISSIONS.CONTENT_CHANGE_SLUG,
} as const;
