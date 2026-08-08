import { CACHE_TAGS, PERMISSIONS, REVALIDATE, SEO_LIMITS } from '@stc/constants';
import type { ContentType, FacetGroup, FacetedResult, PageMeta } from '@stc/types';
import {
  buildExcerpt,
  evaluateIndexability,
  readingMinutes,
  tombstoneSlug,
  type IndexabilityResult,
} from '@stc/utils';
import type {
  PostAutosaveInput,
  PostCreateInput,
  PostListQuery,
  PostPublishInput,
  PostRollbackInput,
  PostUpdateInput,
} from '@stc/validation';

import { getActorId, getCurrentUser } from '../../core/context.js';
import {
  BusinessRuleError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  VersionConflictError,
} from '../../core/errors/app-error.js';
import type { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { buildOffsetMeta } from '../../core/pagination/paginator.js';
import {
  buildFacetGroups,
  whereForFacet,
  type FacetInput,
  type FacetSpec,
} from '../../core/query/facet-builder.js';
import { canActOnRow } from '../../middleware/authorize.js';
import { cacheKey, type ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { DraftRepository } from '../draft/draft.repository.js';
import type { RevisionRepository } from '../revision/revision.repository.js';
import type { SlugService } from '../slug/slug.service.js';

import {
  toPostDto,
  toPostListItemDto,
  toPostSnapshot,
  type PostDto,
  type PostListItemDto,
} from './blog.dto.js';
import { postEvents, postPath } from './blog.events.js';
import type { BlogRepository } from './blog.repository.js';
import {
  POST_FACET_FIELDS,
  type PostFacetField,
  type PostFilters,
  type PostListParams,
  type PostRecord,
  type PostWriteData,
} from './blog.types.js';

/**
 * Editorial workflow.
 *
 * This is the module `ContentDraft` and `ContentRevision` were designed for.
 * The workflow that matters:
 *
 *   autosave  -> ContentDraft (one row per editor, overwritten in place)
 *   save      -> ContentRevision(MANUAL)
 *   publish   -> ContentRevision(PUBLISHED) + publishedRevisionId
 *   schedule  -> DRAFT + future publishedAt; a periodic task flips it
 *   rollback  -> a NEW revision built from an old snapshot, then publish
 *
 * Autosave is NOT a revision. Autosaving into ContentRevision produces 200 junk
 * rows per article and makes real history unreadable.
 */

export type BlogRepositoryPort = Pick<
  BlogRepository,
  | 'findByPath'
  | 'findById'
  | 'list'
  | 'listCursor'
  | 'facetCounts'
  | 'slugExists'
  | 'listDueForPublication'
  | 'create'
  | 'update'
  | 'publish'
  | 'markPublished'
  | 'setStatus'
  | 'softDelete'
  | 'runInTransaction'
>;

export type BlogServiceDeps = {
  repository: BlogRepositoryPort;
  drafts: Pick<DraftRepository, 'save' | 'findFor' | 'listFor' | 'discard'>;
  // Read-only: AuditHandler owns every revision WRITE.
  revisions: Pick<RevisionRepository, 'listFor' | 'getSnapshot'>;
  slugs: SlugService;
  events: EventDispatcher;
  cache: ICacheProvider;
  search: ISearchProvider;
  siteId: string;
  labels?: { category(id: string): string | undefined; author(id: string): string | undefined };
};

export class BlogService {
  constructor(private readonly deps: BlogServiceDeps) {}

  // Public reads

  async getPublicByPath(path: string): Promise<PostDto> {
    const key = cacheKey('post:detail', path);
    const cached = await this.deps.cache.get<PostDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findByPath(this.deps.siteId, path, {
      publicOnly: true,
    });
    if (!record) await this.throwForMissingPath(path);

    const dto = toPostDto(record!);
    await this.deps.cache.set(key, dto, {
      ttl: record!.type === 'NEWS' ? REVALIDATE.VOLATILE : REVALIDATE.ENTITY,
      tags: [
        CACHE_TAGS.entity('CONTENT_ENTRY', record!.slug),
        CACHE_TAGS.entityList('CONTENT_ENTRY'),
        ...(record!.category ? [CACHE_TAGS.entity('CATEGORY', record!.category.slug)] : []),
      ],
    });
    return dto;
  }

  /**
   * Preview of unpublished content.
   *
   * Guarded by permission rather than obscurity, and always `no-store` at the
   * controller — a previewed draft that lands in a CDN cache becomes a public
   * page nobody meant to publish.
   */
  async getPreview(id: string): Promise<PostDto> {
    const record = await this.deps.repository.findById(id);
    if (!record) throw new NotFoundError('Post', id);

    this.assertCanEdit(record);

    // The editor's own unsaved work is what they expect to preview, not the
    // last committed state.
    const user = getCurrentUser();
    if (user) {
      const draft = await this.deps.drafts.findFor('CONTENT_ENTRY', id, user.id);
      if (draft) return toPostDto({ ...record, ...(draft.payload as Partial<PostRecord>) });
    }

    return toPostDto(record);
  }

  async getById(id: string): Promise<PostDto> {
    const record = await this.deps.repository.findById(id, { includeDeleted: true });
    if (!record) throw new NotFoundError('Post', id);
    return toPostDto(record);
  }

  async listRevisions(id: string) {
    return this.deps.revisions.listFor('CONTENT_ENTRY', id);
  }

  /** Who else has unsaved work on this post — drives the "also editing" hint. */
  async listActiveDrafts(id: string) {
    const drafts = await this.deps.drafts.listFor('CONTENT_ENTRY', id);
    return drafts.map((draft) => ({
      authorId: draft.authorId,
      savedAt: draft.savedAt.toISOString(),
      baseVersion: draft.baseVersion,
    }));
  }

  // Listing

  async list(
    query: PostListQuery,
    options: { publicOnly: boolean },
  ): Promise<FacetedResult<PostListItemDto, PageMeta>> {
    const filters = toFilters(query, this.deps.siteId, options.publicOnly);
    const params: PostListParams = {
      ...filters,
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    };

    const { items, total } = await this.deps.repository.list(params);
    const facets = query.withFacets ? await this.buildFacets(filters) : [];

    return {
      items: items.map(toPostListItemDto),
      meta: buildOffsetMeta(query.page, query.perPage, total),
      facets,
    };
  }

  private async buildFacets(filters: PostFilters): Promise<FacetGroup[]> {
    const specs = postFacetSpecs(this.deps.labels);

    const perField = POST_FACET_FIELDS.map((field) => ({
      field,
      filters: { ...whereForFacet(filters, field), siteId: filters.siteId } as PostFilters,
    }));

    const counts = await this.deps.repository.facetCounts(perField);

    const inputs: FacetInput[] = POST_FACET_FIELDS.map((field) => ({
      spec: specs[field],
      counts: counts.get(field) ?? [],
      selected: (filters[field] ?? []) as string[],
    }));

    return buildFacetGroups(inputs);
  }

  async search(query: string, limit: number) {
    return this.deps.search.query({
      siteId: this.deps.siteId,
      query,
      entityLabels: ['Article', 'News'],
      limit,
    });
  }

  // Editorial workflow

  async create(input: PostCreateInput): Promise<PostDto> {
    const actorId = getActorId();
    const user = getCurrentUser();
    if (!user) throw new ForbiddenError(PERMISSIONS.CONTENT_CREATE);

    const slug = input.slug
      ? await this.assertSlugFree(input.type, input.slug, input.locale)
      : await this.deps.slugs.generate(input.title, (s) =>
          this.deps.repository.slugExists(this.deps.siteId, input.type, s, input.locale),
        );

    const path = postPath(input.type, null, slug);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const created = await this.deps.repository.create(
        {
          ...toWriteData(input),
          siteId: this.deps.siteId,
          slug,
          path,
          authorId: user.id,
          createdById: actorId,
        },
        tx,
      );

      await this.deps.events.dispatch(
        postEvents.created(created, toPostSnapshot(created), actorId),
        tx,
      );
      return created;
    });

    return toPostDto(record);
  }

  /**
   * Autosave. Never fails on validation, never writes a revision.
   *
   * `baseVersion` is the concurrency guard: if the live record has moved on,
   * the editor is told before their draft silently diverges.
   */
  async autosave(id: string, input: PostAutosaveInput): Promise<{ savedAt: string; conflict: boolean }> {
    const user = getCurrentUser();
    if (!user) throw new ForbiddenError(PERMISSIONS.CONTENT_UPDATE_OWN);

    const record = await this.deps.repository.findById(id);
    if (!record) throw new NotFoundError('Post', id);
    this.assertCanEdit(record);

    const draft = await this.deps.drafts.save({
      ownerType: 'CONTENT_ENTRY',
      ownerId: id,
      authorId: user.id,
      payload: input.payload,
      baseVersion: input.baseVersion,
    });

    // Reported, not thrown: a conflict must never cost the writer their words.
    return { savedAt: draft.savedAt.toISOString(), conflict: record.version !== input.baseVersion };
  }

  async update(id: string, input: PostUpdateInput): Promise<PostDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Post', id);
    this.assertCanEdit(before);

    if (input.expectedVersion !== undefined && input.expectedVersion !== before.version) {
      throw new VersionConflictError(input.expectedVersion, before.version);
    }

    const patch = toPartialWriteData(input);
    const changedFields = Object.keys(patch);
    if (changedFields.length === 0) return toPostDto(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        { ...patch, version: before.version + 1, updatedById: actorId },
        tx,
      );

      // A manual save IS a revision - written by AuditHandler from this event.
      // Appending here as well produced TWO rows and consumed two version
      // numbers for one save.
      await this.deps.events.dispatch(
        postEvents.updated(updated, {
          before: toPostSnapshot(before),
          snapshot: toPostSnapshot(updated),
          changedFields,
          actorId,
        }),
        tx,
      );

      return updated;
    });

    return toPostDto(record);
  }

  /**
   * Publish now, or schedule for later.
   *
   * A future `publishAt` leaves the row DRAFT with `publishedAt` set ahead —
   * the scheduled state, drained by the `publish-scheduled` periodic task. No
   * extra column and no extra status; @@index([status, publishedAt]) exists for
   * exactly this scan.
   */
  async publish(id: string, input: PostPublishInput): Promise<PostDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Post', id);

    const user = getCurrentUser();
    if (!user || !hasPermission(PERMISSIONS.CONTENT_PUBLISH)) {
      throw new ForbiddenError(PERMISSIONS.CONTENT_PUBLISH);
    }

    const audit = this.auditIndexability(before);
    if (!audit.indexable) {
      throw new BusinessRuleError(
        `Cannot publish: this page scores ${audit.score}/100 for indexability`,
        { score: audit.score, missingFields: audit.missingFields, reasons: audit.reasons },
      );
    }

    const publishAt = input.publishAt ?? new Date();
    const scheduled = publishAt.getTime() > Date.now() + 30_000;

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const changeNote =
        input.changeNote ??
        (scheduled ? `Scheduled for ${publishAt.toISOString()}` : 'Published');

      const updated = scheduled
        ? await this.deps.repository.update(
            id,
            { publishedAt: publishAt, updatedById: actorId } as never,
            tx,
          )
        : await this.deps.repository.publish(
            id,
            { publishedAt: publishAt, revisionId: null, actorId },
            tx,
          );

      if (user) await this.deps.drafts.discard('CONTENT_ENTRY', id, user.id, tx);

      // A scheduled post is NOT published yet: emitting `published` now would
      // index and ping a page nobody can read.
      await this.deps.events.dispatch(
        scheduled
          ? postEvents.updated(updated, {
              before: toPostSnapshot(before),
              snapshot: { ...toPostSnapshot(updated), scheduledFor: publishAt.toISOString() },
              changeNote,
              changedFields: ['publishedAt'],
              actorId,
            })
          : postEvents.published(updated, toPostSnapshot(updated), actorId, changeNote),
        tx,
      );

      return updated;
    });

    return toPostDto(record);
  }

  /** Called by the periodic task when a scheduled time arrives. */
  async publishScheduled(post: { id: string; siteId: string; path: string; slug: string }): Promise<void> {
    await this.deps.repository.runInTransaction(async (tx) => {
      await this.deps.repository.markPublished(post.id, tx);
      await this.deps.events.dispatch(
        postEvents.published(post, { id: post.id, slug: post.slug, status: 'PUBLISHED' }, undefined),
        tx,
      );
    });
  }

  async unpublish(id: string): Promise<PostDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Post', id);
    if (!hasPermission(PERMISSIONS.CONTENT_PUBLISH)) {
      throw new ForbiddenError(PERMISSIONS.CONTENT_PUBLISH);
    }

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.setStatus(id, 'DRAFT', actorId, tx);
      await this.deps.events.dispatch(postEvents.unpublished(updated, actorId), tx);
      return updated;
    });

    return toPostDto(record);
  }

  /**
   * Rollback.
   *
   * Writes a NEW revision from the old snapshot rather than rewinding history.
   * You can always roll back a rollback, and the audit trail shows what
   * actually happened rather than pretending an edit never occurred.
   */
  async rollback(id: string, input: PostRollbackInput): Promise<PostDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Post', id);
    this.assertCanEdit(before);

    const snapshot = await this.deps.revisions.getSnapshot('CONTENT_ENTRY', id, input.version);
    if (!snapshot) throw new NotFoundError('Revision', String(input.version));

    const restored = pickRestorableFields(snapshot);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        { ...restored, version: before.version + 1, updatedById: actorId },
        tx,
      );

      await this.deps.events.dispatch(
        postEvents.updated(updated, {
          before: toPostSnapshot(before),
          snapshot: toPostSnapshot(updated),
          changedFields: Object.keys(restored),
          actorId,
          // Declared intent, honoured by AuditHandler - the sole revision writer.
          revisionType: 'ROLLBACK',
          rollbackOfVersion: input.version,
          changeNote: input.changeNote ?? `Rolled back to version ${input.version}`,
        }),
        tx,
      );

      return updated;
    });

    return toPostDto(record);
  }

  async changeSlug(id: string, newSlug: string, reason: string): Promise<PostDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Post', id);
    if (before.slug === newSlug) return toPostDto(before);

    await this.deps.slugs.assertAvailable(newSlug, (s) =>
      this.deps.repository.slugExists(this.deps.siteId, before.type, s, before.locale, id),
    );

    const newPath = postPath(before.type, before.category?.slug ?? null, newSlug);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        { slug: newSlug, path: newPath, updatedById: actorId },
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'CONTENT_ENTRY',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug,
          reason: 'MANUAL_RENAME',
          actorId,
          // ContentEntry stores its canonical path, so the redirect is exact
          // rather than expanded from a template.
          redirects: [{ from: before.path, to: newPath }],
        },
        tx,
      );

      await this.deps.events.dispatch(
        postEvents.slugChanged(updated, { oldSlug: before.slug, reason, actorId }),
        tx,
      );

      return updated;
    });

    return toPostDto(record);
  }

  async softDelete(id: string): Promise<void> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Post', id);
    this.assertCanEdit(before);

    const tombstone = tombstoneSlug(before.slug);

    await this.deps.repository.runInTransaction(async (tx) => {
      await this.deps.repository.softDelete(
        id,
        tombstone,
        `${before.path}__d${Math.floor(Date.now() / 1000)}`,
        actorId,
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'CONTENT_ENTRY',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug: tombstone,
          reason: 'SOFT_DELETE',
          actorId,
          isActive: false,
          redirects: [{ from: before.path, to: before.type === 'NEWS' ? '/news' : '/blog' }],
        },
        tx,
      );

      await this.deps.events.dispatch(
        postEvents.deleted(before, {
          redirectTo: before.type === 'NEWS' ? '/news' : '/blog',
          actorId,
        }),
        tx,
      );
    });
  }

  /**
   * SEO readiness, surfaced BEFORE publish rather than discovered in Search
   * Console. Uses the multi-signal score, not a word-count gate.
   */
  auditIndexability(record: PostRecord): IndexabilityResult {
    return evaluateIndexability({
      kind: record.type === 'NEWS' ? 'NEWS' : record.type === 'NOTE' ? 'NOTE' : 'ARTICLE',
      body: record.bodyHtml ?? '',
      fields: {
        title: record.title,
        excerpt: record.excerpt,
        bodyHtml: record.bodyHtml,
        featuredImageId: record.featuredImageId,
        categoryId: record.categoryId,
        authorId: record.authorId,
        publishedAt: record.publishedAt,
      },
      structuredDataTypes: ['Article', 'BreadcrumbList'],
    });
  }

  // Internals

  /**
   * Row-level authorisation.
   *
   * An AUTHOR may edit only their own drafts; an EDITOR may edit anything. This
   * lives in the service because only the service has the row — attempting it
   * in middleware means fetching the post twice.
   */
  private assertCanEdit(record: PostRecord): void {
    if (
      !canActOnRow({
        broadPermission: PERMISSIONS.CONTENT_UPDATE,
        ownPermission: PERMISSIONS.CONTENT_UPDATE_OWN,
        ownerId: record.authorId,
      })
    ) {
      throw new ForbiddenError(PERMISSIONS.CONTENT_UPDATE);
    }
  }

  private async assertSlugFree(type: string, slug: string, locale: string): Promise<string> {
    await this.deps.slugs.assertAvailable(slug, (s) =>
      this.deps.repository.slugExists(this.deps.siteId, type, s, locale),
    );
    return slug;
  }

  private async throwForMissingPath(path: string): Promise<never> {
    const slug = path.split('/').filter(Boolean).pop() ?? path;
    const history = await this.deps.slugs.resolveHistorical('CONTENT_ENTRY', slug);
    if (history?.isActive) throw new GoneError('Post', `/blog/${history.newSlug}`);
    if (history) throw new GoneError('Post', '/blog');
    throw new NotFoundError('Post', path);
  }
}

