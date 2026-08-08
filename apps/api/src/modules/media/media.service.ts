import { CACHE_TAGS, PERMISSIONS } from '@stc/constants';
import type { MediaType, Paginated } from '@stc/types';
import type { MediaListQuery, MediaUpdateInput, UploadConfirmInput, UploadSignInput } from '@stc/validation';

import { getActorId } from '../../core/context.js';
import { BusinessRuleError, NotFoundError, StorageError } from '../../core/errors/app-error.js';
import type { EventDispatcher } from '../../core/events/event-dispatcher.js';
import type { AppLogger } from '../../core/logger.js';
import { buildOffsetMeta } from '../../core/pagination/paginator.js';
import type { ICacheProvider } from '../../providers/cache/cache.provider.js';
import {
  IMAGE_VARIANTS,
  UPLOAD_LIMITS,
  type IStorageProvider,
  type StoredAsset,
} from '../../providers/storage/storage.provider.js';

import { toMediaDto, toMediaSnapshot, type MediaDto } from './media.dto.js';
import { mediaEvents } from './media.events.js';
import type { MediaRepository } from './media.repository.js';
import type { MediaListParams, MediaRecord, MediaUsage, MediaWriteData } from './media.types.js';

/**
 * Media lifecycle.
 *
 * This is the first production consumer of `IStorageProvider`, so it is the
 * module that decides whether that interface was well designed or a guess.
 *
 * THE UPLOAD FLOW IS TWO-STEP, AND THE SECOND STEP IS NOT OPTIONAL:
 *
 *   sign     server issues a signature and a SERVER-CHOSEN publicId
 *   upload   the browser PUTs bytes directly to the provider
 *   confirm  server PROBES the provider, verifies what actually landed, and
 *            only then writes a row
 *
 * The confirm step is a security boundary, not bookkeeping. Without it a client
 * can register any publicId it likes — including one belonging to another
 * asset — and the database would happily believe it.
 */

export type MediaRepositoryPort = Pick<
  MediaRepository,
  | 'findById'
  | 'findByPublicId'
  | 'findLiveByChecksum'
  | 'list'
  | 'usage'
  | 'listUnused'
  | 'listPendingProviderPurge'
  | 'create'
  | 'updateMetadata'
  | 'replaceBytes'
  | 'softDelete'
  | 'hardDelete'
  | 'setUsageCount'
  | 'runInTransaction'
>;

export type MediaServiceDeps = {
  repository: MediaRepositoryPort;
  storage: IStorageProvider;
  events: EventDispatcher;
  cache: ICacheProvider;
  logger: AppLogger;
};

/**
 * Grace period before an unreferenced asset is considered abandoned.
 * An editor uploads an image and attaches it a minute later; purging on a zero
 * reference count alone would delete the file out from under the open form.
 */
const UNUSED_GRACE_HOURS = 24;

export class MediaService {
  constructor(private readonly deps: MediaServiceDeps) {}

  // Upload lifecycle

  /**
   * Step 1: issue a presigned upload.
   *
   * The publicId is chosen by the SERVER. Letting the client name the object
   * lets it overwrite an existing asset by guessing a path.
   */
  async signUpload(input: UploadSignInput): Promise<{
    url: string;
    fields: Record<string, string>;
    publicId: string;
    expiresAt: string;
    maxBytes: number;
  }> {
    const maxBytes = this.maxBytesFor(input.mimeType);

    if (input.bytes > maxBytes) {
      throw new BusinessRuleError(
        `This file is too large. The limit for ${input.mimeType} is ${Math.round(maxBytes / 1024 / 1024)}MB.`,
        { maxBytes, declaredBytes: input.bytes },
      );
    }
    this.assertAllowedMime(input.mimeType);

    const signed = await this.deps.storage.signedUploadUrl({
      ...(input.folder ? { folder: input.folder } : {}),
      mimeType: input.mimeType,
      maxBytes,
    });

    return {
      url: signed.url,
      fields: signed.fields,
      publicId: signed.publicId,
      expiresAt: signed.expiresAt.toISOString(),
      maxBytes,
    };
  }

