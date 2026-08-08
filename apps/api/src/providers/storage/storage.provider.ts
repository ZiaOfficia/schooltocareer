import type { MediaType } from '@stc/types';

/**
 * Storage abstraction.
 *
 * Nothing outside this folder mentions Cloudinary. `MediaAsset.provider` +
 * `publicId` in the schema mirror this interface, so swapping to S3/R2 is a new
 * implementation plus a backfill — not a schema migration.
 */
export interface IStorageProvider {
  readonly name: string;

  upload(input: UploadInput): Promise<StoredAsset>;
  delete(publicId: string, type: MediaType): Promise<void>;

  /**
   * Presigned direct-to-provider upload.
   *
   * Large PDFs must NOT be proxied through the API — Render's request timeout
   * and memory ceiling make a 40MB paper upload a reliable way to take the
   * process down. The browser uploads directly and posts back the result.
   */
  signedUploadUrl(input: SignedUploadInput): Promise<SignedUpload>;

  /** Builds a transformed delivery URL. Transformations are provider-specific. */
  buildUrl(publicId: string, transform?: ImageTransform): string;

  /** Reads metadata back from the provider — used to reconcile drift. */
  probe(publicId: string): Promise<StoredAsset | null>;
}

export type UploadInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder?: string;
  /** Overwrite an existing asset rather than creating a new one. */
  publicId?: string;
};

export type SignedUploadInput = {
  folder?: string;
  mimeType: string;
  maxBytes: number;
  expiresInSeconds?: number;
};

export type SignedUpload = {
  url: string;
  fields: Record<string, string>;
  publicId: string;
  expiresAt: Date;
};

export type StoredAsset = {
  publicId: string;
  version: string | null;
  secureUrl: string;
  type: MediaType;
  mimeType: string;
  format: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  /** Provider-computed checksum where available; otherwise hashed locally. */
  checksum: string | null;
};

export type ImageTransform = {
  width?: number;
  height?: number;
  quality?: number | 'auto';
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  /** 0..1 focal point, so art-directed crops survive a provider swap. */
  focal?: { x: number; y: number };
};

/**
 * Named variants generated for every image on upload. Storing the derived URLs
 * on MediaAsset.variants means the frontend never computes a transformation
 * string, and a provider migration rewrites one column instead of every
 * template.
 */
export const IMAGE_VARIANTS = {
  thumb: { width: 160, height: 160, crop: 'thumb', quality: 'auto', format: 'auto' },
  card: { width: 480, quality: 'auto', format: 'auto' },
  hero: { width: 1280, quality: 'auto', format: 'auto' },
  og: { width: 1200, height: 630, crop: 'fill', quality: 'auto', format: 'jpg' },
} as const satisfies Record<string, ImageTransform>;

export type ImageVariantName = keyof typeof IMAGE_VARIANTS;

export const UPLOAD_LIMITS = {
  IMAGE_MAX_BYTES: 8 * 1024 * 1024,
  PDF_MAX_BYTES: 50 * 1024 * 1024,
  ALLOWED_IMAGE_MIME: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'],
  ALLOWED_DOC_MIME: ['application/pdf'],
} as const;
