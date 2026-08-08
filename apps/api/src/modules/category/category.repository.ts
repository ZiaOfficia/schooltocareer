import { Prisma, type PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';
import { toOffsetArgs } from '../../core/pagination/paginator.js';
import { iContains, when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  CategoryFilters,
  CategoryListParams,
  CategoryRecord,
  CategoryTreeNode,
  CategoryWriteData,
} from './category.types.js';

/**
 * Category persistence, including the tree traversals.
 *
 * Ancestors and descendants use recursive CTEs. The alternative — looping in
 * the service, one query per level — is N queries for an N-deep breadcrumb and
 * unbounded queries for a subtree. Prisma has no recursive query API, so this
 * is raw SQL, parameterised through tagged templates.
 *
 * Both CTEs carry a DEPTH GUARD. A self-referencing table with an unguarded
 * recursive CTE hangs the connection forever if a cycle ever gets written, and
 * a cycle is one bad reparent away.
 */

const MAX_TREE_DEPTH = 10;

const BASE_SELECT = {
  id: true,
  siteId: true,
  slug: true,
  name: true,
  type: true,
  parentId: true,
  description: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  _count: { select: { entries: { where: { deletedAt: null, status: 'PUBLISHED' } } } },
} satisfies Prisma.CategorySelect;

type RawRow = Omit<CategoryRecord, 'entryCount'> & { _count: { entries: number } };

function toRecord(row: unknown): CategoryRecord {
  const { _count, ...rest } = row as RawRow;
  return { ...rest, entryCount: _count.entries };
}

export class CategoryRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Reads

  async findBySlug(siteId: string, slug: string): Promise<CategoryRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.category.findFirst({
          where: { siteId, slug, deletedAt: null },
          select: BASE_SELECT,
        }),
      { resource: 'Category', identifier: slug },
    );
    return row ? toRecord(row) : null;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<CategoryRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.category.findFirst({
          where: whereAnd(
            { id },
            options.includeDeleted ? {} : { deletedAt: null },
          ) as Prisma.CategoryWhereInput,
          select: BASE_SELECT,
        }),
      { resource: 'Category', identifier: id },
    );
    return row ? toRecord(row) : null;
  }

  /**
   * Ancestors, root-first. This is the breadcrumb.
   *
   * Walking up in the service would be one query per level — three round trips
   * for `Exams > Engineering > JEE`, on every page render.
   */
  async listAncestors(id: string): Promise<CategoryTreeNode[]> {
    const rows = await this.run(
      () => this.prisma.$queryRaw<CategoryTreeNode[]>`
        WITH RECURSIVE ancestors AS (
          SELECT id, slug, name, type, "parentId", "order", 0 AS depth
            FROM "Category"
           WHERE id = ${id} AND "deletedAt" IS NULL
          UNION ALL
          SELECT c.id, c.slug, c.name, c.type, c."parentId", c."order", a.depth + 1
            FROM "Category" c
            JOIN ancestors a ON c.id = a."parentId"
           WHERE c."deletedAt" IS NULL AND a.depth < ${MAX_TREE_DEPTH}
        )
        SELECT * FROM ancestors WHERE id <> ${id} ORDER BY depth DESC
      `,
      { resource: 'Category', identifier: id },
    );
    return rows;
  }

  /**
   * Descendants, breadth-first.
   *
   * Used by the reparent cycle guard and by the delete cascade — moving a node
   * under its own descendant would create an orphaned ring that no traversal
   * can escape.
   */
  async listDescendants(id: string): Promise<CategoryTreeNode[]> {
    const rows = await this.run(
      () => this.prisma.$queryRaw<CategoryTreeNode[]>`
        WITH RECURSIVE descendants AS (
          SELECT id, slug, name, type, "parentId", "order", 0 AS depth
            FROM "Category"
           WHERE id = ${id} AND "deletedAt" IS NULL
          UNION ALL
          SELECT c.id, c.slug, c.name, c.type, c."parentId", c."order", d.depth + 1
            FROM "Category" c
            JOIN descendants d ON c."parentId" = d.id
           WHERE c."deletedAt" IS NULL AND d.depth < ${MAX_TREE_DEPTH}
        )
        SELECT * FROM descendants WHERE id <> ${id} ORDER BY depth ASC, "order" ASC
      `,
      { resource: 'Category', identifier: id },
    );
    return rows;
  }

  /** The whole tree for one site+type. Feeds the navigation menu. */
  async listTree(siteId: string, type?: string): Promise<CategoryTreeNode[]> {
    const typeFilter = type ? Prisma.sql`AND type = ${type}` : Prisma.empty;
    return this.run(
      () => this.prisma.$queryRaw<CategoryTreeNode[]>`
        WITH RECURSIVE tree AS (
          SELECT id, slug, name, type, "parentId", "order", 0 AS depth
            FROM "Category"
           WHERE "siteId" = ${siteId} AND "parentId" IS NULL AND "deletedAt" IS NULL ${typeFilter}
          UNION ALL
          SELECT c.id, c.slug, c.name, c.type, c."parentId", c."order", t.depth + 1
            FROM "Category" c
            JOIN tree t ON c."parentId" = t.id
           WHERE c."deletedAt" IS NULL AND t.depth < ${MAX_TREE_DEPTH}
        )
        SELECT * FROM tree ORDER BY depth ASC, "order" ASC, name ASC
      `,
      { resource: 'Category' },
    );
  }

  async list(params: CategoryListParams): Promise<{ items: CategoryRecord[]; total: number }> {
    const where = this.buildWhere(params);
    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    const [rows, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.category.findMany({
            where,
            select: BASE_SELECT,
            orderBy: [
              { [params.sortBy]: params.sortDir },
              { id: params.sortDir },
            ] as Prisma.CategoryOrderByWithRelationInput[],
            skip,
            take,
          }),
          this.prisma.category.count({ where }),
        ]),
      { resource: 'Category' },
    );

    return { items: rows.map(toRecord), total };
  }

  async slugExists(siteId: string, slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.run(
      () =>
        this.prisma.category.findFirst({
          where: excludeId ? { siteId, slug, NOT: { id: excludeId } } : { siteId, slug },
          select: { id: true },
        }),
      { resource: 'Category', identifier: slug },
    );
    return found !== null;
  }

  // Writes

  async create(
    data: CategoryWriteData & { siteId: string; slug: string; createdById?: string | undefined },
    tx: unknown,
  ): Promise<CategoryRecord> {
    const row = await asTx(tx).category.create({
      data: { ...data, createdById: data.createdById ?? null, updatedById: data.createdById ?? null },
      select: BASE_SELECT,
    });
    return toRecord(row);
  }

  async update(
    id: string,
    data: Partial<CategoryWriteData> & { slug?: string; updatedById?: string | undefined },
    tx: unknown,
  ): Promise<CategoryRecord> {
    const row = await asTx(tx).category.update({
      where: { id },
      data: { ...data, updatedById: data.updatedById ?? null },
      select: BASE_SELECT,
    });
    return toRecord(row);
  }

  /**
   * Soft delete, re-parenting children rather than orphaning them.
   *
   * Cascading the delete down a taxonomy would silently unpublish every article
   * under it. Promoting the children one level is the behaviour an editor
   * expects when they remove an intermediate node.
   */
  async softDeleteAndPromoteChildren(
    id: string,
    parentId: string | null,
    tombstonedSlug: string,
    actorId: string | undefined,
    tx: unknown,
  ): Promise<number> {
    const client = asTx(tx);

    const promoted = await client.category.updateMany({
      where: { parentId: id, deletedAt: null },
      data: { parentId },
    });

    await client.category.update({
      where: { id },
      data: { slug: tombstonedSlug, deletedAt: new Date(), updatedById: actorId ?? null },
    });

    return promoted.count;
  }

  async countEntries(id: string): Promise<number> {
    return this.run(
      () => this.prisma.contentEntry.count({ where: { categoryId: id, deletedAt: null } }),
      { resource: 'Category', identifier: id },
    );
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  private buildWhere(filters: CategoryFilters & { siteId: string }): Prisma.CategoryWhereInput {
    return whereAnd(
      { siteId: filters.siteId },
      filters.includeDeleted ? {} : { deletedAt: null },
      filters.rootsOnly ? { parentId: null } : when(filters.parentId, (id) => ({ parentId: id })),
      when(filters.type, (type) => ({ type })),
      iContains(['name'], filters.search),
    ) as Prisma.CategoryWhereInput;
  }
}

function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}
