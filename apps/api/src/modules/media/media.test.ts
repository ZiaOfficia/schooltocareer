import { describe, expect, it, vi } from 'vitest';

import { BusinessRuleError, NotFoundError } from '../../core/errors/app-error.js';
import type { DomainEvent } from '../../core/events/domain-event.js';
import { EventDispatcher } from '../../core/events/event-dispatcher.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { IStorageProvider, StoredAsset } from '../../providers/storage/storage.provider.js';

import { MediaService, type MediaRepositoryPort } from './media.service.js';
import type { MediaRecord, MediaUsage } from './media.types.js';

/**
 * Media is the first production consumer of IStorageProvider, so these tests
 * target the boundary between the database and an unreliable external system:
 * verification on confirm, failure isolation on delete, and reference safety.
 */

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;

const probed: StoredAsset = {
  publicId: 'exams/jee-main/logo-abc123',
  version: '1738000000',
  secureUrl: 'https://cdn.test/exams/jee-main/logo-abc123.png',
  type: 'IMAGE',
  mimeType: 'image/png',
  format: 'png',
  bytes: 240_000,
  width: 512,
  height: 512,
  pageCount: null,
  checksum: 'sha-abc',
};

const baseAsset: MediaRecord = {
  id: 'media_1',
  provider: 'cloudinary',
  publicId: probed.publicId,
  version: probed.version,
  secureUrl: probed.secureUrl,
  folderPath: 'exams/jee-main',
  type: 'IMAGE',
  mimeType: 'image/png',
  format: 'png',
  bytes: 240_000n,
  width: 512,
  height: 512,
  aspectRatio: 1,
  pageCount: null,
  focalX: 0.5,
  focalY: 0.5,
  blurDataUrl: null,
  dominantColor: null,
  hasAlpha: null,
  variants: null,
  originalFilename: 'logo.png',
  checksum: 'sha-abc',
  altText: 'JEE Main logo',
  caption: null,
  credit: null,
  isDecorative: false,
  usageCount: 0,
  uploadedById: 'user_1',
  createdAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: new Date('2026-02-01T00:00:00Z'),
  deletedAt: null,
};

function buildService(
  overrides: {
    record?: MediaRecord | null;
    byPublicId?: MediaRecord | null;
    byChecksum?: MediaRecord | null;
    probeResult?: StoredAsset | null;
    usage?: MediaUsage;
    deleteFails?: boolean;
  } = {},
) {
  const record = overrides.record === undefined ? baseAsset : overrides.record;
  const captured: DomainEvent[] = [];
  const deletedFromProvider: string[] = [];
  const created: Array<Record<string, unknown>> = [];
  const hardDeleted: string[] = [];

  const storage: IStorageProvider = {
    name: 'cloudinary',
    upload: vi.fn(async () => probed),
    delete: vi.fn(async (publicId: string) => {
      if (overrides.deleteFails) throw new Error('provider unreachable');
      deletedFromProvider.push(publicId);
    }),
    signedUploadUrl: vi.fn(async () => ({
      url: 'https://api.cloudinary.test/upload',
      fields: { signature: 'sig' },
      publicId: 'exams/jee-main/new-xyz',
      expiresAt: new Date(Date.now() + 600_000),
    })),
    buildUrl: vi.fn((publicId: string) => `https://cdn.test/${publicId}`),
    probe: vi.fn(async () =>
      overrides.probeResult === undefined ? probed : overrides.probeResult,
    ),
  };

  const repository: MediaRepositoryPort = {
    findById: vi.fn(async () => record),
    findByPublicId: vi.fn(async () => overrides.byPublicId ?? null),
    findLiveByChecksum: vi.fn(async () => overrides.byChecksum ?? null),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    usage: vi.fn(async () => overrides.usage ?? { total: 0, byRelation: {} }),
    listUnused: vi.fn(async () => []),
    listPendingProviderPurge: vi.fn(async () => [
      { id: 'media_del', publicId: 'old/asset', type: 'IMAGE' },
    ]),
    create: vi.fn(async (data) => {
      created.push(data as unknown as Record<string, unknown>);
      return { ...baseAsset, ...data } as MediaRecord;
    }),
    updateMetadata: vi.fn(async (_id, data) => ({ ...baseAsset, ...data }) as MediaRecord),
    replaceBytes: vi.fn(async (_id, data) => ({ ...baseAsset, ...data }) as MediaRecord),
    softDelete: vi.fn(async () => undefined),
    hardDelete: vi.fn(async (id: string) => {
      hardDeleted.push(id);
    }),
    setUsageCount: vi.fn(async () => undefined),
    runInTransaction: vi.fn(async (fn) => fn('TX')),
  };

  const events = new EventDispatcher({ debug: vi.fn(), error: vi.fn() } as never);
  events.register({
    name: 'capture',
    handles: ['created', 'updated', 'published', 'unpublished', 'slug_changed', 'deleted', 'restored'],
    handle: async (event) => {
      captured.push(event);
    },
  });

  const service = new MediaService({
    repository,
    storage,
    events,
    cache: new MemoryCacheProvider(),
    logger: silentLogger,
  });

  return { service, repository, storage, captured, deletedFromProvider, created, hardDeleted };
}

