import { CACHE_TAGS, PERMISSIONS, REVALIDATE, ROUTES } from '@stc/constants';
import type { FacetGroup, FacetedResult, PageMeta, PaperType } from '@stc/types';
import { buildPaperDedupeKey, tombstoneSlug } from '@stc/utils';
import type {
  QuestionPaperCreateInput,
  QuestionPaperFeedQuery,
  QuestionPaperFileInput,
  QuestionPaperListQuery,
  QuestionPaperUpdateInput,
} from '@stc/validation';

import { getActorId } from '../../core/context.js';
import {
  BusinessRuleError,
  GoneError,
  NotFoundError,
  VersionConflictError,
} from '../../core/errors/app-error.js';
import type { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { buildCursorPage, buildOffsetMeta } from '../../core/pagination/paginator.js';
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
  toPaperDto,
  toPaperListItemDto,
  toPaperSnapshot,
  type PaperDto,
  type PaperListItemDto,
} from './question-paper.dto.js';
import { paperEvents } from './question-paper.events.js';
import type { QuestionPaperRepository } from './question-paper.repository.js';
import {
  PAPER_FACET_FIELDS,
  type PaperCursorParams,
  type PaperFacetField,
  type PaperFilters,
  type PaperListParams,
  type PaperRecord,
  type PaperWriteData,
} from './question-paper.types.js';

/**
 * QuestionPaper business logic.
 *
 * What this module stresses: VOLUME and FACETING. ~20,000 rows browsed through
 * a filter panel, where the panel itself has to report counts.
 *
 * The facet work lives in `core/query/facet-builder.ts` because Result, Search
 * and College need the identical semantics — not because papers are special.
 */

export type PaperRepositoryPort = Pick<
  QuestionPaperRepository,
  | 'findBySlug'
  | 'findById'
  | 'findByDedupeKey'
  | 'list'
  | 'listCursor'
  | 'facetCounts'
  | 'slugExists'
  | 'create'
  | 'update'
  | 'setStatus'
  | 'addFileVersion'
  | 'listFileVersions'
  | 'softDelete'
  | 'runInTransaction'
>;

export type PaperServiceDeps = {
  repository: PaperRepositoryPort;
  slugs: SlugService;
  events: EventDispatcher;
  cache: ICacheProvider;
  search: ISearchProvider;
  siteId: string;
  /** Resolves ids to display names for facet labels. Injected, so testable. */
  labels?: FacetLabelResolver;
};

export type FacetLabelResolver = {
  exam(id: string): string | undefined;
  board(id: string): string | undefined;
  subject(id: string): string | undefined;
};

const DELETED_FALLBACK_PATH = ROUTES.papers();

