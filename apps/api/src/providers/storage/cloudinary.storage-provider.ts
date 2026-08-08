import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import type { MediaType } from '@stc/types';

import { StorageError } from '../../core/errors/app-error.js';

import {
  IMAGE_VARIANTS,
  type IStorageProvider,
  type ImageTransform,
  type SignedUpload,
  type SignedUploadInput,
  type StoredAsset,
  type UploadInput,
} from './storage.provider.js';

export class CloudinaryStorageProvider implements IStorageProvider {
  readonly name = 'cloudinary';

  constructor(config: { cloudName: string; apiKey: string; apiSecret: string }) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async upload(input: UploadInput): Promise<StoredAsset> {
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            ...(input.folder ? { folder: input.folder } : {}),
            ...(input.publicId ? { public_id: input.publicId } : {}),
            resource_type: input.mimeType === 'application/pdf' ? 'raw' : 'image',
            overwrite: Boolean(input.publicId),
            // Cloudinary derives eager transformations at upload time so the
            // first visitor never pays the transformation latency.
            ...(input.mimeType.startsWith('image/')
              ? { eager: Object.values(IMAGE_VARIANTS).map(toCloudinaryTransform) }
              : {}),
          },
          (error, uploaded) => {
            if (error || !uploaded) reject(error ?? new Error('Upload returned no result'));
            else resolve(uploaded);
          },
        );
        stream.end(input.buffer);
      });

      return this.toStoredAsset(result, input.mimeType);
    } catch (error) {
      throw new StorageError('Upload failed', error);
    }
  }

  async delete(publicId: string, type: MediaType): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: type === 'IMAGE' ? 'image' : 'raw',
        invalidate: true,
      });
    } catch (error) {
      throw new StorageError('Delete failed', error);
    }
  }

  async signedUploadUrl(input: SignedUploadInput): Promise<SignedUpload> {
    const expiresIn = input.expiresInSeconds ?? 600;
    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `${input.folder ?? 'uploads'}/${timestamp}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const paramsToSign: Record<string, string | number> = {
        timestamp,
        public_id: publicId,
        ...(input.folder ? { folder: input.folder } : {}),
      };
      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        cloudinary.config().api_secret as string,
      );

      return {
        url: `https://api.cloudinary.com/v1_1/${cloudinary.config().cloud_name}/auto/upload`,
        fields: {
          api_key: cloudinary.config().api_key as string,
          timestamp: String(timestamp),
          public_id: publicId,
          signature,
          ...(input.folder ? { folder: input.folder } : {}),
        },
        publicId,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (error) {
      throw new StorageError('Could not sign upload', error);
    }
  }

  buildUrl(publicId: string, transform?: ImageTransform): string {
    return cloudinary.url(publicId, {
      secure: true,
      ...(transform ? toCloudinaryTransform(transform) : {}),
    });
  }

  async probe(publicId: string): Promise<StoredAsset | null> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return this.toStoredAsset(result as UploadApiResponse, guessMime(result.format as string));
    } catch {
      return null;
    }
  }

  private toStoredAsset(result: UploadApiResponse, mimeType: string): StoredAsset {
    return {
      publicId: result.public_id,
      version: result.version ? String(result.version) : null,
      secureUrl: result.secure_url,
      type: mimeTypeToMediaType(mimeType),
      mimeType,
      format: result.format ?? null,
      bytes: result.bytes ?? 0,
      width: result.width ?? null,
      height: result.height ?? null,
      pageCount: (result as { pages?: number }).pages ?? null,
      // Cloudinary's etag is an MD5 of the bytes — good enough for de-duping
      // uploads, which is all MediaAsset.checksum is used for.
      checksum: result.etag ?? null,
    };
  }
}

function toCloudinaryTransform(t: ImageTransform): Record<string, unknown> {
  return {
    width: t.width,
    height: t.height,
    crop: t.crop,
    quality: t.quality ?? 'auto',
    fetch_format: t.format ?? 'auto',
    ...(t.focal ? { gravity: 'xy_center', x: t.focal.x, y: t.focal.y } : {}),
  };
}

function mimeTypeToMediaType(mime: string): MediaType {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('application/')) return 'DOCUMENT';
  return 'OTHER';
}

function guessMime(format: string | undefined): string {
  if (!format) return 'application/octet-stream';
  if (format === 'pdf') return 'application/pdf';
  return `image/${format}`;
}
