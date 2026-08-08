import { z } from 'zod';

import { DEFAULT_SORT, SORTABLE_FIELDS } from '@stc/constants';
import { MEDIA_TYPE } from '@stc/types';

import { cuidSchema, offsetPaginationSchema, searchSchema, sortSchema } from './common.js';

/**
 * Media contracts.
 *
 * The upload flow is TWO-STEP and deliberately so:
 *
 *   1. POST /uploads/sign  -> server returns a signed, server-chosen publicId
 *   2. browser PUTs the bytes DIRECTLY to the storage provider
 *   3. POST /uploads/confirm -> server verifies the object really exists and
 *      registers it
 *
 * Bytes never pass through the API. A 50MB PDF proxied through a Render dyno is
 * a reliable way to exhaust memory, and the request timeout will kill it anyway.
 */

export const uploadSignSchema = z.object({
  mimeType: z.string().min(3).max(120),
  /** Declared size. Advisory only - verified against the provider on confirm. */
  bytes: z.number().int().min(1).max(200 * 1024 * 1024),
  folder: z
    .string()
    .max(120)
    .regex(/^[a-z0-9/_-]*$/, 'Folder may contain lowercase letters, digits, / _ -')
    .optional(),
  originalFilename: z.string().max(255).optional(),
});

export const uploadConfirmSchema = z.object({
  /** Must match a publicId this server issued. Never trusted blindly. */
  publicId: z.string().min(3).max(255),
  originalFilename: z.string().max(255).optional(),
  altText: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
  isDecorative: z.boolean().default(false),
});

export const mediaUpdateSchema = z.object({
  altText: z.string().max(300).nullish(),
  caption: z.string().max(500).nullish(),
  credit: z.string().max(200).nullish(),
  isDecorative: z.boolean().optional(),
  folderPath: z.string().max(120).nullish(),
  /** 0..1 art-direction point, so crops survive a provider swap. */
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
});

/** Replaces the bytes behind an existing asset, keeping every reference intact. */
export const mediaReplaceSchema = z.object({
  publicId: z.string().min(3).max(255),
  changeNote: z.string().max(300).optional(),
});

export const mediaListQuerySchema = offsetPaginationSchema
  .merge(searchSchema)
  .merge(sortSchema(SORTABLE_FIELDS.media, DEFAULT_SORT.media.field, DEFAULT_SORT.media.dir))
  .extend({
    type: z.enum(MEDIA_TYPE).optional(),
    folderPath: z.string().max(120).optional(),
    uploadedById: cuidSchema.optional(),
    /** Assets referenced by nothing - the cleanup queue. */
    unusedOnly: z.coerce.boolean().default(false),
    includeDeleted: z.coerce.boolean().default(false),
  });

export type UploadSignInput = z.infer<typeof uploadSignSchema>;
export type UploadConfirmInput = z.infer<typeof uploadConfirmSchema>;
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
export type MediaReplaceInput = z.infer<typeof mediaReplaceSchema>;
export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;