// Pure helpers

function hasPermission(permission: string): boolean {
  const user = getCurrentUser();
  return user?.permissions.includes(permission) ?? false;
}

/** Fields a rollback restores. Identity and audit columns are never rewound. */
function pickRestorableFields(snapshot: Record<string, unknown>): Partial<PostWriteData> {
  const allowed: Array<keyof PostWriteData> = [
    'title',
    'subtitle',
    'excerpt',
    'bodyHtml',
    'bodyJson',
    'readingMinutes',
    'categoryId',
    'featuredImageId',
    'isFeatured',
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in snapshot) out[key] = snapshot[key];
  }
  return out as Partial<PostWriteData>;
}

function postFacetSpecs(labels?: BlogServiceDeps['labels']): Record<PostFacetField, FacetSpec> {
  return {
    type: { field: 'type', label: 'Type', kind: 'multi', sort: 'count', hideZero: true },
    categoryId: {
      field: 'categoryId',
      label: 'Category',
      kind: 'multi',
      labelFor: (value) => labels?.category(String(value)) ?? String(value),
      sort: 'count',
      limit: 20,
      hideZero: true,
    },
    authorId: {
      field: 'authorId',
      label: 'Author',
      kind: 'typeahead',
      labelFor: (value) => labels?.author(String(value)) ?? String(value),
      sort: 'count',
      limit: 15,
      hideZero: true,
    },
  };
}

