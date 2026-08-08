import { CACHE_TAGS, PERMISSIONS, REVALIDATE, ROUTES } from '@stc/constants';
import type { FacetGroup, FacetedResult, PageMeta, ResultType } from '@stc/types';
import { tombstoneSlug } from '@stc/utils';
import type {
  ResultCreateInput,
  ResultDeclareInput,
  ResultListQuery,
  ResultRetractInput,
  ResultUpdateInput,
} from '@stc/validation';

import { getActorId } from '../../core/context.js';
import {
  BusinessRuleError,
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
import { cacheKey, type ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SlugService } from '../slug/slug.service.js';

import {
  toResultDto,
  toResultListItemDto,
  toResultSnapshot,
  type ResultDto,
  type ResultListItemDto,
} from './result.dto.js';
import { resultEvents } from './result.events.js';
import type { ResultRepository } from './result.repository.js';
import {
  RESULT_FACET_FIELDS,
  type ResultFacetField,
  type ResultFilters,
  type ResultListParams,
  type ResultRecord,
  type ResultWriteData,
} from './result.types.js';

/**
 * Result business logic.
 *
 * What this module stresses: TIME. A result page has two independent lifecycles
 * that most implementations wrongly collapse into one:
 *
 *   status      — is the PAGE live? Published weeks early so it ranks.
 *   isDeclared  — has the RESULT been announced? A distinct transition.
 *
 * "JEE Main Result 2026: Date & Direct Link" goes live in February and
 * accumulates ranking; the result lands in April. Requiring declaration before
 * publication would forfeit two months of it.
 *
 * Faceting reuses `core/query/facet-builder.ts` unchanged — this module was the
 * test of whether that abstraction was real, and it needed nothing new.
 */

export type ResultRepositoryPort = Pick<
  ResultRepository,
  | 'findBySlug'
  | 'findById'
  | 'list'
  | 'listUpcoming'
  | 'facetCounts'
  | 'slugExists'
  | 'create'
  | 'update'
  | 'setStatus'
  | 'declare'
  | 'retract'
  | 'softDelete'
  | 'runInTransaction'
>;

export type ResultServiceDeps = {
  repository: ResultRepositoryPort;
  slugs: SlugService;
  events: EventDispatcher;
  cache: ICacheProvider;
  search: ISearchProvider;
  siteId: string;
  labels?: { exam(id: string): string | undefined; board(id: string): string | undefined };
};

const DELETED_FALLBACK_PATH = ROUTES.results();

/** Declaration day and the 48h either side of it. */
const IMMINENT_WINDOW_MS = 48 * 3_600_000;

export class ResultService {
  constructor(private readonly deps: ResultServiceDeps) {}

  // Reads

  /**
   * Public read with a TIME-DEPENDENT cache TTL.
   *
   * A result page 6 months out changes never; the same page on declaration day
   * changes every few minutes as links and topper data land, and is being
   * refreshed by tens of thousands of students. One fixed TTL cannot serve both
   * — too long and declaration day serves stale "not yet declared"; too short
   * and 20,000 dormant pages hammer the database all year.
   *
   * No new infrastructure: the existing cache provider already takes a TTL.
   */
  async getPublicBySlug(slug: string): Promise<ResultDto> {
    const key = cacheKey('result:detail', slug);
    const cached = await this.deps.cache.get<ResultDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findBySlug(slug, { publicOnly: true });
    if (!record) await this.throwForMissingSlug(slug);

    const dto = toResultDto(record!);
    await this.deps.cache.set(key, dto, {
      ttl: cacheTtlFor(record!),
      tags: [CACHE_TAGS.entity('RESULT', slug), CACHE_TAGS.entityList('RESULT')],
    });
    return dto;
  }

  async getById(id: string): Promise<ResultDto> {
    const record = await this.deps.repository.findById(id, { includeDeleted: true });
    if (!record) throw new NotFoundError('Result', id);
    return toResultDto(record);
  }

  /** Homepage widget: imminent-but-undeclared first, then just-declared. */
  async listUpcoming(withinDays = 30, limit = 10): Promise<ResultListItemDto[]> {
    return this.deps.cache.wrap(
      cacheKey('result:upcoming', withinDays, limit),
      async () => (await this.deps.repository.listUpcoming(withinDays, limit)).map(toResultListItemDto),
      { ttl: REVALIDATE.VOLATILE, tags: [CACHE_TAGS.entityList('RESULT'), CACHE_TAGS.homepage()] },
    );
  }

  async list(
    query: ResultListQuery,
    options: { publicOnly: boolean },
  ): Promise<FacetedResult<ResultListItemDto, PageMeta>> {
    const filters = toFilters(query, options.publicOnly);
    const params: ResultListParams = {
      ...filters,
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    };

    const { items, total } = await this.deps.repository.list(params);
    const facets = query.withFacets ? await this.buildFacets(filters) : [];

    return {
      items: items.map(toResultListItemDto),
      meta: buildOffsetMeta(query.page, query.perPage, total),
      facets,
    };
  }

  /**
   * Identical structure to the paper module's facet builder, by design.
   *
   * The only differences are the field list and the spec map — everything else
   * (disjunctive counting, zero-count retention, selection pinning, caching the
   * unfiltered panel) comes from the shared builder.
   */
  private async buildFacets(filters: ResultFilters): Promise<FacetGroup[]> {
    const specs = resultFacetSpecs(this.deps.labels);
    const unfiltered = !hasActiveFilters(filters);

    const compute = async (): Promise<FacetGroup[]> => {
      const perField = RESULT_FACET_FIELDS.map((field) => ({
        field,
        filters: whereForFacet(filters, field) as ResultFilters,
      }));

      const counts = await this.deps.repository.facetCounts(perField);

      const inputs: FacetInput[] = RESULT_FACET_FIELDS.map((field) => ({
        spec: specs[field],
        counts: counts.get(field) ?? [],
        selected: selectedValuesFor(filters, field),
      }));

      return buildFacetGroups(inputs);
    };

    if (!unfiltered) return compute();

    return this.deps.cache.wrap(cacheKey('result:facets', 'all'), compute, {
      ttl: REVALIDATE.VOLATILE,
      tags: [CACHE_TAGS.entityList('RESULT')],
    });
  }

  async search(query: string, limit: number) {
    return this.deps.search.query({
      siteId: this.deps.siteId,
      query,
      entityLabels: ['Result'],
      limit,
    });
  }

  // Mutations

  async create(input: ResultCreateInput): Promise<ResultDto> {
    const actorId = getActorId();

    const slug = input.slug
      ? await this.assertSlugFree(input.slug)
      : await this.deps.slugs.generate(input.title, (s) => this.deps.repository.slugExists(s), {
          year: input.year,
        });

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const created = await this.deps.repository.create(
        { ...toWriteData(input), slug, createdById: actorId },
        tx,
      );

      await this.deps.events.dispatch(
        resultEvents.created(created, toResultSnapshot(created), actorId),
        tx,
      );
      if (created.status === 'PUBLISHED') {
        await this.deps.events.dispatch(
          resultEvents.published(created, toResultSnapshot(created), actorId),
          tx,
        );
      }
      return created;
    });

    return toResultDto(record);
  }

  async update(id: string, input: ResultUpdateInput): Promise<ResultDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Result', id);

    if (input.expectedVersion !== undefined) {
      const current = before.updatedAt.getTime();
      if (input.expectedVersion !== current) {
        throw new VersionConflictError(input.expectedVersion, current);
      }
    }

    const patch = toPartialWriteData(input);
    const changedFields = Object.keys(patch).filter(
      (key) =>
        String((before as unknown as Record<string, unknown>)[key]) !==
        String((patch as Record<string, unknown>)[key]),
    );
    if (changedFields.length === 0) return toResultDto(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(id, { ...patch, updatedById: actorId }, tx);
      await this.deps.events.dispatch(
        resultEvents.updated(updated, {
          before: toResultSnapshot(before),
          snapshot: toResultSnapshot(updated),
          changedFields,
          actorId,
          // The countdown on the homepage widget depends on expectedAt.
          ...(changedFields.includes('expectedAt')
            ? { cascadeTags: [CACHE_TAGS.homepage()] }
            : {}),
        }),
        tx,
      );
      return updated;
    });

    return toResultDto(record);
  }

  /**
   * The declaration transition — the one moment this whole module exists for.
   *
   * Guarded because a wrong declaration is visible to tens of thousands of
   * students within minutes and is the kind of error that gets screenshotted:
   *   - the page must already be published (declaring a draft helps nobody)
   *   - at least one working link is mandatory
   *   - declaring an already-declared result is a no-op, not an error, because
   *     two operators WILL press the button within the same minute
   */
  async declare(id: string, input: ResultDeclareInput): Promise<ResultDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Result', id);

    if (before.isDeclared) return toResultDto(before);

    if (before.status !== 'PUBLISHED') {
      throw new BusinessRuleError(
        'Publish the result page before declaring the result — a draft page cannot receive traffic',
      );
    }

    const declaredAt = input.declaredAt ?? new Date();
    if (declaredAt.getTime() > Date.now() + 60_000) {
      throw new BusinessRuleError('Declaration time cannot be in the future');
    }

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const declared = await this.deps.repository.declare(
        id,
        {
          declaredAt,
          officialUrl: input.officialUrl ?? before.officialUrl,
          links: input.links,
          statistics: input.statistics ?? null,
          actorId,
        },
        tx,
      );

      // Emitted as `published` rather than `updated`: to every subscriber this
      // is the moment the page becomes worth indexing and pinging. It also
      // forces a search reindex, which `updated` on a PUBLISHED row would do
      // too — but the intent is clearer and the audit copy is honest.
      await this.deps.events.dispatch(
        resultEvents.published(declared, toResultSnapshot(declared), actorId),
        tx,
      );

      await this.deps.events.dispatch(
        resultEvents.updated(declared, {
          before: toResultSnapshot(before),
          snapshot: toResultSnapshot(declared),
          changedFields: ['isDeclared', 'declaredAt', 'links'],
          actorId,
          cascadeTags: [CACHE_TAGS.homepage(), CACHE_TAGS.navigation()],
        }),
        tx,
      );

      return declared;
    });

    return toResultDto(record);
  }

  /** Undo a premature declaration. The reason is mandatory and audited. */
  async retract(id: string, input: ResultRetractInput): Promise<ResultDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Result', id);
    if (!before.isDeclared) throw new BusinessRuleError('This result is not declared');

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const retracted = await this.deps.repository.retract(id, actorId, tx);
      await this.deps.events.dispatch(
        resultEvents.updated(retracted, {
          before: toResultSnapshot(before),
          snapshot: { ...toResultSnapshot(retracted), retractionReason: input.reason },
          changedFields: ['isDeclared', 'declaredAt'],
          actorId,
          cascadeTags: [CACHE_TAGS.homepage()],
        }),
        tx,
      );
      return retracted;
    });

    return toResultDto(record);
  }

  async publish(id: string): Promise<ResultDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Result', id);
    if (before.status === 'PUBLISHED') return toResultDto(before);

    assertPublishable(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const published = await this.deps.repository.setStatus(id, 'PUBLISHED', actorId, tx);
      await this.deps.events.dispatch(
        resultEvents.published(published, toResultSnapshot(published), actorId),
        tx,
      );
      return published;
    });

    return toResultDto(record);
  }

  async unpublish(id: string): Promise<ResultDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Result', id);

    // Unpublishing a declared result removes a page students are actively
    // using. Retract first, so the decision is explicit and reasoned.
    if (before.isDeclared) {
      throw new BusinessRuleError(
        'Retract the declaration before unpublishing a declared result',
      );
    }

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.setStatus(id, 'DRAFT', actorId, tx);
      await this.deps.events.dispatch(resultEvents.unpublished(updated, actorId), tx);
      return updated;
    });

    return toResultDto(record);
  }

  async changeSlug(id: string, newSlug: string, reason: string): Promise<ResultDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Result', id);
    if (before.slug === newSlug) return toResultDto(before);

    await this.deps.slugs.assertAvailable(newSlug, (s) => this.deps.repository.slugExists(s, id));

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        { slug: newSlug, updatedById: actorId },
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'RESULT',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug,
          reason: 'MANUAL_RENAME',
          actorId,
          redirects: this.deps.slugs.buildRedirects('RESULT', before.slug, newSlug),
        },
        tx,
      );

      await this.deps.events.dispatch(
        resultEvents.slugChanged(updated, { oldSlug: before.slug, reason, actorId }),
        tx,
      );

      return updated;
    });

    return toResultDto(record);
  }

  async softDelete(id: string): Promise<void> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Result', id);

    if (before.isDeclared) {
      throw new BusinessRuleError('Retract the declaration before deleting a declared result');
    }

    const tombstone = tombstoneSlug(before.slug);

    await this.deps.repository.runInTransaction(async (tx) => {
      await this.deps.repository.softDelete(id, tombstone, actorId, tx);

      await this.deps.slugs.recordRename(
        {
          entityType: 'RESULT',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug: tombstone,
          reason: 'SOFT_DELETE',
          actorId,
          isActive: false,
          redirects: this.deps.slugs.buildDeletionRedirects(
            'RESULT',
            before.slug,
            DELETED_FALLBACK_PATH,
          ),
        },
        tx,
      );

      await this.deps.events.dispatch(
        resultEvents.deleted(before, { redirectTo: DELETED_FALLBACK_PATH, actorId }),
        tx,
      );
    });
  }

  // Internals

  private async assertSlugFree(slug: string): Promise<string> {
    await this.deps.slugs.assertAvailable(slug, (s) => this.deps.repository.slugExists(s));
    return slug;
  }

  private async throwForMissingSlug(slug: string): Promise<never> {
    const history = await this.deps.slugs.resolveHistorical('RESULT', slug);
    if (history?.isActive) throw new GoneError('Result', ROUTES.result(history.newSlug));
    if (history) throw new GoneError('Result', DELETED_FALLBACK_PATH);
    throw new NotFoundError('Result', slug);
  }
}

