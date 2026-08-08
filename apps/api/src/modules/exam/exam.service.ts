import { CACHE_TAGS, PERMISSIONS, PREBUILD_TOP_N, REVALIDATE, ROUTES } from '@stc/constants';
import type { Paginated, PageMeta } from '@stc/types';
import { tombstoneSlug, untombstoneSlug } from '@stc/utils';
import type { ExamCreateInput, ExamListQuery, ExamUpdateInput } from '@stc/validation';

import { getActorId } from '../../core/context.js';
import type { EventDispatcher } from '../../core/events/event-dispatcher.js';
import {
  BusinessRuleError,
  GoneError,
  NotFoundError,
  VersionConflictError,
} from '../../core/errors/app-error.js';
import { buildCursorPage, buildOffsetMeta } from '../../core/pagination/paginator.js';
import { cacheKey, type ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SlugService } from '../slug/slug.service.js';

import { examEvents } from './exam.events.js';
import {
  toExamDetailDto,
  toExamDto,
  toExamListItemDto,
  toExamSnapshot,
  type ExamDetailDto,
  type ExamDto,
  type ExamListItemDto,
} from './exam.dto.js';
import type { ExamRepository } from './exam.repository.js';
import type { ExamCursorParams, ExamListParams, ExamRecord, ExamWriteData } from './exam.types.js';

/**
 * Exam business logic.
 *
 * Three conventions this class establishes for every other module:
 *
 *  1. THE SERVICE OWNS THE TRANSACTION BOUNDARY. Repositories take a handle;
 *     they never open one. A mutation and its events must commit together.
 *  2. THE SERVICE EMITS EVENTS; IT DOES NOT PERFORM SIDE EFFECTS. No cache
 *     purge, no search call, no redirect write, no audit line appears below.
 *     Handlers own those, so adding a webhook later touches no service.
 *  3. DEPENDENCIES ARE PORTS. Every collaborator is an interface or a class
 *     used structurally, so the whole class is unit-testable with plain object
 *     fakes and no database.
 */

/** Structural port — a test supplies any object with these methods. */
export type ExamRepositoryPort = Pick<
  ExamRepository,
  | 'findBySlug'
  | 'findById'
  | 'findDetailBySlug'
  | 'list'
  | 'listCursor'
  | 'slugExists'
  | 'listPopularSlugs'
  | 'create'
  | 'update'
  | 'setStatus'
  | 'softDelete'
  | 'restore'
  | 'runInTransaction'
>;

export type ExamServiceDeps = {
  repository: ExamRepositoryPort;
  slugs: SlugService;
  events: EventDispatcher;
  cache: ICacheProvider;
  search: ISearchProvider;
  siteId: string;
};

/** Where an old exam URL points once the exam is gone. */
const DELETED_FALLBACK_PATH = ROUTES.exams();

export class ExamService {
  constructor(private readonly deps: ExamServiceDeps) {}

  // ── Public reads (cache-aside) ────────────────────────────────────────────

  /**
   * Public hub page read.
   *
   * On a miss it also consults SlugHistory, so a renamed exam answers with a
   * 301 target and a deleted one with a 410 — not a bare 404 that would leak
   * accumulated ranking.
   */
  async getPublicBySlug(slug: string): Promise<ExamDetailDto> {
    const key = cacheKey('exam:detail', slug);

    const cached = await this.deps.cache.get<ExamDetailDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findDetailBySlug(slug, { publicOnly: true });

    if (!record) {
      await this.throwForMissingSlug(slug);
    }

    const dto = toExamDetailDto(record!);
    await this.deps.cache.set(key, dto, {
      ttl: REVALIDATE.ENTITY,
      tags: [CACHE_TAGS.entity('EXAM', slug), CACHE_TAGS.entityList('EXAM')],
    });
    return dto;
  }

  /** Admin read — sees drafts, never cached. */
  async getById(id: string, options: { includeDeleted?: boolean } = {}): Promise<ExamDto> {
    const record = await this.deps.repository.findById(id, options);
    if (!record) throw new NotFoundError('Exam', id);
    return toExamDto(record);
  }

  // ── Listing ──────────────────────────────────────────────────────────────

  async list(query: ExamListQuery, options: { publicOnly: boolean }): Promise<Paginated<ExamListItemDto>> {
    const params: ExamListParams = {
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      categoryId: query.categoryId,
      categorySlug: query.categorySlug,
      boardId: query.boardId,
      level: query.level,
      mode: query.mode,
      educationLevel: query.educationLevel,
      status: query.status,
      isActive: query.isActive,
      search: query.search,
      // A client cannot opt into seeing drafts or deleted rows by sending a
      // query parameter — the caller's identity decides, and the route decides
      // which caller reaches this method.
      publicOnly: options.publicOnly,
      includeDeleted: options.publicOnly ? false : query.includeDeleted,
    };

    const { items, total } = await this.deps.repository.list(params);
    return {
      items: items.map(toExamListItemDto),
      meta: buildOffsetMeta(query.page, query.perPage, total),
    };
  }