function toFilters(query: PostListQuery, siteId: string, publicOnly: boolean): PostFilters {
  return {
    siteId,
    type: query.type as ContentType[] | undefined,
    categoryId: query.categoryId,
    authorId: query.authorId,
    examId: query.examId,
    boardId: query.boardId,
    isFeatured: query.isFeatured,
    search: query.search,
    status: query.status,
    publicOnly,
    includeDeleted: publicOnly ? false : query.includeDeleted,
  };
}

function toWriteData(input: PostCreateInput): PostWriteData {
  const body = input.bodyHtml ?? null;
  return {
    type: input.type,
    title: input.title,
    subtitle: input.subtitle ?? null,
    // Derived rather than demanded — an editor should not have to hand-write a
    // meta description for every one of 2,000 posts.
    excerpt: input.excerpt ?? (body ? buildExcerpt(body, SEO_LIMITS.DESCRIPTION_MAX) : null),
    bodyHtml: body,
    bodyJson: (input.bodyJson as Record<string, unknown> | null) ?? null,
    readingMinutes: body ? readingMinutes(body) : null,
    locale: input.locale,
    categoryId: input.categoryId ?? null,
    featuredImageId: input.featuredImageId ?? null,
    isFeatured: input.isFeatured,
    examId: input.examId ?? null,
    boardId: input.boardId ?? null,
    boardClassSubjectId: input.boardClassSubjectId ?? null,
    chapterId: input.chapterId ?? null,
  };
}