// Pure helpers

export type ResultPhase = 'AWAITED' | 'EXPECTED' | 'DECLARED';

/** Derived from the data, not stored — one less field that can disagree. */
export function phaseOf(record: {
  isDeclared: boolean;
  declaredAt: Date | null;
  expectedAt: Date | null;
}): ResultPhase {
  if (record.isDeclared && record.declaredAt) return 'DECLARED';
  if (record.expectedAt) return 'EXPECTED';
  return 'AWAITED';
}

/**
 * Cache TTL by proximity to the declaration moment.
 *
 * Within 48h either side of the expected or actual declaration, the page is
 * volatile and heavily trafficked. Outside that window it is effectively
 * static. Same cache provider, different number.
 */
export function cacheTtlFor(record: {
  isDeclared: boolean;
  declaredAt: Date | null;
  expectedAt: Date | null;
}): number {
  const now = Date.now();

  if (record.isDeclared && record.declaredAt) {
    const since = now - record.declaredAt.getTime();
    return since < IMMINENT_WINDOW_MS ? REVALIDATE.VOLATILE : REVALIDATE.LONG_TAIL;
  }

  if (record.expectedAt) {
    const until = record.expectedAt.getTime() - now;
    // Expected imminently, or overdue — students refresh hardest when a result
    // is late, so an overdue page must not be served stale for an hour.
    if (until < IMMINENT_WINDOW_MS) return REVALIDATE.VOLATILE;
    return REVALIDATE.ENTITY;
  }

  return REVALIDATE.ENTITY;
}