  /** Cursor feed — the shape every public infinite list uses. */
  async listCursor(
    query: { cursor?: string | undefined; perPage: number; sortBy: string; sortDir: 'asc' | 'desc' },
  ): Promise<{ items: ExamListItemDto[]; meta: PageMeta }> {
    const params: ExamCursorParams = {
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
      getSortValue: (row) => (row as unknown as Record<string, string | number | Date>)[query.sortBy] ?? row.id,
      ...(query.cursor !== undefined ? { currentCursor: query.cursor } : {}),
    });

    return { items: page.items.map(toExamListItemDto), meta: page.meta };
  }

  /** Full-text search, delegated to whichever provider is configured. */
  async search(query: string, limit: number) {
    return this.deps.search.query({
      siteId: this.deps.siteId,
      query,
      entityLabels: ['Exam'],
      limit,
    });
  }

  /** Slugs to prebuild at deploy time. */
  async listPopularSlugs(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.deps.repository.listPopularSlugs(PREBUILD_TOP_N.EXAMS);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  async create(input: ExamCreateInput): Promise<ExamDto> {
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
        examEvents.created(created, toExamSnapshot(created), actorId),
        tx,
      );

      // Creating something already published is one action, not two — emit the
      // publish event as well so search indexing and sitemap pings still fire.
      if (created.status === 'PUBLISHED') {
        await this.deps.events.dispatch(
          examEvents.published(created, toExamSnapshot(created), actorId),
          tx,
        );
      }

      return created;
    });

    return toExamDto(record);
  }

  async update(id: string, input: ExamUpdateInput): Promise<ExamDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Exam', id);

    // Optimistic concurrency. Two editors opened the same form; the second save
    // must fail loudly rather than silently discard the first one's work.
    if (input.expectedVersion !== undefined) {
      const currentVersion = versionOf(before);
      if (input.expectedVersion !== currentVersion) {
        throw new VersionConflictError(input.expectedVersion, currentVersion);
      }
    }

    const patch = toPartialWriteData(input);
    const changedFields = Object.keys(patch).filter(
      (key) => (before as unknown as Record<string, unknown>)[key] !== (patch as Record<string, unknown>)[key],
    );

    if (changedFields.length === 0) return toExamDto(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(id, { ...patch, updatedById: actorId }, tx);

      await this.deps.events.dispatch(
        examEvents.updated(updated, {
          before: toExamSnapshot(before),
          snapshot: toExamSnapshot(updated),
          changedFields,
          actorId,
        }),
        tx,
      );

      return updated;
    });

    return toExamDto(record);
  }

  async publish(id: string): Promise<ExamDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Exam', id);
    if (before.status === 'PUBLISHED') return toExamDto(before);

    assertPublishable(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const published = await this.deps.repository.setStatus(id, 'PUBLISHED', actorId, tx);
      await this.deps.events.dispatch(
        examEvents.published(published, toExamSnapshot(published), actorId),
        tx,
      );
      return published;
    });

    return toExamDto(record);
  }

  async unpublish(id: string): Promise<ExamDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Exam', id);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.setStatus(id, 'DRAFT', actorId, tx);
      await this.deps.events.dispatch(examEvents.unpublished(updated, actorId), tx);
      return updated;
    });

    return toExamDto(record);
  }

  /**
   * Slug rename — the operation that must never be partially applied.
   *
   * In ONE transaction: the new slug, a SlugHistory row, N Redirect rows (one
   * per registered sub-path template), and the events that invalidate caches
   * and reindex. If any step fails, the URL does not change. A rename that
   * lands without its redirects silently discards years of accumulated ranking.
   */
  async changeSlug(id: string, newSlug: string, reason: string): Promise<ExamDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Exam', id);
    if (before.slug === newSlug) return toExamDto(before);

    await this.deps.slugs.assertAvailable(newSlug, (s) => this.deps.repository.slugExists(s, id));

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(id, { slug: newSlug, updatedById: actorId }, tx);

      await this.deps.slugs.recordRename(
        {
          entityType: 'EXAM',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug,
          reason: 'MANUAL_RENAME',
          actorId,
          redirects: this.deps.slugs.buildRedirects('EXAM', before.slug, newSlug),
        },
        tx,
      );

      await this.deps.events.dispatch(
        examEvents.slugChanged(updated, { oldSlug: before.slug, reason, actorId }),
        tx,
      );

      return updated;
    });

    return toExamDto(record);
  }

  /**
   * Soft delete.
   *
   * The slug is tombstoned so it can be reused, SlugHistory records the
   * tombstone as INACTIVE (so the old URL resolves to a 410, not a 301 into a
   * 404), and redirects point at the exam listing so the crawler is not left
   * with a dead end.
   */
  async softDelete(id: string): Promise<void> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Exam', id);

    const tombstone = tombstoneSlug(before.slug);

    await this.deps.repository.runInTransaction(async (tx) => {
      await this.deps.repository.softDelete(id, tombstone, actorId, tx);

      await this.deps.slugs.recordRename(
        {
          entityType: 'EXAM',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug: tombstone,
          reason: 'SOFT_DELETE',
          actorId,
          isActive: false,
          redirects: this.deps.slugs.buildDeletionRedirects('EXAM', before.slug, DELETED_FALLBACK_PATH),
        },
        tx,
      );

      await this.deps.events.dispatch(
        examEvents.deleted(before, { redirectTo: DELETED_FALLBACK_PATH, actorId }),
        tx,
      );
    });
  }

  async restore(id: string): Promise<ExamDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id, { includeDeleted: true });
    if (!before) throw new NotFoundError('Exam', id);
    if (!before.deletedAt) throw new BusinessRuleError('This exam is not deleted');

    // Try to reclaim the original slug; if something took it in the meantime,
    // fail with a clear message rather than silently restoring under a
    // machine-generated URL.
    const original = untombstoneSlug(before.slug);
    if (await this.deps.repository.slugExists(original, id)) {
      throw new BusinessRuleError(
        `The original slug '${original}' is now in use. Restore it under a different slug.`,
      );
    }

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const restored = await this.deps.repository.restore(id, original, actorId, tx);
      await this.deps.events.dispatch(
        examEvents.restored(restored, toExamSnapshot(restored), actorId),
        tx,
      );
      return restored;
    });

    return toExamDto(record);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async assertSlugFree(slug: string): Promise<string> {
    await this.deps.slugs.assertAvailable(slug, (s) => this.deps.repository.slugExists(s));
    return slug;
  }

  /**
   * Turns a miss into the most useful HTTP answer available.
   *   renamed  -> 410 carrying the new path, so the route layer can 301
   *   deleted  -> 410, so the crawler drops it instead of retrying for months
   *   unknown  -> 404
   */
  private async throwForMissingSlug(slug: string): Promise<never> {
    const history = await this.deps.slugs.resolveHistorical('EXAM', slug);
    if (history?.isActive) {
      throw new GoneError('Exam', ROUTES.exam(history.newSlug));
    }
    if (history) throw new GoneError('Exam', DELETED_FALLBACK_PATH);
    throw new NotFoundError('Exam', slug);
  }
}

