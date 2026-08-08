import type { MediaType, SortDirection } from '@stc/types';

export type MediaVariants = Record<string, string>;

export type MediaRecord = {
  id: string;
  provider: string;
  publicId: string;
  version: string | null;
  secureUrl: string;
  folderPath: string | null;
  type: MediaType;
  mimeType: string;
  format: string | null;
  bytes: bigint | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  pageCount: number | null;
  focalX: number | null;
  focalY: number | null;
  blurDataUrl: string | null;
  dominantColor: string | null;
  hasAlpha: boolean | null;
  variants: MediaVariants | null;
  originalFilename: string | null;
  checksum: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  isDecorative: boolean;
  usageCount: number;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** Live reference counts, per relation. Drives the safe-delete guard. */
export type MediaUsage = {
  total: number;
  byRelation: Record<string, number>;
};

export type MediaFilters = {
  type?: MediaType | undefined;
  folderPath?: string | undefined;
  uploadedById?: string | undefined;
  unusedOnly?: boolean;
  search?: string | undefined;
  includeDeleted?: boolean;
};

export type MediaListParams = MediaFilters & {
  page: number;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type MediaWriteData = {
  provider: string;
  publicId: string;
  version: string | null;
  secureUrl: string;
  folderPath: string | null;
  type: MediaType;
  mimeType: string;
  format: string | null;
  bytes: bigint | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  pageCount: number | null;
  blurDataUrl: string | null;
  variants: MediaVariants | null;
  originalFilename: string | null;
  checksum: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  isDecorative: boolean;
  uploadedById: string | null;
};