import { Prisma, type PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';
import { toOffsetArgs } from '../../core/pagination/paginator.js';
import { iContains, when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  MediaFilters,
  MediaListParams,
  MediaRecord,
  MediaUsage,
  MediaWriteData,
} from './media.types.js';

/**
 * MediaAsset persistence.
 *
 * The interesting query here is `usage()`. Deleting an image that is live on
 * 200 pages must be impossible, and MediaAsset is referenced from six different
 * relations — so "is this in use" is a real question the database has to answer,
 * not a boolean someone remembered to maintain.
 */

const SELECT = {
  id: true,
  provider: true,
  publicId: true,
  version: true,
  secureUrl: true,
  folderPath: true,
  type: true,
  mimeType: true,
  format: true,
  bytes: true,
  width: true,
  height: true,
  aspectRatio: true,
  pageCount: true,
  focalX: true,
  focalY: true,
  blurDataUrl: true,
  dominantColor: true,
  hasAlpha: true,
  variants: true,
  originalFilename: true,
  checksum: true,
  altText: true,
  caption: true,
  credit: true,
  isDecorative: true,
  usageCount: true,
  uploadedById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.MediaAssetSelect;

export class MediaRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Reads

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<MediaRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.mediaAsset.findFirst({
          where: whereAnd(
            { id },
            options.includeDeleted ? {} : { deletedAt: null },
          ) as Prisma.MediaAssetWhereInput,
          select: SELECT,
        }),
      { resource: 'MediaAsset', identifier: id },
    );
    return row as MediaRecord | null;
  }

  async findByPublicId(publicId: string): Promise<MediaRecord | null> {
    const row = await this.run(
      () => this.prisma.mediaAsset.findUnique({ where: { publicId }, select: SELECT }),
      { resource: 'MediaAsset', identifier: publicId },
    );
    return row as MediaRecord | null;
  }

  /**
   * Deduplication by content hash.
   *
   * Bulk-import operators re-upload the same CBSE logo dozens of times. The
   * partial unique index (WHERE deletedAt IS NULL) is the real guard; this is
   * the friendly lookup that returns the existing asset instead of erroring.
   */
  async findLiveByChecksum(checksum: string): Promise<MediaRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.mediaAsset.findFirst({
          where: { checksum, deletedAt: null },
          select: SELECT,
        }),
      { resource: 'MediaAsset', identifier: checksum },
    );
    return row as MediaRecord | null;
  }

  async list(params: MediaListParams): Promise<{ items: MediaRecord[]; total: number }> {
    const where = this.buildWhere(params);
    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    const [items, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.mediaAsset.findMany({
            where,
            select: SELECT,
            orderBy: [
              { [params.sortBy]: params.sortDir },
              { id: params.sortDir },
            ] as Prisma.MediaAssetOrderByWithRelationInput[],
            skip,
            take,
          }),
          this.prisma.mediaAsset.count({ where }),
        ]),
      { resource: 'MediaAsset' },
    );

    return { items: items as MediaRecord[], total };
  }

  /**
   * Live reference count across every relation that points at MediaAsset.
   *
   * Counted at read time rather than trusting `usageCount`: a denormalised
   * counter that drifts turns the delete guard into a coin flip, and this runs
   * only when someone is about to delete something.
   */
  async usage(id: string): Promise<MediaUsage> {
    // These are exactly the five relations that reference MediaAsset in the
    // launch schema. Adding a sixth reference elsewhere REQUIRES adding it here
    // — otherwise the delete guard silently stops protecting it.
    const [boards, exams, papers, content, seo] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.board.count({ where: { logoId: id, deletedAt: null } }),
          this.prisma.exam.count({ where: { logoId: id, deletedAt: null } }),
          this.prisma.questionPaperFile.count({ where: { mediaId: id } }),
          this.prisma.contentEntry.count({ where: { featuredImageId: id, deletedAt: null } }),
          this.prisma.seoMeta.count({ where: { ogImageId: id } }),
        ]),
      { resource: 'MediaAsset', identifier: id },
    );

    const byRelation = {
      boardLogo: boards,
      examLogo: exams,
      questionPaperFile: papers,
      contentFeaturedImage: content,
      seoOgImage: seo,
    };

    return {
      total: Object.values(byRelation).reduce((sum, n) => sum + n, 0),
      byRelation,
    };
  }

  /**
   * Assets registered but referenced by nothing, older than a grace period.
   *
   * The grace period matters: an editor uploads an image and attaches it thirty
   * seconds later. Purging on a zero count alone would delete the file out from
   * under the form they are still filling in.
   */
  async listUnused(olderThanHours: number, limit: number): Promise<Array<{ id: string; publicId: string; type: string }>> {
    const cutoff = new Date(Date.now() - olderThanHours * 3_600_000);
    return this.run(
      () =>
        this.prisma.mediaAsset.findMany({
          where: {
            deletedAt: null,
            createdAt: { lt: cutoff },
            usageCount: 0,
            boardLogos: { none: {} },
            examLogos: { none: {} },
            paperFiles: { none: {} },
            contentFeatured: { none: {} },
            seoOgImages: { none: {} },
          },
          take: limit,
          select: { id: true, publicId: true, type: true },
        }),
      { resource: 'MediaAsset' },
    );
  }

  /** Soft-deleted rows awaiting removal at the provider. */
  async listPendingProviderPurge(limit: number): Promise<Array<{ id: string; publicId: string; type: string }>> {
    return this.run(
      () =>
        this.prisma.mediaAsset.findMany({
          where: { deletedAt: { not: null } },
          orderBy: { deletedAt: 'asc' },
          take: limit,
          select: { id: true, publicId: true, type: true },
        }),
      { resource: 'MediaAsset' },
    );
  }

  // Writes

  async create(data: MediaWriteData, tx: unknown): Promise<MediaRecord> {
    const row = await asTx(tx).mediaAsset.create({
      data: {
        ...data,
        variants: (data.variants ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      select: SELECT,
    });
    return row as MediaRecord;
  }

  async updateMetadata(
    id: string,
    data: Partial<
      Pick<MediaRecord, 'altText' | 'caption' | 'credit' | 'isDecorative' | 'folderPath' | 'focalX' | 'focalY'>
    >,
    tx: unknown,
  ): Promise<MediaRecord> {
    const row = await asTx(tx).mediaAsset.update({ where: { id }, data, select: SELECT });
    return row as MediaRecord;
  }

  /**
   * Replaces the bytes behind an existing asset.
   *
   * The row id never changes, so every foreign key pointing at it stays valid —
   * that is the whole point of replace-versus-reupload. `version` is the
   * provider's cache-busting token, and bumping it is what makes the CDN serve
   * the new bytes.
   */
  async replaceBytes(
    id: string,
    data: Pick<
      MediaWriteData,
      | 'publicId'
      | 'version'
      | 'secureUrl'
      | 'mimeType'
      | 'format'
      | 'bytes'
      | 'width'
      | 'height'
      | 'aspectRatio'
      | 'pageCount'
      | 'checksum'
      | 'blurDataUrl'
      | 'variants'
    >,
    tx: unknown,
  ): Promise<MediaRecord> {
    const row = await asTx(tx).mediaAsset.update({
      where: { id },
      data: {
        ...data,
        variants: (data.variants ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      select: SELECT,
    });
    return row as MediaRecord;
  }

  /**
   * Soft delete with a checksum tombstone.
   *
   * `checksum` carries a partial unique index over live rows. Without the
   * tombstone, deleting an asset would permanently block re-uploading the same
   * file — the exact scenario a soft delete is supposed to keep reversible.
   */
  async softDelete(id: string, tombstonedChecksum: string | null, tx: unknown): Promise<void> {
    await asTx(tx).mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date(), checksum: tombstonedChecksum },
    });
  }

  /** Hard delete, after the object is gone from the provider. */
  async hardDelete(id: string): Promise<void> {
    await this.run(() => this.prisma.mediaAsset.delete({ where: { id } }), {
      resource: 'MediaAsset',
      identifier: id,
    });
  }

  async setUsageCount(id: string, count: number): Promise<void> {
    await this.run(
      () => this.prisma.mediaAsset.update({ where: { id }, data: { usageCount: count } }),
      { resource: 'MediaAsset', identifier: id },
    );
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  private buildWhere(filters: MediaFilters): Prisma.MediaAssetWhereInput {
    return whereAnd(
      filters.includeDeleted ? {} : { deletedAt: null },
      when(filters.type, (type) => ({ type })),
      when(filters.folderPath, (path) => ({ folderPath: { startsWith: path } })),
      when(filters.uploadedById, (id) => ({ uploadedById: id })),
      filters.unusedOnly ? { usageCount: 0 } : undefined,
      iContains(['originalFilename', 'altText', 'caption'], filters.search),
    ) as Prisma.MediaAssetWhereInput;
  }
}

function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}
