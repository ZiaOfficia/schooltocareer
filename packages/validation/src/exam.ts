import { z } from 'zod';
import { SORTABLE_FIELDS, DEFAULT_SORT } from '@stc/constants';
import {
  EDUCATION_LEVEL,
  EXAM_EVENT_TYPE,
  EXAM_FREQUENCY,
  EXAM_LEVEL,
  EXAM_MODE,
} from '@stc/types';
import {
  cuidSchema,
  offsetPaginationSchema,
  publishStatusSchema,
  searchSchema,
  seoFieldsSchema,
  slugSchema,
  sortSchema,
  optionalUrlSchema,
  yearSchema,
} from './common.js';

/**
 * Exam module contracts. The reference implementation — every other module
 * mirrors this file's shape: Create / Update / ListQuery / nested child
 * schemas, with DTO types inferred rather than hand-written.
 */

export const examCreateSchema = z.object({
  name: z.string().trim().min(3).max(160),
  shortName: z.string().trim().min(2).max(40),
  fullName: z.string().trim().max(240).nullish(),
  slug: slugSchema.optional(), // generated from name when omitted
  conductingBody: z.string().trim().min(2).max(160),
  categoryId: cuidSchema.nullish(),
  boardId: cuidSchema.nullish(),
  level: z.enum(EXAM_LEVEL),
  mode: z.enum(EXAM_MODE),
  frequency: z.enum(EXAM_FREQUENCY),
  educationLevel: z.enum(EDUCATION_LEVEL),
  officialWebsite: optionalUrlSchema,
  logoId: cuidSchema.nullish(),
  overview: z.string().max(20_000).nullish(),
  isActive: z.boolean().default(true),
  status: publishStatusSchema.default('DRAFT'),
  seo: seoFieldsSchema.partial().optional(),
});

/**
 * `slug` is absent from the update schema on purpose. Renaming is a separate
 * endpoint guarded by `content:change-slug`, because it must also write
 * SlugHistory, generate redirects and invalidate caches in one transaction.
 */
export const examUpdateSchema = examCreateSchema.omit({ slug: true }).partial().extend({
  /** Optimistic-concurrency guard — rejects a stale form submission. */
  expectedVersion: z.number().int().min(1).optional(),
});

export const examChangeSlugSchema = z.object({
  newSlug: slugSchema,
  reason: z.string().max(200).optional(),
});

export const examListQuerySchema = offsetPaginationSchema
  .merge(searchSchema)
  .merge(sortSchema(SORTABLE_FIELDS.exam, DEFAULT_SORT.exam.field, DEFAULT_SORT.exam.dir))
  .extend({
    categoryId: cuidSchema.optional(),
    categorySlug: slugSchema.optional(),
    boardId: cuidSchema.optional(),
    level: z.enum(EXAM_LEVEL).optional(),
    mode: z.enum(EXAM_MODE).optional(),
    educationLevel: z.enum(EDUCATION_LEVEL).optional(),
    status: publishStatusSchema.optional(),
    isActive: z.coerce.boolean().optional(),
    /** Admin-only; the middleware strips it for unauthenticated callers. */
    includeDeleted: z.coerce.boolean().default(false),
  });

export const examYearCreateSchema = z.object({
  year: yearSchema,
  sessionName: z.string().trim().max(60).nullish(),
  slug: slugSchema.optional(),
  isCurrent: z.boolean().default(false),
  applicationFee: z.record(z.string(), z.number().int().min(0)).nullish(),
  notificationUrl: optionalUrlSchema,
});

export const examEventCreateSchema = z
  .object({
    type: z.enum(EXAM_EVENT_TYPE),
    title: z.string().trim().min(3).max(160),
    startDate: z.coerce.date().nullish(),
    endDate: z.coerce.date().nullish(),
    isTentative: z.boolean().default(false),
    officialUrl: optionalUrlSchema,
    order: z.number().int().min(0).default(0),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export const examPublishSchema = z.object({
  publishedAt: z.coerce.date().optional(),
});

export type ExamCreateInput = z.infer<typeof examCreateSchema>;
export type ExamUpdateInput = z.infer<typeof examUpdateSchema>;
export type ExamListQuery = z.infer<typeof examListQuerySchema>;
export type ExamChangeSlugInput = z.infer<typeof examChangeSlugSchema>;
export type ExamYearCreateInput = z.infer<typeof examYearCreateSchema>;
export type ExamEventCreateInput = z.infer<typeof examEventCreateSchema>;
