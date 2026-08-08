import { Prisma, type PrismaClient } from '@stc/database';
import type { FacetCount } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';
import { toCursorArgs, toOffsetArgs } from '../../core/pagination/paginator.js';
import { between, iContains, inList, when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  PaperCursorParams,
  PaperFacetField,
  PaperFilters,
  PaperListParams,
  PaperListRecord,
  PaperRecord,
  PaperWriteData,
} from './question-paper.types.js';

/**
 * QuestionPaper persistence, including facet aggregation.
 *
 * This is the high-volume module: ~20,000 rows, browsed through a filter panel.
 * Two decisions carry it:
 *
 *  1. The list projection is deliberately narrow. A paper card shows a title, a
 *     year and a download count — fetching relations for a 100-row page would
 *     move megabytes to render kilobytes.
 *  2. Facet aggregations run in ONE transaction. Six sequential `GROUP BY`
 *     round trips to Neon is six times the latency for the same work.
 */

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  paperType: true,
  year: true,
  shift: true,
  setCode: true,
  locale: true,
  hasSolution: true,
  downloadCount: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  exam: { select: { id: true, slug: true, shortName: true } },
  subject: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.QuestionPaperSelect;

const FULL_SELECT = {
  ...LIST_SELECT,
  dedupeKey: true,
  examId: true,
  boardId: true,
  boardClassId: true,
  subjectId: true,
  totalQuestions: true,
  totalMarks: true,
  durationMin: true,
  createdAt: true,
  deletedAt: true,
  board: { select: { id: true, slug: true, shortName: true } },
  boardClass: { select: { id: true, slug: true } },
  files: {
    // Only the live version of each role. History stays queryable but never
    // loads on a page render.
    where: { isCurrent: true },
    select: {
      id: true,
      fileRole: true,
      locale: true,
      version: true,
      publishedAt: true,
      media: { select: { id: true, secureUrl: true, bytes: true, pageCount: true, mimeType: true } },
    },
  },
} satisfies Prisma.QuestionPaperSelect;

