import { Prisma, type PrismaClient } from '@stc/database';
import type { FacetCount } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';
import { toOffsetArgs } from '../../core/pagination/paginator.js';
import { iContains, inList, when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  ResultFacetField,
  ResultFilters,
  ResultLink,
  ResultListParams,
  ResultListRecord,
  ResultRecord,
  ResultStatistics,
  ResultWriteData,
} from './result.types.js';

/**
 * Result persistence.
 *
 * The facet aggregation is a near-copy of the paper repository's — deliberately,
 * because the shared abstraction lives in `core/query/facet-builder.ts` and what
 * remains here is only the model-specific `GROUP BY`. If THIS had needed a new
 * facet helper, the abstraction would have been wrong.
 */

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  resultType: true,
  year: true,
  isDeclared: true,
  declaredAt: true,
  expectedAt: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  exam: { select: { id: true, slug: true, shortName: true } },
  board: { select: { id: true, slug: true, shortName: true } },
} satisfies Prisma.ResultSelect;

const FULL_SELECT = {
  ...LIST_SELECT,
  examId: true,
  examYearId: true,
  boardId: true,
  boardClassId: true,
  officialUrl: true,
  links: true,
  statistics: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.ResultSelect;

export class ResultRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Reads

  async findBySlug(slug: string, options: { publicOnly: boolean }): Promise<ResultRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.result.findFirst({
          where: whereAnd(
            { slug },
            { deletedAt: null },
            options.publicOnly ? { status: 'PUBLISHED' } : {},
          ) as Prisma.ResultWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Result', identifier: slug },
    );
    return row as ResultRecord | null;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<ResultRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.result.findFirst({
          where: whereAnd(
            { id },
            options.includeDeleted ? {} : { deletedAt: null },
          ) as Prisma.ResultWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Result', identifier: id },
    );
    return row as ResultRecord | null;
  }

  async list(params: ResultListParams): Promise<{ items: ResultListRecord[]; total: number }> {
    const where = this.buildWhere(params);
    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    const [items, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.result.findMany({
            where,
            select: LIST_SELECT,
            orderBy: [
              { [params.sortBy]: params.sortDir },
              { id: params.sortDir },
            ] as Prisma.ResultOrderByWithRelationInput[],
            skip,
            take,
          }),
          this.prisma.result.count({ where }),
        ]),
      { resource: 'Result' },
    );

    return { items: items as ResultListRecord[], total };
  }

  /**
   * The "results declared today" and "upcoming this week" widgets.
   *
   * Ordered so imminent-but-undeclared comes first — that is what a student
   * refreshing the homepage on declaration day is looking for.
   */
  async listUpcoming(withinDays: number, limit: number): Promise<ResultListRecord[]> {
    const until = new Date(Date.now() + withinDays * 86_400_000);
    const items = await this.run(
      () =>
        this.prisma.result.findMany({
          where: {
            status: 'PUBLISHED',
            deletedAt: null,
            OR: [
              { isDeclared: false, expectedAt: { lte: until, gte: new Date(Date.now() - 86_400_000) } },
              { isDeclared: true, declaredAt: { gte: new Date(Date.now() - 3 * 86_400_000) } },
            ],
          },
          select: LIST_SELECT,
          orderBy: [{ isDeclared: 'asc' }, { expectedAt: 'asc' }, { declaredAt: 'desc' }],
          take: limit,
        }),
      { resource: 'Result' },
    );
    return items as ResultListRecord[];
  }

  /** Identical shape to the paper repository — model-specific GROUP BY only. */
  async facetCounts(
    perFieldFilters: ReadonlyArray<{ field: ResultFacetField; filters: ResultFilters }>,
  ): Promise<Map<ResultFacetField, FacetCount[]>> {
    if (perFieldFilters.length === 0) return new Map();

    const queries = perFieldFilters.map(({ field, filters }) =>
      this.prisma.result.groupBy({
        by: [field as 'year'],
        where: this.buildWhere(filters),
        _count: { _all: true },
      }),
    );

    const results = await this.run(() => this.prisma.$transaction(queries as never), {
      resource: 'Result',
    });

    const out = new Map<ResultFacetField, FacetCount[]>();
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
        this.prisma.result.findFirst({
          where: excludeId ? { slug, NOT: { id: excludeId } } : { slug },
          select: { id: true },
        }),
      { resource: 'Result', identifier: slug },
    );
    return found !== null;
  }

  // Writes

  async create(
    data: ResultWriteData & { slug: string; createdById?: string | undefined },
    tx: unknown,
  ): Promise<ResultRecord> {
    const row = await asTx(tx).result.create({
      data: {
        ...data,
        isDeclared: false,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        createdById: data.createdById ?? null,
        updatedById: data.createdById ?? null,
      },
      select: FULL_SELECT,
    });
    return row as ResultRecord;
  }

  async update(
    id: string,
    data: Partial<ResultWriteData> & { slug?: string; updatedById?: string | undefined },
    tx: unknown,
  ): Promise<ResultRecord> {
    const row = await asTx(tx).result.update({
      where: { id },
      data: { ...data, updatedById: data.updatedById ?? null },
      select: FULL_SELECT,
    });
    return row as ResultRecord;
  }

  async setStatus(
    id: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    actorId: string | undefined,
    tx: unknown,
  ): Promise<ResultRecord> {
    const row = await asTx(tx).result.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        updatedById: actorId ?? null,
      },
      select: FULL_SELECT,
    });
    return row as ResultRecord;
  }

  /**
   * The declaration transition.
   *
   * Separate from `update` because it flips the page's meaning and writes three
   * fields that must move together — an `isDeclared` without `declaredAt` or
   * links is a page that says "declared" and offers nothing.
   */
  async declare(
    id: string,
    data: {
      declaredAt: Date;
      officialUrl: string | null;
      links: ResultLink[];
      statistics: ResultStatistics | null;
      actorId?: string | undefined;
    },
    tx: unknown,
  ): Promise<ResultRecord> {
    const row = await asTx(tx).result.update({
      where: { id },
      data: {
        isDeclared: true,
        declaredAt: data.declaredAt,
        officialUrl: data.officialUrl,
        links: data.links as unknown as Prisma.InputJsonValue,
        statistics: (data.statistics ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        updatedById: data.actorId ?? null,
      },
      select: FULL_SELECT,
    });
    return row as ResultRecord;
  }

  async retract(id: string, actorId: string | undefined, tx: unknown): Promise<ResultRecord> {
    const row = await asTx(tx).result.update({
      where: { id },
      data: {
        isDeclared: false,
        declaredAt: null,
        // links and statistics are kept: a retraction is usually "declared too
        // early", and the operator will re-declare with the same links.
        updatedById: actorId ?? null,
      },
      select: FULL_SELECT,
    });
    return row as ResultRecord;
  }

  async softDelete(
    id: string,
    tombstonedSlug: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<void> {
    await asTx(tx).result.update({
      where: { id },
      data: {
        slug: tombstonedSlug,
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
        this.prisma.result.findMany({
          where: cursor
            ? { ...{ status: 'PUBLISHED', deletedAt: null }, id: { gt: cursor } }
            : { status: 'PUBLISHED', deletedAt: null },
          orderBy: { id: 'asc' },
          take: limit,
          select: { id: true },
        }),
      { resource: 'Result' },
    );
    return rows.map((row) => row.id);
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  private buildWhere(filters: ResultFilters): Prisma.ResultWhereInput {
    const expectedWithin =
      filters.expectedWithinDays === undefined
        ? undefined
        : {
            isDeclared: false,
            expectedAt: { lte: new Date(Date.now() + filters.expectedWithinDays * 86_400_000) },
          };

    return whereAnd(
      filters.includeDeleted ? {} : { deletedAt: null },
      filters.publicOnly ? { status: 'PUBLISHED' } : when(filters.status, (s) => ({ status: s })),
      filters.year?.length ? { year: { in: filters.year } } : undefined,
      filters.resultType?.length ? { resultType: { in: filters.resultType } } : undefined,
      inList('examId', filters.examId),
      inList('boardId', filters.boardId),
      filters.isDeclared === undefined ? undefined : { isDeclared: filters.isDeclared },
      expectedWithin,
      iContains(['title'], filters.search),
    ) as Prisma.ResultWhereInput;
  }
}

function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}
