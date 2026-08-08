import { Prisma, type PrismaClient } from '@stc/database';

import type { SortDirection } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';
import { buildOffsetMeta, toCursorArgs, toOffsetArgs } from '../../core/pagination/paginator.js';
import { iContains, when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  ExamCursorParams,
  ExamDetailRecord,
  ExamFilters,
  ExamListParams,
  ExamListRecord,
  ExamRecord,
  ExamWriteData,
} from './exam.types.js';

/**
 * The ONLY file in this module that may import Prisma.
 *
 * Selects are explicit everywhere. `include` fetches every column of every
 * relation, which on a list endpoint means dragging 20KB of `overview` text per
 * row across the wire to render a card that shows a name and a logo.
 */

const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  level: true,
  mode: true,
  educationLevel: true,
  popularityScore: true,
  isActive: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  logo: { select: { id: true, secureUrl: true, altText: true, blurDataUrl: true } },
} satisfies Prisma.ExamSelect;

const FULL_SELECT = {
  ...LIST_SELECT,
  fullName: true,
  conductingBody: true,
  categoryId: true,
  boardId: true,
  frequency: true,
  officialWebsite: true,
  logoId: true,
  overview: true,
  createdAt: true,
  deletedAt: true,
  board: { select: { id: true, name: true, shortName: true, slug: true } },
} satisfies Prisma.ExamSelect;