/** A result page with no date and no link is a page that answers nothing. */
export function assertPublishable(record: ResultRecord): void {
  const missing: string[] = [];
  if (!record.expectedAt && !record.isDeclared) missing.push('expectedAt');
  if (!record.examId && !record.boardId) missing.push('examId|boardId');
  if (missing.length > 0) {
    throw new BusinessRuleError(`Cannot publish: ${missing.join(', ')} must be set first`, {
      missing,
    });
  }
}

function resultFacetSpecs(
  labels?: ResultServiceDeps['labels'],
): Record<ResultFacetField, FacetSpec> {
  return {
    year: { field: 'year', label: 'Year', kind: 'multi', sort: 'value-desc', limit: 20, hideZero: true },
    resultType: {
      field: 'resultType',
      label: 'Result type',
      kind: 'multi',
      labelFor: (value) => RESULT_TYPE_LABELS[String(value)] ?? String(value),
      sort: 'count',
      hideZero: true,
    },
    examId: {
      field: 'examId',
      label: 'Exam',
      kind: 'typeahead',
      labelFor: (value) => labels?.exam(String(value)) ?? String(value),
      sort: 'count',
      limit: 15,
      hideZero: true,
    },
    boardId: {
      field: 'boardId',
      label: 'Board',
      kind: 'multi',
      labelFor: (value) => labels?.board(String(value)) ?? String(value),
      sort: 'count',
      limit: 15,
      hideZero: true,
    },
    isDeclared: {
      field: 'isDeclared',
      label: 'Status',
      // The only boolean facet in the system — exercises that FacetKind.
      kind: 'boolean',
      labelFor: (value) => (value === true || value === 'true' ? 'Declared' : 'Awaited'),
      sort: 'count',
    },
  };
}

