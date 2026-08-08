import { Prisma, type PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';
import { toCursorArgs, toOffsetArgs } from '../../core/pagination/paginator.js';
import { iContains, when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  BoardCursorParams,
  BoardDetailRecord,
  BoardFilters,
  BoardListParams,
  BoardListRecord,
  BoardRecord,
  BoardWriteData,
} from './board.types.js';

/**
 * The only file in this module that may import Prisma.
 *
 * The hierarchy read is the interesting part: board + classes + class levels +
 * a subject COUNT in a single query. Fetching classes then counting subjects
 * per class is the N+1 that turns a 5ms page into 300ms once a board has
 * twelve classes across four streams.
 */

const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  type: true,
  popularityScore: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  state: { select: { id: true, name: true, slug: true, code: true } },
  logo: { select: { id: true, secureUrl: true, altText: true, blurDataUrl: true } },
} satisfies Prisma.BoardSelect;

const FULL_SELECT = {
  ...LIST_SELECT,
  stateId: true,
  establishedYear: true,
  headquarters: true,
  officialWebsite: true,
  logoId: true,
  description: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.BoardSelect;

export class BoardRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Reads

  async findBySlug(slug: string, options: { publicOnly: boolean }): Promise<BoardRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.board.findFirst({
          where: whereAnd(
            { slug },
            { deletedAt: null },
            options.publicOnly ? { status: 'PUBLISHED' } : {},
          ) as Prisma.BoardWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Board', identifier: slug },
    );
    return record as BoardRecord | null;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<BoardRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.board.findFirst({
          where: whereAnd(
            { id },
            options.includeDeleted ? {} : { deletedAt: null },
          ) as Prisma.BoardWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Board', identifier: id },
    );
    return record as BoardRecord | null;
  }

  /** Board hub page: the board plus its full class tree, one round trip. */
  async findDetailBySlug(
    slug: string,
    options: { publicOnly: boolean },
  ): Promise<BoardDetailRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.board.findFirst({
          where: whereAnd(
            { slug },
            { deletedAt: null },
            options.publicOnly ? { status: 'PUBLISHED' } : {},
          ) as Prisma.BoardWhereInput,
          select: {
            ...FULL_SELECT,
            classes: {
              where: options.publicOnly
                ? { status: 'PUBLISHED', deletedAt: null }
                : { deletedAt: null },
              select: {
                id: true,
                slug: true,
                stream: true,
                status: true,
                classLevel: {
                  select: { id: true, name: true, slug: true, order: true, stage: true },
                },
                // Prisma's relation count — one aggregate, not one query per class.
                _count: { select: { subjects: { where: { deletedAt: null } } } },
              },
            },
          },
        }),
      { resource: 'Board', identifier: slug },
    );

    if (!record) return null;

    const raw = record as unknown as BoardRecord & {
      classes: Array<Omit<BoardDetailRecord['classes'][number], 'subjectCount'> & {
        _count: { subjects: number };
      }>;
    };

    return {
      ...raw,
      classes: raw.classes.map(({ _count, ...cls }) => ({ ...cls, subjectCount: _count.subjects })),
    };
  }

  /**
   * Child slugs for a board.
   *
   * Used by the rename cascade: every class URL under this board changes when
   * the board slug changes, and only the service can know which ones exist.
   */
  async listChildSlugs(boardId: string): Promise<string[]> {
    const rows = await this.run(
      () =>
        this.prisma.boardClass.findMany({
          where: { boardId, deletedAt: null },
          select: { slug: true },
        }),
      { resource: 'BoardClass', identifier: boardId },
    );
    return rows.map((row) => row.slug);
  }

  async list(params: BoardListParams): Promise<{ items: BoardListRecord[]; total: number }> {
    const where = this.buildWhere(params);
    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    const [items, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.board.findMany({
            where,
            select: LIST_SELECT,
            orderBy: [
              { [params.sortBy]: params.sortDir },
              { id: params.sortDir },
            ] as Prisma.BoardOrderByWithRelationInput[],
            skip,
            take,
          }),
          this.prisma.board.count({ where }),
        ]),
      { resource: 'Board' },
    );

    return { items: items as BoardListRecord[], total };
  }

  async listCursor(params: BoardCursorParams): Promise<BoardListRecord[]> {
    const { take, cursorFilter, orderBy } = toCursorArgs({
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
      perPage: params.perPage,
      sortField: params.sortBy,
      sortDir: params.sortDir,
      parseValue: (raw) => (params.sortBy.endsWith('At') ? new Date(String(raw)) : raw),
    });

    const items = await this.run(
      () =>
        this.prisma.board.findMany({
          where: whereAnd(
            this.buildWhere(params) as Record<string, unknown>,
            cursorFilter as Record<string, unknown> | undefined,
          ) as Prisma.BoardWhereInput,
          select: LIST_SELECT,
          orderBy: orderBy as Prisma.BoardOrderByWithRelationInput[],
          take,
        }),
      { resource: 'Board' },
    );

    return items as BoardListRecord[];
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.run(
      () =>
        this.prisma.board.findFirst({
          where: excludeId ? { slug, NOT: { id: excludeId } } : { slug },
          select: { id: true },
        }),
      { resource: 'Board', identifier: slug },
    );
    return found !== null;
  }

  async listPopularSlugs(limit: number): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.run(
      () =>
        this.prisma.board.findMany({
          where: { status: 'PUBLISHED', deletedAt: null },
          orderBy: { popularityScore: 'desc' },
          take: limit,
          select: { slug: true, updatedAt: true },
        }),
      { resource: 'Board' },
    );
  }

  // Writes (the service owns the transaction)

  async create(
    data: BoardWriteData & { slug: string; createdById?: string | undefined },
    tx: unknown,
  ): Promise<BoardRecord> {
    const record = await asTx(tx).board.create({
      data: {
        ...data,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        createdById: data.createdById ?? null,
        updatedById: data.createdById ?? null,
      },
      select: FULL_SELECT,
    });
    return record as BoardRecord;
  }

  async update(
    id: string,
    data: Partial<BoardWriteData> & { slug?: string; updatedById?: string | undefined },
    tx: unknown,
  ): Promise<BoardRecord> {
    const record = await asTx(tx).board.update({
      where: { id },
      data: { ...data, updatedById: data.updatedById ?? null },
      select: FULL_SELECT,
    });
    return record as BoardRecord;
  }

  async setStatus(
    id: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    actorId: string | undefined,
    tx: unknown,
  ): Promise<BoardRecord> {
    const record = await asTx(tx).board.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        updatedById: actorId ?? null,
      },
      select: FULL_SELECT,
    });
    return record as BoardRecord;
  }

  /**
   * Soft delete WITH cascade.
   *
   * PostgreSQL's ON DELETE CASCADE never fires on a soft delete, so the class →
   * subject → chapter subtree has to be walked explicitly. Leaving them behind
   * means a deleted board's chapters stay publicly reachable and indexed —
   * exactly the leak the CascadeSoftDeleteService convention exists to prevent.
   */
  async softDeleteCascade(
    id: string,
    tombstonedSlug: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<{ classes: number; subjects: number; chapters: number }> {
    const client = asTx(tx);
    const now = new Date();

    const classIds = (
      await client.boardClass.findMany({ where: { boardId: id }, select: { id: true } })
    ).map((row) => row.id);

    const subjectIds = (
      await client.boardClassSubject.findMany({
        where: { boardClassId: { in: classIds } },
        select: { id: true },
      })
    ).map((row) => row.id);

    const chapters = await client.chapter.updateMany({
      where: { boardClassSubjectId: { in: subjectIds }, deletedAt: null },
      data: { deletedAt: now },
    });
    const subjects = await client.boardClassSubject.updateMany({
      where: { id: { in: subjectIds }, deletedAt: null },
      data: { deletedAt: now },
    });
    const classes = await client.boardClass.updateMany({
      where: { id: { in: classIds }, deletedAt: null },
      data: { deletedAt: now },
    });

    await client.board.update({
      where: { id },
      data: {
        slug: tombstonedSlug,
        deletedAt: now,
        status: 'ARCHIVED',
        updatedById: actorId ?? null,
      },
    });

    return { classes: classes.count, subjects: subjects.count, chapters: chapters.count };
  }

  async restore(
    id: string,
    slug: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<BoardRecord> {
    const record = await asTx(tx).board.update({
      where: { id },
      data: { slug, deletedAt: null, status: 'DRAFT', updatedById: actorId ?? null },
      select: FULL_SELECT,
    });
    return record as BoardRecord;
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
        this.prisma.board.findMany({
          where: cursor
            ? { ...{ status: 'PUBLISHED', deletedAt: null }, id: { gt: cursor } }
            : { status: 'PUBLISHED', deletedAt: null },
          orderBy: { id: 'asc' },
          take: limit,
          select: { id: true },
        }),
      { resource: 'Board' },
    );
    return rows.map((row) => row.id);
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  // Query construction

  private buildWhere(filters: BoardFilters): Prisma.BoardWhereInput {
    return whereAnd(
      filters.includeDeleted ? {} : { deletedAt: null },
      filters.publicOnly ? { status: 'PUBLISHED' } : when(filters.status, (s) => ({ status: s })),
      when(filters.type, (type) => ({ type })),
      when(filters.stateId, (id) => ({ stateId: id })),
      when(filters.stateSlug, (slug) => ({ state: { slug } })),
      iContains(['name', 'shortName', 'headquarters'], filters.search),
    ) as Prisma.BoardWhereInput;
  }
}

/** One cast keeps Prisma out of the service. Same convention as ExamRepository. */
function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}