export class ExamRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Reads

  async findBySlug(slug: string, options: { publicOnly: boolean }): Promise<ExamRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.exam.findFirst({
          where: whereAnd(
            { slug },
            { deletedAt: null },
            options.publicOnly ? { status: 'PUBLISHED' } : {},
          ) as Prisma.ExamWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Exam', identifier: slug },
    );
    return record as ExamRecord | null;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<ExamRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.exam.findFirst({
          where: whereAnd(
            { id },
            options.includeDeleted ? {} : { deletedAt: null },
          ) as Prisma.ExamWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Exam', identifier: id },
    );
    return record as ExamRecord | null;
  }

  /**
   * Detail read for the exam hub page: the exam plus its cycles and their
   * important dates, in ONE query.
   *
   * Fetching years and then events per year is the N+1 that turns a 4ms page
   * into a 400ms page once an exam has ten sessions.
   */
  async findDetailBySlug(
    slug: string,
    options: { publicOnly: boolean },
  ): Promise<ExamDetailRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.exam.findFirst({
          where: whereAnd(
            { slug },
            { deletedAt: null },
            options.publicOnly ? { status: 'PUBLISHED' } : {},
          ) as Prisma.ExamWhereInput,
          select: {
            ...FULL_SELECT,
            years: {
              where: options.publicOnly ? { status: 'PUBLISHED', deletedAt: null } : { deletedAt: null },
              orderBy: [{ year: 'desc' }, { sessionName: 'asc' }],
              take: 8,
              select: {
                id: true,
                year: true,
                sessionName: true,
                slug: true,
                isCurrent: true,
                events: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    type: true,
                    title: true,
                    startDate: true,
                    endDate: true,
                    isTentative: true,
                    officialUrl: true,
                    order: true,
                  },
                },
              },
            },
          },
        }),
      { resource: 'Exam', identifier: slug },
    );
    return record as ExamDetailRecord | null;
  }

  async list(params: ExamListParams): Promise<{ items: ExamListRecord[]; total: number }> {
    const where = this.buildWhere(params);
    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    // One round trip for both the page and the count.
    const [items, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.exam.findMany({
            where,
            select: LIST_SELECT,
            orderBy: [{ [params.sortBy]: params.sortDir }, { id: params.sortDir }] as Prisma.ExamOrderByWithRelationInput[],
            skip,
            take,
          }),
          this.prisma.exam.count({ where }),
        ]),
      { resource: 'Exam' },
    );

    return { items: items as ExamListRecord[], total };
  }

  /** Keyset pagination for public feeds. Returns perPage + 1 probe rows. */
  async listCursor(params: ExamCursorParams): Promise<ExamListRecord[]> {
    const { take, cursorFilter, orderBy } = toCursorArgs({
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
      perPage: params.perPage,
      sortField: params.sortBy,
      sortDir: params.sortDir,
      parseValue: (raw) => (params.sortBy.endsWith('At') ? new Date(String(raw)) : raw),
    });

    const items = await this.run(
      () =>
        this.prisma.exam.findMany({
          where: whereAnd(
            this.buildWhere(params) as Record<string, unknown>,
            cursorFilter as Record<string, unknown> | undefined,
          ) as Prisma.ExamWhereInput,
          select: LIST_SELECT,
          orderBy: orderBy as Prisma.ExamOrderByWithRelationInput[],
          take,
        }),
      { resource: 'Exam' },
    );

    return items as ExamListRecord[];
  }

  /** Slug availability probe for SlugService. Sees soft-deleted rows on purpose. */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.run(
      () =>
        this.prisma.exam.findFirst({
          where: excludeId ? { slug, NOT: { id: excludeId } } : { slug },
          select: { id: true },
        }),
      { resource: 'Exam', identifier: slug },
    );
    return found !== null;
  }

  /** Top-N by popularity - feeds generateStaticParams in the web app. */
  async listPopularSlugs(limit: number): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.run(
      () =>
        this.prisma.exam.findMany({
          where: { status: 'PUBLISHED', deletedAt: null },
          orderBy: { popularityScore: 'desc' },
          take: limit,
          select: { slug: true, updatedAt: true },
        }),
      { resource: 'Exam' },
    );
  }

  // Writes (all take a transaction from the service)

  async create(
    data: ExamWriteData & { slug: string; createdById?: string | undefined },
    tx: unknown,
  ): Promise<ExamRecord> {
    const record = await asTx(tx).exam.create({
      data: {
        ...data,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        createdById: data.createdById ?? null,
        updatedById: data.createdById ?? null,
      },
      select: FULL_SELECT,
    });
    return record as ExamRecord;
  }

  async update(
    id: string,
    data: Partial<ExamWriteData> & { slug?: string; updatedById?: string | undefined },
    tx: unknown,
  ): Promise<ExamRecord> {
    const record = await asTx(tx).exam.update({
      where: { id },
      data: { ...data, updatedById: data.updatedById ?? null },
      select: FULL_SELECT,
    });
    return record as ExamRecord;
  }

  async setStatus(
    id: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    actorId: string | undefined,
    tx: unknown,
  ): Promise<ExamRecord> {
    const record = await asTx(tx).exam.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        updatedById: actorId ?? null,
      },
      select: FULL_SELECT,
    });
    return record as ExamRecord;
  }

  /**
   * Soft delete with a slug tombstone.
   *
   * The tombstone frees the slug for reuse while keeping the Prisma `@unique`
   * intact - see packages/database/README.md for why this beats a partial
   * unique index in a Prisma codebase.
   */
  async softDelete(
    id: string,
    tombstonedSlug: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<void> {
    await asTx(tx).exam.update({
      where: { id },
      data: {
        slug: tombstonedSlug,
        deletedAt: new Date(),
        status: 'ARCHIVED',
        updatedById: actorId ?? null,
      },
    });
  }

  async restore(
    id: string,
    slug: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<ExamRecord> {
    const record = await asTx(tx).exam.update({
      where: { id },
      data: { slug, deletedAt: null, status: 'DRAFT', updatedById: actorId ?? null },
      select: FULL_SELECT,
    });
    return record as ExamRecord;
  }

  /** Exposes the transaction runner to the service, which owns the boundary. */
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
        this.prisma.exam.findMany({
          where: cursor
            ? { ...{ status: 'PUBLISHED', deletedAt: null }, id: { gt: cursor } }
            : { status: 'PUBLISHED', deletedAt: null },
          orderBy: { id: 'asc' },
          take: limit,
          select: { id: true },
        }),
      { resource: 'Exam' },
    );
    return rows.map((row) => row.id);
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  // Query construction

  private buildWhere(filters: ExamFilters): Prisma.ExamWhereInput {
    return whereAnd(
      filters.includeDeleted ? {} : { deletedAt: null },
      filters.publicOnly ? { status: 'PUBLISHED' } : when(filters.status, (s) => ({ status: s })),
      when(filters.categoryId, (id) => ({ categoryId: id })),
      when(filters.categorySlug, (slug) => ({ category: { slug } })),
      when(filters.boardId, (id) => ({ boardId: id })),
      when(filters.level, (level) => ({ level })),
      when(filters.mode, (mode) => ({ mode })),
      when(filters.educationLevel, (l) => ({ educationLevel: l })),
      filters.isActive === undefined ? undefined : { isActive: filters.isActive },
      // Admin-table search only. Public search goes through ISearchProvider
      // against the GIN index - ILIKE '%x%' cannot use one.
      iContains(['name', 'shortName', 'fullName', 'conductingBody'], filters.search),
    ) as Prisma.ExamWhereInput;
  }
}

/**
 * The transaction handle is typed unknown at every public boundary so the
 * service can pass it to repositories and event handlers without importing
 * Prisma. One cast, here, is the whole cost of that boundary.
 */
function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}

export type { SortDirection };

