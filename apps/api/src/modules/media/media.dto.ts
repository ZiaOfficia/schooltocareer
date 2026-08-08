import type { MediaType } from '@stc/types';
import { formatBytes, toIsoDate } from '@stc/utils';

import type { MediaRecord, MediaVariants } from './media.types.js';

/**
 * Media DTOs.
 *
 * `bytes` is a BigInt in the database and MUST NOT cross the wire as one -
 * JSON.stringify throws on BigInt. It ships as a number plus a formatted label.
 */

export type MediaDto = {
  id: string;
  publicId: string;
  url: string;
  type: MediaType;
  mimeType: string;
  format: string | null;
  bytes: number | null;
  sizeLabel: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  pageCount: number | null;
  focalPoint: { x: number; y: number } | null;
  blurDataUrl: string | null;
  dominantColor: string | null;
  variants: MediaVariants | null;
  folderPath: string | null;
  originalFilename: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  isDecorative: boolean;
  /** Missing alt text on a non-decorative image is an accessibility and SEO bug. */
  needsAltText: boolean;
  usageCount: number;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function toMediaDto(record: MediaRecord): MediaDto {
  const bytes = record.bytes === null ? null : Number(record.bytes);
  return {
    id: record.id,
    publicId: record.publicId,
    url: record.secureUrl,
    type: record.type,
    mimeType: record.mimeType,
    format: record.format,
    bytes,
    sizeLabel: record.bytes === null ? null : formatBytes(record.bytes),
    width: record.width,
    height: record.height,
    aspectRatio: record.aspectRatio,
    pageCount: record.pageCount,
    focalPoint:
      record.focalX === null || record.focalY === null
        ? null
        : { x: record.focalX, y: record.focalY },
    blurDataUrl: record.blurDataUrl,
    dominantColor: record.dominantColor,
    variants: record.variants,
    folderPath: record.folderPath,
    originalFilename: record.originalFilename,
    altText: record.altText,
    caption: record.caption,
    credit: record.credit,
    isDecorative: record.isDecorative,
    needsAltText: record.type === 'IMAGE' && !record.isDecorative && !record.altText,
    usageCount: record.usageCount,
    uploadedById: record.uploadedById,
    createdAt: toIsoDate(record.createdAt) ?? '',
    updatedAt: toIsoDate(record.updatedAt) ?? '',
    deletedAt: toIsoDate(record.deletedAt),
  };
}

export function toMediaSnapshot(record: MediaRecord): Record<string, unknown> {
  return {
    id: record.id,
    publicId: record.publicId,
    version: record.version,
    type: record.type,
    mimeType: record.mimeType,
    bytes: record.bytes === null ? null : Number(record.bytes),
    altText: record.altText,
    caption: record.caption,
    credit: record.credit,
    isDecorative: record.isDecorative,
    folderPath: record.folderPath,
    status: 'PUBLISHED',
  };
}