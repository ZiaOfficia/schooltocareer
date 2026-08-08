import { Prisma, type PrismaClient } from '@stc/database';
import type { FacetCount } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';
import { toCursorArgs, toOffsetArgs } from '../../core/pagination/paginator.js';
import { iContains, inList, when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  PostCursorParams,
  PostFacetField,
  PostFilters,
  PostListParams,
  PostListRecord,
  PostRecord,
  PostWriteData,
} from './blog.types.js';

/**
 * ContentEntry persistence for editorial content.
 *
 * The list projection deliberately excludes `bodyHtml` and `bodyJson`. A blog
 * index page fetching 20 full article bodies moves several megabytes to render
 * a list of titles — the single most common cause of a slow listing endpoint.
 */

const LIST_SELECT = {
  id: true,
  siteId: true,
  slug: true,
  path: true,
  type: true,
  title: true,
  subtitle: true,
  excerpt: true,
  locale: true,
  status: true,
  publishedAt: true,
  readingMinutes: true,
  isFeatured: true,
  viewCount: true,
  version: true,
  updatedAt: true,
  author: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true, type: true } },
  featuredImage: { select: { id: true, secureUrl: true, altText: true, blurDataUrl: true } },
} satisfies Prisma.ContentEntrySelect;

const FULL_SELECT = {
  ...LIST_SELECT,
  bodyHtml: true,
  bodyJson: true,
  authorId: true,
  categoryId: true,
  featuredImageId: true,
  publishedRevisionId: true,
  examId: true,
  boardId: true,
  boardClassSubjectId: true,
  chapterId: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.ContentEntrySelect;

export class BlogRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Reads

  async findByPath(siteId: string, path: string, options: { publicOnly: boolean }): Promise<PostRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.contentEntry.findFirst({
          where: whereAnd(
            { siteId, path },
            { deletedAt: null },
            options.publicOnly ? { status: 'PUBLISHED', publishedAt: { lte: new Date() } } : {},
          ) as Prisma.ContentEntryWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Post', identifier: path },
    );
    return row as PostRecord | null;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<PostRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.contentEntry.findFirst({
          where: whereAnd(
            { id },
            options.includeDeleted ? {} : { deletedAt: null },
          ) as Prisma.ContentEntryWhereInput,
          select: FULL_SELECT,
        }),
      { resource: 'Post', identifier: id },
    );
    return row as PostRecord | null;
  }

  async list(params: PostListParams): Promise<{ items: PostListRecord[]; total: number }> {
    const where = this.buildWhere(params);
    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    const [items, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.contentEntry.findMany({
            where,
            select: LIST_SELECT,
            orderBy: [
              { [params.sortBy]: params.sortDir },
              { id: params.sortDir },
            ] as Prisma.ContentEntryOrderByWithRelationInput[],
            skip,
            take,
          }),
          this.prisma.contentEntry.count({ where }),
        ]),
      { resource: 'Post' },
    );

    return { items: items as PostListRecord[], total };
  }

  async listCursor(params: PostCursorParams): Promise<PostListRecord[]> {
    const { take, cursorFilter, orderBy } = toCursorArgs({
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
      perPage: params.perPage,
      sortField: params.sortBy,
      sortDir: params.sortDir,
      parseValue: (raw) => (params.sortBy.endsWith('At') ? new Date(String(raw)) : raw),
    });

    const items = await this.run(
      () =>
        this.prisma.contentEntry.findMany({
          where: whereAnd(
            this.buildWhere(params) as Record<string, unknown>,
            cursorFilter as Record<string, unknown> | undefined,
          ) as Prisma.ContentEntryWhereInput,
          select: LIST_SELECT,
          orderBy: orderBy as Prisma.ContentEntryOrderByWithRelationInput[],
          take,
        }),
      { resource: 'Post' },
    );

    return items as PostListRecord[];
  }

  /** Third consumer of the shared facet builder. Model-specific GROUP BY only. */
  async facetCounts(
    perFieldFilters: ReadonlyArray<{ field: PostFacetField; filters: PostFilters }>,
  ): Promise<Map<PostFacetField, FacetCount[]>> {
    if (perFieldFilters.length === 0) return new Map();

    const queries = perFieldFilters.map(({ field, filters }) =>
      this.prisma.contentEntry.groupBy({
        by: [field as 'type'],
        where: this.buildWhere(filters),
        _count: { _all: true },
      }),
    );

    const results = await this.run(() => this.prisma.$transaction(queries as never), {
      resource: 'Post',
    });

    const out = new Map<PostFacetField, FacetCount[]>();
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

  async slugExists(siteId: string, type: string, slug: string, locale: string, excludeId?: string): Promise<boolean> {
    const found = await this.run(
      () =>
        this.prisma.contentEntry.findFirst({
          where: excludeId
            ? { siteId, type: type as never, slug, locale: locale as never, NOT: { id: excludeId } }
            : { siteId, type: type as never, slug, locale: locale as never },
          select: { id: true },
        }),
      { resource: 'Post', identifier: slug },
    );
    return found !== null;
  }

  /**
   * Posts whose scheduled publication time has arrived.
   *
   * `status = DRAFT` with a future `publishedAt` IS the scheduled state — no
   * extra column, and @@index([status, publishedAt]) makes this a range scan
   * over a handful of rows rather than a table scan.
   */
  async listDueForPublication(now: Date, limit: number): Promise<Array<{ id: string; siteId: string; path: string; slug: string }>> {
    return this.run(
      () =>
        this.prisma.contentEntry.findMany({
          where: { status: 'DRAFT', deletedAt: null, publishedAt: { not: null, lte: now } },
          orderBy: { publishedAt: 'asc' },
          take: limit,
          select: { id: true, siteId: true, path: true, slug: true },
        }),
      { resource: 'Post' },
    );
  }

  // Writes

  async create(
    data: PostWriteData & {
      siteId: string;
      slug: string;
      path: string;
      authorId: string;
      createdById?: string | undefined;
    },
    tx: unknown,
  ): Promise<PostRecord> {
    const row = await asTx(tx).contentEntry.create({
      data: {
        ...data,
        bodyJson: (data.bodyJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        status: 'DRAFT',
        createdById: data.createdById ?? null,
        updatedById: data.createdById ?? null,
      },
      select: FULL_SELECT,
    });
    return row as PostRecord;
  }

  async update(
    id: string,
    data: Partial<PostWriteData> & {
      slug?: string;
      path?: string;
      version?: number;
      updatedById?: string | undefined;
    },
    tx: unknown,
  ): Promise<PostRecord> {
    const { bodyJson, ...rest } = data;
    const row = await asTx(tx).contentEntry.update({
      where: { id },
      data: {
        ...rest,
        ...(bodyJson !== undefined
          ? { bodyJson: (bodyJson ?? Prisma.JsonNull) as Prisma.InputJsonValue }
          : {}),
        updatedById: data.updatedById ?? null,
      },
      select: FULL_SELECT,
    });
    return row as PostRecord;
  }

  /**
   * Publishes, pointing the row at the revision that made it live.
   *
   * `publishedRevisionId` is what lets an editor keep working on a live page
   * without their edits going out — the public read resolves the published
   * revision, the editor works against the draft.
   */
  async publish(
    id: string,
    params: { publishedAt: Date; revisionId: bigint | null; actorId: string | undefined },
    tx: unknown,
  ): Promise<PostRecord> {
    const row = await asTx(tx).contentEntry.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: params.publishedAt,
        publishedRevisionId: params.revisionId,
        updatedById: params.actorId ?? null,
      },
      select: FULL_SELECT,
    });
    return row as PostRecord;
  }

  /** Used by the scheduler; flips status without touching publishedAt. */
  async markPublished(id: string, tx?: unknown): Promise<void> {
    const client = tx ? asTx(tx) : this.prisma;
    await client.contentEntry.update({ where: { id }, data: { status: 'PUBLISHED' } });
  }

  async setStatus(
    id: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    actorId: string | undefined,
    tx: unknown,
  ): Promise<PostRecord> {
    const row = await asTx(tx).contentEntry.update({
      where: { id },
      data: { status, updatedById: actorId ?? null },
      select: FULL_SELECT,
    });
    return row as PostRecord;
  }

  async softDelete(
    id: string,
    tombstonedSlug: string,
    tombstonedPath: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<void> {
    await asTx(tx).contentEntry.update({
      where: { id },
      data: {
        slug: tombstonedSlug,
        // `path` is unique per site — it needs its own tombstone or the URL
        // can never be reused.
        path: tombstonedPath,
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
        this.prisma.contentEntry.findMany({
          where: cursor
            ? { ...{ status: 'PUBLISHED', deletedAt: null }, id: { gt: cursor } }
            : { status: 'PUBLISHED', deletedAt: null },
          orderBy: { id: 'asc' },
          take: limit,
          select: { id: true },
        }),
      { resource: 'Post' },
    );
    return rows.map((row) => row.id);
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  private buildWhere(filters: PostFilters): Prisma.ContentEntryWhereInput {
    return whereAnd(
      { siteId: filters.siteId },
      filters.includeDeleted ? {} : { deletedAt: null },
      // A scheduled post is DRAFT with a future publishedAt; the public filter
      // must exclude it even after the status flips a second early.
      filters.publicOnly
        ? { status: 'PUBLISHED', publishedAt: { lte: new Date() } }
        : when(filters.status, (s) => ({ status: s })),
      filters.type?.length ? { type: { in: filters.type } } : undefined,
      inList('categoryId', filters.categoryId),
      inList('authorId', filters.authorId),
      when(filters.examId, (id) => ({ examId: id })),
      when(filters.boardId, (id) => ({ boardId: id })),
      filters.isFeatured === undefined ? undefined : { isFeatured: filters.isFeatured },
      iContains(['title', 'subtitle', 'excerpt'], filters.search),
    ) as Prisma.ContentEntryWhereInput;
  }
}

function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}