// ── Pure helpers (trivially testable, no dependencies) ─────────────────────

/**
 * Publishing gate. These are the fields whose absence would put a thin,
 * unhelpful page into the index — cheaper to block here than to explain to
 * Search Console later.
 */
export function assertPublishable(record: ExamRecord): void {
  const missing: string[] = [];
  if (!record.overview || record.overview.trim().length < 200) missing.push('overview');
  if (!record.conductingBody) missing.push('conductingBody');
  if (!record.categoryId) missing.push('category');

  if (missing.length > 0) {
    throw new BusinessRuleError(
      `Cannot publish: ${missing.join(', ')} must be completed first`,
      { missing },
    );
  }
}

/** `updatedAt` as an integer is a sufficient optimistic-concurrency token. */
function versionOf(record: ExamRecord): number {
  return record.updatedAt.getTime();
}

function toWriteData(input: ExamCreateInput): ExamWriteData {
  return {
    name: input.name,
    shortName: input.shortName,
    fullName: input.fullName ?? null,
    conductingBody: input.conductingBody,
    categoryId: input.categoryId ?? null,
    boardId: input.boardId ?? null,
    level: input.level,
    mode: input.mode,
    frequency: input.frequency,
    educationLevel: input.educationLevel,
    officialWebsite: input.officialWebsite || null,
    logoId: input.logoId ?? null,
    overview: input.overview ?? null,
    isActive: input.isActive,
    status: input.status,
  };
}

function toPartialWriteData(input: ExamUpdateInput): Partial<ExamWriteData> {
  const out: Partial<ExamWriteData> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.shortName !== undefined) out.shortName = input.shortName;
  if (input.fullName !== undefined) out.fullName = input.fullName ?? null;
  if (input.conductingBody !== undefined) out.conductingBody = input.conductingBody;
  if (input.categoryId !== undefined) out.categoryId = input.categoryId ?? null;
  if (input.boardId !== undefined) out.boardId = input.boardId ?? null;
  if (input.level !== undefined) out.level = input.level;
  if (input.mode !== undefined) out.mode = input.mode;
  if (input.frequency !== undefined) out.frequency = input.frequency;
  if (input.educationLevel !== undefined) out.educationLevel = input.educationLevel;
  if (input.officialWebsite !== undefined) out.officialWebsite = input.officialWebsite || null;
  if (input.logoId !== undefined) out.logoId = input.logoId ?? null;
  if (input.overview !== undefined) out.overview = input.overview ?? null;
  if (input.isActive !== undefined) out.isActive = input.isActive;
  if (input.status !== undefined) out.status = input.status;
  return out;
}

export const EXAM_PERMISSIONS = {
  manage: PERMISSIONS.EXAM_MANAGE,
  publish: PERMISSIONS.EXAM_PUBLISH,
  changeSlug: PERMISSIONS.CONTENT_CHANGE_SLUG,
} as const;
