import { z } from 'zod';

import { DEFAULT_SORT, SORTABLE_FIELDS } from '@stc/constants';
import { BOARD_TYPE, STREAM_TYPE } from '@stc/types';

import {
  cuidSchema,
  offsetPaginationSchema,
  optionalUrlSchema,
  publishStatusSchema,
  searchSchema,
  seoFieldsSchema,
  slugSchema,
  sortSchema,
} from './common.js';

/**
 * Board contracts. Structurally identical to exam.ts — same Create / Update /
 * ListQuery / ChangeSlug quartet, same rules about what `slug` may do.
 */

export const boardCreateSchema = z.object({
  name: z.string().trim().min(3).max(200),
  shortName: z.string().trim().min(2).max(40),
  slug: slugSchema.optional(),
  type: z.enum(BOARD_TYPE),
  stateId: cuidSchema.nullish(),
  establishedYear: z.number().int().min(1800).max(new Date().getFullYear()).nullish(),
  headquarters: z.string().trim().max(160).nullish(),
  officialWebsite: optionalUrlSchema,
  logoId: cuidSchema.nullish(),
  description: z.string().max(20_000).nullish(),
  status: publishStatusSchema.default('DRAFT'),
  seo: seoFieldsSchema.partial().optional(),
});

/** `slug` is absent on purpose — renaming is its own permissioned endpoint. */
export const boardUpdateSchema = boardCreateSchema.omit({ slug: true }).partial().extend({
  expectedVersion: z.number().int().min(1).optional(),
});

export const boardChangeSlugSchema = z.object({
  newSlug: slugSchema,
  reason: z.string().max(200).optional(),
});

export const boardListQuerySchema = offsetPaginationSchema
  .merge(searchSchema)
  .merge(sortSchema(SORTABLE_FIELDS.board, DEFAULT_SORT.board.field, DEFAULT_SORT.board.dir))
  .extend({
    type: z.enum(BOARD_TYPE).optional(),
    stateId: cuidSchema.optional(),
    stateSlug: slugSchema.optional(),
    status: publishStatusSchema.optional(),
    includeDeleted: z.coerce.boolean().default(false),
  });

/**
 * A class within a board. `slug` is scoped to the board
 * (@@unique([boardId, slug])), which is what makes `class-10` reusable across
 * every board instead of colliding globally.
 */
export const boardClassCreateSchema = z.object({
  classLevelId: cuidSchema,
  stream: z.enum(STREAM_TYPE).nullish(),
  slug: slugSchema.optional(),
  status: publishStatusSchema.default('DRAFT'),
});

export const boardClassUpdateSchema = boardClassCreateSchema.omit({ slug: true }).partial();

export type BoardCreateInput = z.infer<typeof boardCreateSchema>;
export type BoardUpdateInput = z.infer<typeof boardUpdateSchema>;
export type BoardListQuery = z.infer<typeof boardListQuerySchema>;
export type BoardChangeSlugInput = z.infer<typeof boardChangeSlugSchema>;
export type BoardClassCreateInput = z.infer<typeof boardClassCreateSchema>;
export type BoardClassUpdateInput = z.infer<typeof boardClassUpdateSchema>;