/** Facet definitions. The panel's shape lives in one readable place. */
function facetSpecs(labels?: FacetLabelResolver): Record<PaperFacetField, FacetSpec> {
  return {
    year: {
      field: 'year',
      label: 'Year',
      kind: 'multi',
      // Chronological, not by popularity — a year list sorted by count is
      // unreadable, and users scan for a year they already have in mind.
      sort: 'value-desc',
      limit: 25,
      hideZero: true,
    },
    paperType: {
      field: 'paperType',
      label: 'Paper type',
      kind: 'multi',
      labelFor: (value) => PAPER_TYPE_LABELS[String(value)] ?? String(value),
      sort: 'count',
      hideZero: true,
    },
    examId: {
      field: 'examId',
      label: 'Exam',
      // Hundreds of exams: a checkbox list is unusable, so the client renders
      // a typeahead. Cardinality is a server-side decision.
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
    subjectId: {
      field: 'subjectId',
      label: 'Subject',
      kind: 'multi',
      labelFor: (value) => labels?.subject(String(value)) ?? String(value),
      sort: 'count',
      limit: 20,
      hideZero: true,
    },
    shift: { field: 'shift', label: 'Shift', kind: 'multi', sort: 'value-asc', hideZero: true },
    locale: {
      field: 'locale',
      label: 'Language',
      kind: 'multi',
      labelFor: (value) => (value === 'HI' ? 'Hindi' : 'English'),
      sort: 'count',
      hideZero: true,
    },
  };
}

const PAPER_TYPE_LABELS: Record<string, string> = {
  PREVIOUS_YEAR: 'Previous year',
  SAMPLE: 'Sample paper',
  MODEL: 'Model paper',
  MOCK: 'Mock test',
  PRACTICE: 'Practice set',
};

export class QuestionPaperService {
  constructor(private readonly deps: PaperServiceDeps) {}

  // Reads

  async getPublicBySlug(slug: string): Promise<PaperDto> {
    const key = cacheKey('paper:detail', slug);
    const cached = await this.deps.cache.get<PaperDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findBySlug(slug, { publicOnly: true });
    if (!record) await this.throwForMissingSlug(slug);

    const dto = toPaperDto(record!);
    await this.deps.cache.set(key, dto, {
      ttl: REVALIDATE.LONG_TAIL,
      tags: [CACHE_TAGS.entity('QUESTION_PAPER', slug), CACHE_TAGS.entityList('QUESTION_PAPER')],
    });
    return dto;
  }

  async getById(id: string): Promise<PaperDto> {
    const record = await this.deps.repository.findById(id, { includeDeleted: true });
    if (!record) throw new NotFoundError('Question paper', id);
    return toPaperDto(record);
  }

  async listFileVersions(id: string) {
    return this.deps.repository.listFileVersions(id);
  }

  // Faceted browse

  /**
   * The browse surface: a page of results plus the filter panel.
   *
   * Facets are opt-in (`withFacets`). They cost one aggregation per field, and
   * a related-papers strip on an exam page needs the rows but not the panel.
   */
  async list(
    query: QuestionPaperListQuery,
    options: { publicOnly: boolean },
  ): Promise<FacetedResult<PaperListItemDto, PageMeta>> {
    const filters = toFilters(query, options.publicOnly);
    const params: PaperListParams = {
      ...filters,
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    };

    const { items, total } = await this.deps.repository.list(params);

    const facets = query.withFacets ? await this.buildFacets(filters) : [];

    return {
      items: items.map(toPaperListItemDto),
      meta: buildOffsetMeta(query.page, query.perPage, total),
      facets,
    };
  }

  async listCursor(
    query: QuestionPaperFeedQuery,
  ): Promise<{ items: PaperListItemDto[]; meta: PageMeta }> {
    const params: PaperCursorParams = {
      ...toFilters(query, true),
      cursor: query.cursor,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    };

    const rows = await this.deps.repository.listCursor(params);
    const page = buildCursorPage(rows, {
      perPage: query.perPage,
      sortDir: query.sortDir,
      getSortValue: (row) =>
        (row as unknown as Record<string, string | number | Date>)[query.sortBy] ?? row.id,
      ...(query.cursor !== undefined ? { currentCursor: query.cursor } : {}),
    });

    return { items: page.items.map(toPaperListItemDto), meta: page.meta };
  }

  /**
   * Builds the filter panel, disjunctively.
   *
   * Each field is counted against the filters MINUS its own, so selecting
   * `year=2024` leaves every year visible and switchable instead of collapsing
   * the list to one option the user cannot escape.
   *
   * The unfiltered panel — the landing-page case, and by far the most common —
   * is cached under the list tag, so it is computed once per publish rather
   * than once per visitor.
   */
  private async buildFacets(filters: PaperFilters): Promise<FacetGroup[]> {
    const specs = facetSpecs(this.deps.labels);
    const isUnfiltered = !hasActiveFilters(filters);

    const compute = async (): Promise<FacetGroup[]> => {
      const perField = PAPER_FACET_FIELDS.map((field) => ({
        field,
        filters: whereForFacet(filters, field) as PaperFilters,
      }));

      const counts = await this.deps.repository.facetCounts(perField);

      const inputs: FacetInput[] = PAPER_FACET_FIELDS.map((field) => ({
        spec: specs[field],
        counts: counts.get(field) ?? [],
        selected: selectedValuesFor(filters, field),
      }));

      return buildFacetGroups(inputs);
    };

    if (!isUnfiltered) return compute();

    return this.deps.cache.wrap(cacheKey('paper:facets', 'all'), compute, {
      ttl: REVALIDATE.ENTITY,
      tags: [CACHE_TAGS.entityList('QUESTION_PAPER')],
    });
  }

  async search(query: string, limit: number) {
    return this.deps.search.query({
      siteId: this.deps.siteId,
      query,
      entityLabels: ['Previous Year Paper'],
      limit,
    });
  }

  // Mutations

  async create(input: QuestionPaperCreateInput): Promise<PaperDto> {
    const actorId = getActorId();

    // The import idempotency key. PostgreSQL treats NULLs as distinct in a
    // unique constraint, so without this a bulk re-run inserts the same paper
    // again for every row where shift/setCode are null — which is most of them.
    const dedupeKey = buildPaperDedupeKey({
      examSlug: input.examId ?? null,
      boardSlug: input.boardId ?? null,
      classSlug: input.boardClassId ?? null,
      subjectSlug: input.subjectId ?? null,
      year: input.year,
      shift: input.shift ?? null,
      setCode: input.setCode ?? null,
      locale: input.locale,
      paperType: input.paperType,
    });

    const existing = await this.deps.repository.findByDedupeKey(dedupeKey);
    if (existing) {
      throw new BusinessRuleError(
        'An identical paper already exists (same exam, year, shift, set and language)',
        { existingSlug: existing.slug },
      );
    }

    const slug = input.slug
      ? await this.assertSlugFree(input.slug)
      : await this.deps.slugs.generate(input.title, (s) => this.deps.repository.slugExists(s), {
          year: input.year,
        });

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const created = await this.deps.repository.create(
        { ...toWriteData(input), slug, dedupeKey, createdById: actorId },
        tx,
      );

      await this.deps.events.dispatch(
        paperEvents.created(created, toPaperSnapshot(created), actorId),
        tx,
      );

      if (created.status === 'PUBLISHED') {
        await this.deps.events.dispatch(
          paperEvents.published(created, toPaperSnapshot(created), actorId),
          tx,
        );
      }

      return created;
    });

    return toPaperDto(record);
  }

  async update(id: string, input: QuestionPaperUpdateInput): Promise<PaperDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Question paper', id);

    if (input.expectedVersion !== undefined) {
      const current = before.updatedAt.getTime();
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
    if (changedFields.length === 0) return toPaperDto(before);

    // Identity fields changed, so the dedupe key has to be recomputed or the
    // paper becomes re-importable as a duplicate of itself.
    const identityChanged = changedFields.some((field) =>
      ['year', 'shift', 'setCode', 'locale', 'paperType', 'examId', 'boardId', 'subjectId'].includes(field),
    );

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        {
          ...patch,
          ...(identityChanged
            ? {
                dedupeKey: buildPaperDedupeKey({
                  examSlug: patch.examId ?? before.examId,
                  boardSlug: patch.boardId ?? before.boardId,
                  classSlug: patch.boardClassId ?? before.boardClassId,
                  subjectSlug: patch.subjectId ?? before.subjectId,
                  year: patch.year ?? before.year,
                  shift: patch.shift ?? before.shift,
                  setCode: patch.setCode ?? before.setCode,
                  locale: patch.locale ?? before.locale,
                  paperType: patch.paperType ?? before.paperType,
                }),
              }
            : {}),
          updatedById: actorId,
        },
        tx,
      );

      await this.deps.events.dispatch(
        paperEvents.updated(updated, {
          before: toPaperSnapshot(before),
          snapshot: toPaperSnapshot(updated),
          changedFields,
          actorId,
        }),
        tx,
      );

      return updated;
    });

    return toPaperDto(record);
  }

  /**
   * Attaches a corrected or new file as a NEW VERSION.
   *
   * Boards do reissue papers with corrections. Overwriting in place would make
   * "which PDF did students actually download in March" unanswerable.
   */
  async addFile(id: string, input: QuestionPaperFileInput): Promise<{ version: number }> {
    const actorId = getActorId();
    const paper = await this.deps.repository.findById(id);
    if (!paper) throw new NotFoundError('Question paper', id);

    return this.deps.repository.runInTransaction(async (tx) => {
      const result = await this.deps.repository.addFileVersion(
        {
          questionPaperId: id,
          mediaId: input.mediaId,
          fileRole: input.fileRole,
          locale: input.locale,
          changeNote: input.changeNote,
          actorId,
        },
        tx,
      );

      await this.deps.events.dispatch(
        paperEvents.updated(paper, {
          before: toPaperSnapshot(paper),
          snapshot: { ...toPaperSnapshot(paper), fileVersion: result.version },
          changedFields: [`file:${input.fileRole}`],
          actorId,
        }),
        tx,
      );

      return result;
    });
  }

  async publish(id: string): Promise<PaperDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Question paper', id);
    if (before.status === 'PUBLISHED') return toPaperDto(before);

    assertPublishable(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const published = await this.deps.repository.setStatus(id, 'PUBLISHED', actorId, tx);
      await this.deps.events.dispatch(
        paperEvents.published(published, toPaperSnapshot(published), actorId),
        tx,
      );
      return published;
    });

    return toPaperDto(record);
  }

  async unpublish(id: string): Promise<PaperDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Question paper', id);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.setStatus(id, 'DRAFT', actorId, tx);
      await this.deps.events.dispatch(paperEvents.unpublished(updated, actorId), tx);
      return updated;
    });

    return toPaperDto(record);
  }

  /**
   * Rename, with history and redirects.
   *
   * This was MISSING while every other sluggable module had it — the schema
   * existed, the endpoint did not. A paper URL that changes without a 301
   * silently discards whatever ranking it had accumulated.
   */
  async changeSlug(id: string, newSlug: string, reason: string): Promise<PaperDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Question paper', id);
    if (before.slug === newSlug) return toPaperDto(before);

    await this.deps.slugs.assertAvailable(newSlug, (s) => this.deps.repository.slugExists(s, id));

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.update(
        id,
        { slug: newSlug, updatedById: actorId },
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'QUESTION_PAPER',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug,
          reason: 'MANUAL_RENAME',
          actorId,
          redirects: this.deps.slugs.buildRedirects('QUESTION_PAPER', before.slug, newSlug),
        },
        tx,
      );

      await this.deps.events.dispatch(
        paperEvents.slugChanged(updated, { oldSlug: before.slug, reason, actorId }),
        tx,
      );

      return updated;
    });

    return toPaperDto(record);
  }

  async softDelete(id: string): Promise<void> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Question paper', id);

    const tombstone = tombstoneSlug(before.slug);

    await this.deps.repository.runInTransaction(async (tx) => {
      await this.deps.repository.softDelete(
        id,
        tombstone,
        // dedupeKey is unique too — without its own tombstone the paper could
        // never be re-imported after deletion.
        `${before.dedupeKey}__d${Math.floor(Date.now() / 1000)}`,
        actorId,
        tx,
      );

      await this.deps.slugs.recordRename(
        {
          entityType: 'QUESTION_PAPER',
          entityId: id,
          siteId: this.deps.siteId,
          oldSlug: before.slug,
          newSlug: tombstone,
          reason: 'SOFT_DELETE',
          actorId,
          isActive: false,
          redirects: this.deps.slugs.buildDeletionRedirects(
            'QUESTION_PAPER',
            before.slug,
            DELETED_FALLBACK_PATH,
          ),
        },
        tx,
      );

      await this.deps.events.dispatch(
        paperEvents.deleted(before, { redirectTo: DELETED_FALLBACK_PATH, actorId }),
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
    const history = await this.deps.slugs.resolveHistorical('QUESTION_PAPER', slug);
    if (history?.isActive) throw new GoneError('Question paper', ROUTES.paper(history.newSlug));
    if (history) throw new GoneError('Question paper', DELETED_FALLBACK_PATH);
    throw new NotFoundError('Question paper', slug);
  }
}

// Pure helpers

/** A paper with no file is a page that promises a download and delivers a 404. */
export function assertPublishable(record: PaperRecord): void {
  const hasPaperFile = record.files.some((file) => file.fileRole === 'PAPER');
  if (!hasPaperFile) {
    throw new BusinessRuleError('Cannot publish: no paper file has been attached', {
      missing: ['file:PAPER'],
    });
  }
  if (!record.examId && !record.boardClassId) {
    throw new BusinessRuleError('Cannot publish: attach the paper to an exam or a board class', {
      missing: ['examId|boardClassId'],
    });
  }
}

function hasActiveFilters(filters: PaperFilters): boolean {
  return PAPER_FACET_FIELDS.some((field) => (filters[field]?.length ?? 0) > 0)
    || filters.hasSolution !== undefined
    || filters.yearFrom !== undefined
    || filters.yearTo !== undefined
    || Boolean(filters.search);
}

function selectedValuesFor(filters: PaperFilters, field: PaperFacetField): (string | number)[] {
  return (filters[field] ?? []) as (string | number)[];
}

function toFilters(
  query: QuestionPaperListQuery | QuestionPaperFeedQuery,
  publicOnly: boolean,
): PaperFilters {
  const status = 'status' in query ? query.status : undefined;
  const includeDeleted = 'includeDeleted' in query ? query.includeDeleted : false;
  const search = 'search' in query ? query.search : undefined;

  return {
    year: query.year,
    yearFrom: query.yearFrom,
    yearTo: query.yearTo,
    paperType: query.paperType as PaperType[] | undefined,
    examId: query.examId,
    boardId: query.boardId,
    boardClassId: query.boardClassId,
    subjectId: query.subjectId,
    shift: query.shift,
    locale: query.locale,
    hasSolution: query.hasSolution,
    search,
    status,
    publicOnly,
    includeDeleted: publicOnly ? false : includeDeleted,
  };
}

function toWriteData(input: QuestionPaperCreateInput): PaperWriteData {
  return {
    title: input.title,
    paperType: input.paperType,
    year: input.year,
    shift: input.shift ?? null,
    setCode: input.setCode ?? null,
    locale: input.locale,
    examId: input.examId ?? null,
    boardId: input.boardId ?? null,
    boardClassId: input.boardClassId ?? null,
    subjectId: input.subjectId ?? null,
    totalQuestions: input.totalQuestions ?? null,
    totalMarks: input.totalMarks ?? null,
    durationMin: input.durationMin ?? null,
    status: input.status,
  };
}

function toPartialWriteData(input: QuestionPaperUpdateInput): Partial<PaperWriteData> {
  const out: Partial<PaperWriteData> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.paperType !== undefined) out.paperType = input.paperType;
  if (input.year !== undefined) out.year = input.year;
  if (input.shift !== undefined) out.shift = input.shift ?? null;
  if (input.setCode !== undefined) out.setCode = input.setCode ?? null;
  if (input.locale !== undefined) out.locale = input.locale;
  if (input.examId !== undefined) out.examId = input.examId ?? null;
  if (input.boardId !== undefined) out.boardId = input.boardId ?? null;
  if (input.boardClassId !== undefined) out.boardClassId = input.boardClassId ?? null;
  if (input.subjectId !== undefined) out.subjectId = input.subjectId ?? null;
  if (input.totalQuestions !== undefined) out.totalQuestions = input.totalQuestions ?? null;
  if (input.totalMarks !== undefined) out.totalMarks = input.totalMarks ?? null;
  if (input.durationMin !== undefined) out.durationMin = input.durationMin ?? null;
  if (input.status !== undefined) out.status = input.status;
  return out;
}

export const PAPER_PERMISSIONS = {
  manage: PERMISSIONS.PAPER_MANAGE,
  publish: PERMISSIONS.PAPER_PUBLISH,
} as const;