const RESULT_TYPE_LABELS: Record<string, string> = {
  EXAM: 'Exam result',
  BOARD: 'Board result',
  MERIT_LIST: 'Merit list',
  SCORECARD: 'Scorecard',
};

function hasActiveFilters(filters: ResultFilters): boolean {
  return (
    (filters.year?.length ?? 0) > 0 ||
    (filters.resultType?.length ?? 0) > 0 ||
    (filters.examId?.length ?? 0) > 0 ||
    (filters.boardId?.length ?? 0) > 0 ||
    filters.isDeclared !== undefined ||
    filters.expectedWithinDays !== undefined ||
    Boolean(filters.search)
  );
}

function selectedValuesFor(
  filters: ResultFilters,
  field: ResultFacetField,
): (string | number | boolean)[] {
  if (field === 'isDeclared') {
    return filters.isDeclared === undefined ? [] : [filters.isDeclared];
  }
  return (filters[field] ?? []) as (string | number)[];
}

function toFilters(query: ResultListQuery, publicOnly: boolean): ResultFilters {
  return {
    year: query.year,
    resultType: query.resultType as ResultType[] | undefined,
    examId: query.examId,
    boardId: query.boardId,
    isDeclared: query.isDeclared,
    expectedWithinDays: query.expectedWithinDays,
    search: query.search,
    status: query.status,
    publicOnly,
    includeDeleted: publicOnly ? false : query.includeDeleted,
  };
}