function toPartialWriteData(input: PostUpdateInput): Partial<PostWriteData> {
  const out: Partial<PostWriteData> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.subtitle !== undefined) out.subtitle = input.subtitle ?? null;
  if (input.excerpt !== undefined) out.excerpt = input.excerpt ?? null;
  if (input.bodyHtml !== undefined) {
    out.bodyHtml = input.bodyHtml ?? null;
    out.readingMinutes = input.bodyHtml ? readingMinutes(input.bodyHtml) : null;
  }
  if (input.bodyJson !== undefined) out.bodyJson = (input.bodyJson as Record<string, unknown>) ?? null;
  if (input.locale !== undefined) out.locale = input.locale;
  if (input.categoryId !== undefined) out.categoryId = input.categoryId ?? null;
  if (input.featuredImageId !== undefined) out.featuredImageId = input.featuredImageId ?? null;
  if (input.isFeatured !== undefined) out.isFeatured = input.isFeatured;
  if (input.examId !== undefined) out.examId = input.examId ?? null;
  if (input.boardId !== undefined) out.boardId = input.boardId ?? null;
  return out;
}

export const BLOG_PERMISSIONS = {
  create: PERMISSIONS.CONTENT_CREATE,
  update: PERMISSIONS.CONTENT_UPDATE,
  updateOwn: PERMISSIONS.CONTENT_UPDATE_OWN,
  publish: PERMISSIONS.CONTENT_PUBLISH,
  rollback: PERMISSIONS.CONTENT_ROLLBACK,
  changeSlug: PERMISSIONS.CONTENT_CHANGE_SLUG,
  delete: PERMISSIONS.CONTENT_DELETE,
} as const;