describe('MediaService.signUpload', () => {
  it('rejects an oversized declaration before issuing a signature', async () => {
    const { service, storage } = buildService();
    await expect(
      service.signUpload({ mimeType: 'image/png', bytes: 50 * 1024 * 1024 }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(storage.signedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects a disallowed mime type', async () => {
    const { service } = buildService();
    await expect(
      service.signUpload({ mimeType: 'application/x-msdownload', bytes: 1000 }),
    ).rejects.toThrow(/cannot be uploaded/);
  });

  it('returns a SERVER-chosen publicId', async () => {
    const { service } = buildService();
    const signed = await service.signUpload({ mimeType: 'image/png', bytes: 100_000 });
    // Letting the client name the object lets it overwrite an existing asset.
    expect(signed.publicId).toBe('exams/jee-main/new-xyz');
    expect(signed.maxBytes).toBeGreaterThan(0);
  });
});

describe('MediaService.confirmUpload — the verification boundary', () => {
  it('refuses to register a publicId that does not exist at the provider', async () => {
    const { service } = buildService({ probeResult: null });
    await expect(
      service.confirmUpload({ publicId: 'someone/elses/file', isDecorative: false }),
    ).rejects.toThrow(/not found at the storage provider/);
  });

  it('deletes and refuses an object that exceeded the size limit', async () => {
    // FINDING: a presigned signature covers the path and a timestamp, not the
    // byte count — so the provider cannot enforce the limit. Verification here
    // is the only thing that makes it real.
    const { service, deletedFromProvider } = buildService({
      probeResult: { ...probed, bytes: 40 * 1024 * 1024 },
    });

    await expect(
      service.confirmUpload({ publicId: probed.publicId, isDecorative: false }),
    ).rejects.toThrow(/over the/);

    expect(deletedFromProvider).toContain(probed.publicId);
  });

  it('deletes and refuses an object whose real mime type is not allowed', async () => {
    const { service, deletedFromProvider } = buildService({
      probeResult: { ...probed, mimeType: 'application/x-sh' },
    });

    await expect(
      service.confirmUpload({ publicId: probed.publicId, isDecorative: false }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(deletedFromProvider).toContain(probed.publicId);
  });

  it('folds a duplicate upload into the existing asset', async () => {
    const { service, deletedFromProvider, created } = buildService({
      byChecksum: baseAsset,
    });

    const result = await service.confirmUpload({ publicId: probed.publicId, isDecorative: false });

    expect(result.id).toBe(baseAsset.id);
    expect(created).toHaveLength(0);
    // The redundant copy is removed rather than left to accumulate.
    expect(deletedFromProvider).toContain(probed.publicId);
  });

  it('is idempotent — confirming twice returns the same asset', async () => {
    const { service, repository } = buildService({ byPublicId: baseAsset });
    const result = await service.confirmUpload({ publicId: probed.publicId, isDecorative: false });
    expect(result.id).toBe(baseAsset.id);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('stores aspectRatio and variants for images', async () => {
    const { service, created } = buildService();
    await service.confirmUpload({ publicId: probed.publicId, isDecorative: false });

    // aspectRatio is stored rather than derived at render time: it is a Core
    // Web Vitals (CLS) input.
    expect(created[0]!['aspectRatio']).toBe(1);
    expect(Object.keys(created[0]!['variants'] as object)).toContain('og');
  });
});

describe('MediaService.softDelete — reference safety', () => {
  it('refuses to delete an asset that is still in use, and says where', async () => {
    const { service } = buildService({
      usage: { total: 3, byRelation: { examLogo: 1, contentFeaturedImage: 2 } },
    });

    await expect(service.softDelete('media_1')).rejects.toMatchObject({
      details: { usage: { examLogo: 1, contentFeaturedImage: 2 } },
    });
  });

  it('tombstones the checksum so the same file can be re-uploaded later', async () => {
    const { service, repository } = buildService();
    await service.softDelete('media_1');

    const [, tombstoned] = vi.mocked(repository.softDelete).mock.calls[0]!;
    expect(String(tombstoned)).toMatch(/^sha-abc__d\d+$/);
  });

  it('404s an unknown asset', async () => {
    const { service } = buildService({ record: null });
    await expect(service.softDelete('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('MediaService.replace — references survive', () => {
  it('keeps the row id so every foreign key stays valid', async () => {
    const { service, repository } = buildService({
      probeResult: { ...probed, publicId: 'exams/jee-main/logo-v2', version: '1738999999' },
    });

    const result = await service.replace('media_1', 'exams/jee-main/logo-v2');

    expect(repository.replaceBytes).toHaveBeenCalledOnce();
    expect(result.id).toBe('media_1');
    expect(result.publicId).toBe('exams/jee-main/logo-v2');
  });

  it('removes the superseded object AFTER the transaction commits', async () => {
    const { service, deletedFromProvider } = buildService({
      probeResult: { ...probed, publicId: 'exams/jee-main/logo-v2' },
    });

    await service.replace('media_1', 'exams/jee-main/logo-v2');
    expect(deletedFromProvider).toContain(baseAsset.publicId);
  });

  it('refuses to replace an image with a PDF', async () => {
    const { service } = buildService({
      probeResult: { ...probed, type: 'PDF', mimeType: 'application/pdf' },
    });
    await expect(service.replace('media_1', 'x/y')).rejects.toThrow(/Cannot replace a IMAGE/);
  });

  it('a provider delete failure does not fail the replacement', async () => {
    const { service } = buildService({
      probeResult: { ...probed, publicId: 'exams/jee-main/logo-v2' },
      deleteFails: true,
    });

    // Storage is the least reliable dependency and its failure matters least:
    // a leftover object costs pennies, a thrown error costs the user their work.
    await expect(service.replace('media_1', 'exams/jee-main/logo-v2')).resolves.toBeDefined();
  });
});

describe('MediaService.purgeDeletedFromProvider', () => {
  it('hard-deletes the row only after the provider confirms removal', async () => {
    const { service, hardDeleted } = buildService();
    const purged = await service.purgeDeletedFromProvider();
    expect(purged).toBe(1);
    expect(hardDeleted).toEqual(['media_del']);
  });

  it('leaves the row pending when the provider delete fails', async () => {
    const { service, hardDeleted } = buildService({ deleteFails: true });
    const purged = await service.purgeDeletedFromProvider();
    // Retried on the next sweep rather than orphaning the object silently.
    expect(purged).toBe(0);
    expect(hardDeleted).toHaveLength(0);
  });
});