function toWriteData(input: ResultCreateInput): ResultWriteData {
  return {
    title: input.title,
    resultType: input.resultType,
    year: input.year,
    examId: input.examId ?? null,
    examYearId: input.examYearId ?? null,
    boardId: input.boardId ?? null,
    boardClassId: input.boardClassId ?? null,
    expectedAt: input.expectedAt ?? null,
    officialUrl: input.officialUrl || null,
    status: input.status,
  };
}

function toPartialWriteData(input: ResultUpdateInput): Partial<ResultWriteData> {
  const out: Partial<ResultWriteData> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.resultType !== undefined) out.resultType = input.resultType;
  if (input.year !== undefined) out.year = input.year;
  if (input.examId !== undefined) out.examId = input.examId ?? null;
  if (input.examYearId !== undefined) out.examYearId = input.examYearId ?? null;
  if (input.boardId !== undefined) out.boardId = input.boardId ?? null;
  if (input.boardClassId !== undefined) out.boardClassId = input.boardClassId ?? null;
  if (input.expectedAt !== undefined) out.expectedAt = input.expectedAt ?? null;
  if (input.officialUrl !== undefined) out.officialUrl = input.officialUrl || null;
  if (input.status !== undefined) out.status = input.status;
  return out;
}

export const RESULT_PERMISSIONS = {
  manage: PERMISSIONS.RESULT_MANAGE,
  publish: PERMISSIONS.RESULT_PUBLISH,
  declare: PERMISSIONS.RESULT_PUBLISH,
} as const;