export class QuestionPaperRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Reads

  async findBySlug(slug: string, options: { publicOnly: boolean }): Promise<PaperRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.questionPaper.findFirst({
          where: whereAnd(
            { slug },
            { deletedAt: null },
            options.publicOnly ? { status: 'PUBLISHED' } : {},
          ) as Prisma.QuestionPaperWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'QuestionPaper', identifier: slug },
    );
    return row as PaperRecord | null;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<PaperRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.questionPaper.findFirst({
          where: whereAnd(
            { id },
            options.includeDeleted ? {} : { deletedAt: null },
          ) as Prisma.QuestionPaperWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'QuestionPaper', identifier: id },
    );
    return row as PaperRecord | null;
  }

  async list(params: PaperListParams): Promise<{ items: PaperListRecord[]; total: number }> {
    const where = this.buildWhere(params);
    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    const [items, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.questionPaper.findMany({
            where,
            select: LIST_SELECT,
            orderBy: [
              { [params.sortBy]: params.sortDir },
              { id: params.sortDir },
            ] as Prisma.QuestionPaperOrderByWithRelationInput[],
            skip,
            take,
          }),
          this.prisma.questionPaper.count({ where }),
        ]),
      { resource: 'QuestionPaper' },
    );

    return { items: items as PaperListRecord[], total };
  }

  /**
   * Keyset pagination. The public browse default.
   *
   * At 20,000 rows a user CAN reach page 200 of an unfiltered list, and
   * `OFFSET 4000` scans and discards 4,000 rows every time they do.
   */
  async listCursor(params: PaperCursorParams): Promise<PaperListRecord[]> {
    const { take, cursorFilter, orderBy } = toCursorArgs({
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
      perPage: params.perPage,
      sortField: params.sortBy,
      sortDir: params.sortDir,
      parseValue: (raw) =>
        params.sortBy.endsWith('At') ? new Date(String(raw)) : params.sortBy === 'year' ? Number(raw) : raw,
    });

    const items = await this.run(
      () =>
        this.prisma.questionPaper.findMany({
          where: whereAnd(
            this.buildWhere(params) as Record<string, unknown>,
            cursorFilter as Record<string, unknown> | undefined,
          ) as Prisma.QuestionPaperWhereInput,
          select: LIST_SELECT,
          orderBy: orderBy as Prisma.QuestionPaperOrderByWithRelationInput[],
          take,
        }),
      { resource: 'QuestionPaper' },
    );

    return items as PaperListRecord[];
  }

  /**
   * Facet counts, one `GROUP BY` per field, all in one transaction.
   *
   * DISJUNCTIVE: each field is counted against the filters MINUS its own, so
   * selecting `year=2024` leaves every year visible and switchable. The service
   * supplies the per-field filter sets via `whereForFacet`.
   */
  async facetCounts(
    perFieldFilters: ReadonlyArray<{ field: PaperFacetField; filters: PaperFilters }>,
  ): Promise<Map<PaperFacetField, FacetCount[]>> {
    if (perFieldFilters.length === 0) return new Map();

    const queries = perFieldFilters.map(({ field, filters }) =>
      this.prisma.questionPaper.groupBy({
        by: [field as 'year'],
        where: this.buildWhere(filters),
        _count: { _all: true },
      }),
    );

    const results = await this.run(
      () => this.prisma.$transaction(queries as never),
      { resource: 'QuestionPaper' },
    );

    const out = new Map<PaperFacetField, FacetCount[]>();
    (results as Array<Array<Record<string, unknown>>>).forEach((rows, index) => {
      const field = perFieldFilters[index]!.field;
      out.set(
        field,
        rows.map((row) => ({
          value: (row[field] ?? null) as FacetCount['value'],
          count: (row['_count'] as { _all: number })._all,
        })),
      );
    });

    return out;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.run(
      () =>
        this.prisma.questionPaper.findFirst({
          where: excludeId ? { slug, NOT: { id: excludeId } } : { slug },
          select: { id: true },
        }),
      { resource: 'QuestionPaper', identifier: slug },
    );
    return found !== null;
  }

  /** Import idempotency. `dedupeKey` is why a re-run does not duplicate 20k rows. */
  async findByDedupeKey(dedupeKey: string): Promise<{ id: string; slug: string } | null> {
    const row = await this.run(
      () =>
        this.prisma.questionPaper.findUnique({
          where: { dedupeKey },
          select: { id: true, slug: true },
        }),
      { resource: 'QuestionPaper', identifier: dedupeKey },
    );
    return row;
  }

  // Writes

  async create(
    data: PaperWriteData & { slug: string; dedupeKey: string; createdById?: string | undefined },
    tx: unknown,
  ): Promise<PaperRecord> {
    const row = await asTx(tx).questionPaper.create({
      data: {
        ...data,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        createdById: data.createdById ?? null,
        updatedById: data.createdById ?? null,
      },
      select: FULL_SELECT,
    });
    return row as PaperRecord;
  }

  async update(
    id: string,
    data: Partial<PaperWriteData> & {
      slug?: string;
      dedupeKey?: string;
      updatedById?: string | undefined;
    },
    tx: unknown,
  ): Promise<PaperRecord> {
    const row = await asTx(tx).questionPaper.update({
      where: { id },
      data: { ...data, updatedById: data.updatedById ?? null },
      select: FULL_SELECT,
    });
    return row as PaperRecord;
  }

  async setStatus(
    id: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    actorId: string | undefined,
    tx: unknown,
  ): Promise<PaperRecord> {
    const row = await asTx(tx).questionPaper.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        updatedById: actorId ?? null,
      },
      select: FULL_SELECT,
    });
    return row as PaperRecord;
  }

  /**
   * Attaches a new file version.
   *
   * Files are NEVER overwritten: a corrected PDF becomes version N+1 and the
   * previous row is marked `isCurrent = false`, so what students actually
   * downloaded stays reconstructable. The partial unique index in
   * 001_raw_constraints.sql enforces one current row per (paper, role, locale).
   */
  async addFileVersion(
    params: {
      questionPaperId: string;
      mediaId: string;
      fileRole: 'PAPER' | 'SOLUTION' | 'ANSWER_KEY';
      locale: 'EN' | 'HI';
      changeNote?: string | undefined;
      actorId?: string | undefined;
    },
    tx: unknown,
  ): Promise<{ version: number }> {
    const client = asTx(tx);

    const latest = await client.questionPaperFile.aggregate({
      where: {
        questionPaperId: params.questionPaperId,
        fileRole: params.fileRole,
        locale: params.locale,
      },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;

    // Demote the previous current row FIRST — the partial unique index rejects
    // two current rows for the same (paper, role, locale).
    await client.questionPaperFile.updateMany({
      where: {
        questionPaperId: params.questionPaperId,
        fileRole: params.fileRole,
        locale: params.locale,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    await client.questionPaperFile.create({
      data: {
        questionPaperId: params.questionPaperId,
        mediaId: params.mediaId,
        fileRole: params.fileRole,
        locale: params.locale,
        version,
        isCurrent: true,
        changeNote: params.changeNote ?? null,
        createdById: params.actorId ?? null,
      },
    });

    if (params.fileRole === 'SOLUTION') {
      await client.questionPaper.update({
        where: { id: params.questionPaperId },
        data: { hasSolution: true },
      });
    }

    return { version };
  }

  async listFileVersions(
    questionPaperId: string,
  ): Promise<Array<{ version: number; fileRole: string; locale: string; isCurrent: boolean; changeNote: string | null; createdAt: Date }>> {
    return this.run(
      () =>
        this.prisma.questionPaperFile.findMany({
          where: { questionPaperId },
          orderBy: [{ fileRole: 'asc' }, { version: 'desc' }],
          select: {
            version: true,
            fileRole: true,
            locale: true,
            isCurrent: true,
            changeNote: true,
            createdAt: true,
          },
        }),
      { resource: 'QuestionPaperFile', identifier: questionPaperId },
    );
  }

  /**
   * Download counter.
   *
   * Deliberately NOT called on the request path. A synchronous
   * `SET download_count = download_count + 1` on a popular paper is row-lock
   * contention that takes the site down on result-declaration day. A worker
   * drains a counter and calls this in batches.
   */
  async incrementDownloads(counts: ReadonlyArray<{ id: string; delta: number }>): Promise<void> {
    if (counts.length === 0) return;
    await this.run(
      () =>
        this.prisma.$transaction(
          counts.map(({ id, delta }) =>
            this.prisma.questionPaper.update({
              where: { id },
              data: { downloadCount: { increment: delta } },
            }),
          ),
        ),
      { resource: 'QuestionPaper' },
    );
  }

  async softDelete(
    id: string,
    tombstonedSlug: string,
    tombstonedDedupeKey: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<void> {
    await asTx(tx).questionPaper.update({
      where: { id },
      data: {
        slug: tombstonedSlug,
        // dedupeKey is unique too, so it needs its own tombstone or the paper
        // can never be re-imported.
        dedupeKey: tombstonedDedupeKey,
        deletedAt: new Date(),
        status: 'ARCHIVED',
        updatedById: actorId ?? null,
      },
    });
  }

  /**
   * Ids for a full reindex, keyset-paged on the primary key.
   *
   * A reindex walks the entire table, which is precisely where `OFFSET 40000`
   * hurts. Ordering by id and seeking past the last one keeps every page a
   * bounded index range regardless of how deep the walk goes.
   */
  async listIndexableIds(cursor: string | undefined, limit: number): Promise<string[]> {
    const rows = await this.run(
      () =>
        this.prisma.questionPaper.findMany({
          where: cursor
            ? { ...{ status: 'PUBLISHED', deletedAt: null }, id: { gt: cursor } }
            : { status: 'PUBLISHED', deletedAt: null },
          orderBy: { id: 'asc' },
          take: limit,
          select: { id: true },
        }),
      { resource: 'QuestionPaper' },
    );
    return rows.map((row) => row.id);
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  // Query construction

  private buildWhere(filters: PaperFilters): Prisma.QuestionPaperWhereInput {
    return whereAnd(
      filters.includeDeleted ? {} : { deletedAt: null },
      filters.publicOnly ? { status: 'PUBLISHED' } : when(filters.status, (s) => ({ status: s })),
      filters.year?.length ? { year: { in: filters.year } } : undefined,
      between('year', filters.yearFrom, filters.yearTo),
      filters.paperType?.length ? { paperType: { in: filters.paperType } } : undefined,
      inList('examId', filters.examId),
      inList('boardId', filters.boardId),
      inList('boardClassId', filters.boardClassId),
      inList('subjectId', filters.subjectId),
      inList('shift', filters.shift),
      filters.locale?.length ? { locale: { in: filters.locale } } : undefined,
      filters.hasSolution === undefined ? undefined : { hasSolution: filters.hasSolution },
      iContains(['title'], filters.search),
    ) as Prisma.QuestionPaperWhereInput;
  }
}

function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}
