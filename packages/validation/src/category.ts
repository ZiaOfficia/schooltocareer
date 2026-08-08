import { z } from 'zod';

import { DEFAULT_SORT, SORTABLE_FIELDS } from '@stc/constants';

import {
  cuidSchema,
  offsetPaginationSchema,
  searchSchema,
  seoFieldsSchema,
  slugSchema,
  sortSchema,
} from './common.js';

/**
 * Category contracts.
 *
 * NOTE: no `status` field. Category is taxonomy, not content - the launch
 * schema gives it no PublishStatus, so it has no publish/unpublish lifecycle.
 * That is a real, documented deviation from the module template rather than an
 * omission; see category.service.ts.
 */

export const CATEGORY_TYPE = ['BLOG', 'NEWS', 'GUIDE'] as const;
export type CategoryType = (typeof CATEGORY_TYPE)[number];

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  type: z.enum(CATEGORY_TYPE),
  parentId: cuidSchema.nullish(),
  description: z.string().max(5000).nullish(),
  order: z.number().int().min(0).max(9999).default(0),
  seo: seoFieldsSchema.partial().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.omit({ slug: true }).partial().extend({
  expectedVersion: z.number().int().min(1).optional(),
});

export const categoryChangeSlugSchema = z.object({
  newSlug: slugSchema,
  reason: z.string().max(200).optional(),
});

/** Reparenting is its own operation: it rewrites every descendant`s breadcrumb. */
export const categoryMoveSchema = z.object({
  parentId: cuidSchema.nullable(),
});

export const categoryListQuerySchema = offsetPaginationSchema
  .merge(searchSchema)
  .merge(sortSchema(SORTABLE_FIELDS.category, DEFAULT_SORT.category.field, DEFAULT_SORT.category.dir))
  .extend({
    type: z.enum(CATEGORY_TYPE).optional(),
    parentId: cuidSchema.optional(),
    /** Only top-level nodes. Used by the navigation builder. */
    rootsOnly: z.coerce.boolean().default(false),
    includeDeleted: z.coerce.boolean().default(false),
  });

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
export type CategoryMoveInput = z.infer<typeof categoryMoveSchema>;