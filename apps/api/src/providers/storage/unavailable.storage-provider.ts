import type { MediaType } from '@stc/types';

import { DependencyError } from '../../core/errors/dependency-error.js';

import type {
  IStorageProvider,
  ImageTransform,
  SignedUpload,
  SignedUploadInput,
  StoredAsset,
  UploadInput,
} from './storage.provider.js';

/**
 * The storage provider used when no Cloudinary credentials are configured.
 *
 * WHY THIS EXISTS. Requiring three Cloudinary secrets to boot a read-only API
 * is a deployment blocker for no benefit: serving exam pages, papers and
 * results touches storage exactly never — `MediaAsset.url` is a stored column,
 * so reads are already just database rows. Only uploads, deletes, signing and
 * reconciliation need the provider.
 *
 * So the failure moves from boot time to call time, where it is both accurate
 * and actionable: the process starts, every read path works, and the first
 * attempt to upload says precisely which variables are missing.
 *
 * This mirrors how REDIS_URL already behaves — absent means degrade with a
 * loud warning, not refuse to start.
 *
 * `buildUrl` is the one method that does NOT throw. It is pure string
 * construction used while rendering existing assets, and breaking a page that
 * merely displays an already-uploaded image would defeat the point.
 */
export class UnavailableStorageProvider implements IStorageProvider {
  readonly name = 'unavailable';

  private fail(operation: string): never {
    // `permanent` so the outbox worker dead-letters immediately instead of
    // retrying five times. Missing configuration never resolves by waiting.
    throw new DependencyError(
      `Cannot ${operation}: no storage provider is configured. Set CLOUDINARY_CLOUD_NAME, ` +
        'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable uploads. Reads are unaffected.',
      { permanent: true },
    );
  }

  upload(_input: UploadInput): Promise<StoredAsset> {
    this.fail('upload');
  }

  delete(_publicId: string, _type: MediaType): Promise<void> {
    this.fail('delete an asset');
  }

  signedUploadUrl(_input: SignedUploadInput): Promise<SignedUpload> {
    this.fail('sign an upload');
  }

  probe(_publicId: string): Promise<StoredAsset | null> {
    this.fail('probe an asset');
  }

  /** Deliberately does not throw — see the class comment. */
  buildUrl(publicId: string, _transform?: ImageTransform): string {
    return publicId;
  }
}