  /**
   * Step 2: verify and register.
   *
   * FINDING WORTH RECORDING: a presigned upload cannot enforce a size limit at
   * the provider — the signature covers the path and a timestamp, not the byte
   * count. So the declared size in step 1 is advisory, and the REAL check
   * happens here against what the provider actually stored. An oversized object
   * is deleted rather than registered, otherwise the limit is decorative.
   */
  async confirmUpload(input: UploadConfirmInput): Promise<MediaDto> {
    const actorId = getActorId();

    const existing = await this.deps.repository.findByPublicId(input.publicId);
    if (existing) return toMediaDto(existing);

    const probed = await this.deps.storage.probe(input.publicId);
    if (!probed) {
      throw new BusinessRuleError(
        'That upload was not found at the storage provider. It may have failed or expired.',
        { publicId: input.publicId },
      );
    }

    const maxBytes = this.maxBytesFor(probed.mimeType);
    if (probed.bytes > maxBytes) {
      // Registering it would make the limit decorative; leaving it would leak
      // storage. Delete, then refuse.
      await this.safeDeleteFromProvider(probed.publicId, probed.type);
      throw new BusinessRuleError(
        `The uploaded file is ${Math.round(probed.bytes / 1024 / 1024)}MB, over the ${Math.round(maxBytes / 1024 / 1024)}MB limit.`,
        { maxBytes, actualBytes: probed.bytes },
      );
    }

    try {
      this.assertAllowedMime(probed.mimeType);
    } catch (error) {
      await this.safeDeleteFromProvider(probed.publicId, probed.type);
      throw error;
    }

    // Content-hash dedupe. Operators re-upload the same logo constantly; giving
    // them back the existing asset is friendlier than a unique-violation error,
    // and the partial unique index remains the real guard.
    if (probed.checksum) {
      const duplicate = await this.deps.repository.findLiveByChecksum(probed.checksum);
      if (duplicate) {
        await this.safeDeleteFromProvider(probed.publicId, probed.type);
        this.deps.logger.info(
          { publicId: probed.publicId, existingId: duplicate.id },
          'duplicate upload folded into existing asset',
        );
        return toMediaDto(duplicate);
      }
    }

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const created = await this.deps.repository.create(
        {
          ...this.toWriteData(probed),
          ...(input.originalFilename ? { originalFilename: input.originalFilename } : {}),
          altText: input.altText ?? null,
          caption: input.caption ?? null,
          credit: input.credit ?? null,
          isDecorative: input.isDecorative,
          uploadedById: actorId ?? null,
        },
        tx,
      );

      await this.deps.events.dispatch(
        mediaEvents.created(
          { id: created.id, slug: created.publicId, url: created.secureUrl },
          toMediaSnapshot(created),
          actorId,
        ),
        tx,
      );

      return created;
    });

    return toMediaDto(record);
  }

  // Reads

  async getById(id: string): Promise<MediaDto & { usage: MediaUsage }> {
    const record = await this.deps.repository.findById(id, { includeDeleted: true });
    if (!record) throw new NotFoundError('Media asset', id);
    const usage = await this.deps.repository.usage(id);
    return { ...toMediaDto(record), usage };
  }

  async list(query: MediaListQuery): Promise<Paginated<MediaDto>> {
    const params: MediaListParams = {
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      type: query.type,
      folderPath: query.folderPath,
      uploadedById: query.uploadedById,
      unusedOnly: query.unusedOnly,
      search: query.search,
      includeDeleted: query.includeDeleted,
    };

    const { items, total } = await this.deps.repository.list(params);
    return {
      items: items.map(toMediaDto),
      meta: buildOffsetMeta(query.page, query.perPage, total),
    };
  }

  // Mutations

  async updateMetadata(id: string, input: MediaUpdateInput): Promise<MediaDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Media asset', id);

    const patch = {
      ...(input.altText !== undefined ? { altText: input.altText ?? null } : {}),
      ...(input.caption !== undefined ? { caption: input.caption ?? null } : {}),
      ...(input.credit !== undefined ? { credit: input.credit ?? null } : {}),
      ...(input.isDecorative !== undefined ? { isDecorative: input.isDecorative } : {}),
      ...(input.folderPath !== undefined ? { folderPath: input.folderPath ?? null } : {}),
      ...(input.focalX !== undefined ? { focalX: input.focalX } : {}),
      ...(input.focalY !== undefined ? { focalY: input.focalY } : {}),
    };

    if (Object.keys(patch).length === 0) return toMediaDto(before);

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.updateMetadata(id, patch, tx);

      await this.deps.events.dispatch(
        mediaEvents.updated(
          { id: updated.id, slug: updated.publicId, url: updated.secureUrl },
          {
            before: toMediaSnapshot(before),
            snapshot: toMediaSnapshot(updated),
            changedFields: Object.keys(patch),
            actorId,
            // Alt text and focal point change how every page embedding this
            // image renders, so those pages have to be purged too.
            cascadeTags: [CACHE_TAGS.entityChildren('MEDIA_ASSET', updated.publicId)],
          },
        ),
        tx,
      );

      return updated;
    });

    return toMediaDto(record);
  }

  /**
   * Replaces the bytes behind an existing asset.
   *
   * The row id is preserved, so every foreign key keeps working — that is the
   * difference between "replace" and "upload a new one and repoint 40 rows".
   * The provider's `version` token changes, which is what makes the CDN serve
   * the new bytes instead of the cached old ones.
   */
  async replace(id: string, newPublicId: string, changeNote?: string): Promise<MediaDto> {
    const actorId = getActorId();
    const before = await this.deps.repository.findById(id);
    if (!before) throw new NotFoundError('Media asset', id);

    const probed = await this.deps.storage.probe(newPublicId);
    if (!probed) {
      throw new BusinessRuleError('The replacement upload was not found at the storage provider');
    }

    if (probed.type !== before.type) {
      throw new BusinessRuleError(
        `Cannot replace a ${before.type} with a ${probed.type}. Upload a new asset instead.`,
      );
    }

    const oldPublicId = before.publicId;

    const record = await this.deps.repository.runInTransaction(async (tx) => {
      const updated = await this.deps.repository.replaceBytes(
        id,
        {
          publicId: probed.publicId,
          version: probed.version,
          secureUrl: probed.secureUrl,
          mimeType: probed.mimeType,
          format: probed.format,
          bytes: BigInt(probed.bytes),
          width: probed.width,
          height: probed.height,
          aspectRatio: aspectRatioOf(probed),
          pageCount: probed.pageCount,
          checksum: probed.checksum,
          blurDataUrl: null,
          variants: this.buildVariants(probed),
        },
        tx,
      );

      await this.deps.events.dispatch(
        mediaEvents.updated(
          { id: updated.id, slug: updated.publicId, url: updated.secureUrl },
          {
            before: toMediaSnapshot(before),
            snapshot: { ...toMediaSnapshot(updated), changeNote: changeNote ?? 'Bytes replaced' },
            changedFields: ['publicId', 'version', 'secureUrl', 'bytes'],
            actorId,
            cascadeTags: [CACHE_TAGS.entityChildren('MEDIA_ASSET', updated.publicId)],
          },
        ),
        tx,
      );

      return updated;
    });

    // Removing the superseded object is best-effort and happens AFTER commit.
    // A provider failure here must not roll back a successful replacement — the
    // reconcile task will sweep it up.
    if (oldPublicId !== probed.publicId) {
      await this.safeDeleteFromProvider(oldPublicId, before.type);
    }

    return toMediaDto(record);
  }

  /**
   * Soft delete, guarded by live references.
   *
   * Deleting an image that is live on 200 pages is not an operation anyone
   * means to perform, so it is refused with the counts rather than confirmed
   * with a dialog nobody reads.
   */
  async softDelete(id: string): Promise<void> {
    const actorId = getActorId();
    const record = await this.deps.repository.findById(id);
    if (!record) throw new NotFoundError('Media asset', id);

    const usage = await this.deps.repository.usage(id);
    if (usage.total > 0) {
      throw new BusinessRuleError(
        `This file is still used in ${usage.total} place(s). Replace or detach it first.`,
        { usage: usage.byRelation },
      );
    }

    await this.deps.repository.runInTransaction(async (tx) => {
      // The checksum carries a partial unique index over live rows. Without a
      // tombstone, deleting an asset permanently blocks re-uploading that file.
      await this.deps.repository.softDelete(
        id,
        record.checksum ? `${record.checksum}__d${Math.floor(Date.now() / 1000)}` : null,
        tx,
      );

      await this.deps.events.dispatch(
        mediaEvents.deleted(
          { id: record.id, slug: record.publicId, url: record.secureUrl },
          { redirectTo: '', actorId },
        ),
        tx,
      );
    });
  }

  // Maintenance — driven by periodic tasks

  /**
   * Purges soft-deleted assets from the storage provider.
   *
   * DB first, provider second, deliberately. The reverse order means a crash
   * between the two leaves a row pointing at bytes that no longer exist — a
   * broken image on a live page. This way the worst case is an orphaned object
   * costing a few cents until the next sweep.
   */
  async purgeDeletedFromProvider(limit = 50): Promise<number> {
    const pending = await this.deps.repository.listPendingProviderPurge(limit);
    let purged = 0;

    for (const asset of pending) {
      const removed = await this.safeDeleteFromProvider(asset.publicId, asset.type as MediaType);
      if (!removed) continue;
      await this.deps.repository.hardDelete(asset.id);
      purged += 1;
    }

    return purged;
  }

  /** Flags assets nobody references, so an operator can review before deleting. */
  async findAbandoned(limit = 100): Promise<Array<{ id: string; publicId: string }>> {
    return this.deps.repository.listUnused(UNUSED_GRACE_HOURS, limit);
  }

  /** Repairs the denormalised counter from live reference counts. */
  async refreshUsageCount(id: string): Promise<number> {
    const usage = await this.deps.repository.usage(id);
    await this.deps.repository.setUsageCount(id, usage.total);
    return usage.total;
  }

  // Internals

  /**
   * Provider deletion never throws upward.
   *
   * Storage is the least reliable dependency in the system and the one whose
   * failure matters least: a leftover object costs storage, a thrown error
   * costs the user their operation. Failures are logged and swept later.
   */
  private async safeDeleteFromProvider(publicId: string, type: MediaType): Promise<boolean> {
    try {
      await this.deps.storage.delete(publicId, type);
      return true;
    } catch (error) {
      this.deps.logger.warn(
        { err: error, publicId, provider: this.deps.storage.name },
        'provider delete failed — will retry on the next reconcile',
      );
      return false;
    }
  }

  private maxBytesFor(mimeType: string): number {
    return mimeType.startsWith('image/')
      ? UPLOAD_LIMITS.IMAGE_MAX_BYTES
      : UPLOAD_LIMITS.PDF_MAX_BYTES;
  }

  private assertAllowedMime(mimeType: string): void {
    const allowed = [...UPLOAD_LIMITS.ALLOWED_IMAGE_MIME, ...UPLOAD_LIMITS.ALLOWED_DOC_MIME];
    if (!allowed.includes(mimeType as never)) {
      throw new BusinessRuleError(`Files of type ${mimeType} cannot be uploaded`, {
        allowed,
      });
    }
    // SVG is an executable document. It is allowed because logos need it, but
    // it must be served with a restrictive CSP and never inlined.
    if (mimeType === 'image/svg+xml') {
      this.deps.logger.info({ mimeType }, 'SVG uploaded — serve with a restrictive CSP');
    }
  }

  private buildVariants(asset: StoredAsset): Record<string, string> | null {
    if (asset.type !== 'IMAGE') return null;
    return Object.fromEntries(
      Object.entries(IMAGE_VARIANTS).map(([name, transform]) => [
        name,
        this.deps.storage.buildUrl(asset.publicId, transform),
      ]),
    );
  }

  private toWriteData(asset: StoredAsset): MediaWriteData {
    return {
      provider: this.deps.storage.name,
      publicId: asset.publicId,
      version: asset.version,
      secureUrl: asset.secureUrl,
      folderPath: asset.publicId.includes('/')
        ? asset.publicId.slice(0, asset.publicId.lastIndexOf('/'))
        : null,
      type: asset.type,
      mimeType: asset.mimeType,
      format: asset.format,
      bytes: BigInt(asset.bytes),
      width: asset.width,
      height: asset.height,
      aspectRatio: aspectRatioOf(asset),
      pageCount: asset.pageCount,
      // Generated asynchronously — a placeholder is not worth blocking an
      // upload response on.
      blurDataUrl: null,
      variants: this.buildVariants(asset),
      originalFilename: null,
      checksum: asset.checksum,
      altText: null,
      caption: null,
      credit: null,
      isDecorative: false,
      uploadedById: null,
    };
  }
}

/** Stored, not derived at render time: this is a Core Web Vitals (CLS) input. */
function aspectRatioOf(asset: StoredAsset): number | null {
  if (!asset.width || !asset.height) return null;
  return Math.round((asset.width / asset.height) * 10_000) / 10_000;
}

export function assertStorageConfigured(storage: IStorageProvider): void {
  if (!storage.name) throw new StorageError('No storage provider is configured');
}

export const MEDIA_PERMISSIONS = {
  upload: PERMISSIONS.MEDIA_UPLOAD,
  delete: PERMISSIONS.MEDIA_DELETE,
} as const;

export type { MediaRecord, MediaUsage };
