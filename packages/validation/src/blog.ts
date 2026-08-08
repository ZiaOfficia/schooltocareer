import { z } from 'zod';

import { DEFAULT_SORT, SEO_LIMITS, SORTABLE_FIELDS } from '@stc/constants';
import { CONTENT_TYPE } from '@stc/types';

import {
  cuidSchema,
  cursorPaginationSchema,
  localeSchema,
  offsetPaginationSchema,
  publishStatusSchema,
  searchSchema,
  seoFieldsSchema,
  slugSchema,
  sortSchema,
} from './common.js';

/**
 * Blog / editorial contracts.
 *
 * Covers every authored ContentEntry type - ARTICLE, NEWS, NOTE, SYLLABUS,
 * GUIDE, STATIC_PAGE - because they share one table and one workflow. The
 * `type` discriminator decides the URL shape, not the schema.
 */

const multi = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
    z.array(inner).max(30).optional(),
  );

export const postCreateSchema = z.object({
  type: z.enum(CONTENT_TYPE).default('ARTICLE'),
  title: z.string().trim().min(10).max(240),
  slug: slugSchema.optional(),
  subtitle: z.string().trim().max(300).nullish(),
  excerpt: z.string().trim().max(500).nullish(),
  bodyHtml: z.string().max(500_000).nullish(),
  /** Editor AST. The source of truth for editing; bodyHtml is the render. */
  bodyJson: z.record(z.string(), z.unknown()).nullish(),
  locale: localeSchema,
  categoryId: cuidSchema.nullish(),
  featuredImageId: cuidSchema.nullish(),
  isFeatured: z.boolean().default(false),
  /** Entity anchors - an article about JEE Main links to that exam. */
  examId: cuidSchema.nullish(),
  boardId: cuidSchema.nullish(),
  boardClassSubjectId: cuidSchema.nullish(),
  chapterId: cuidSchema.nullish(),
  seo: seoFieldsSchema.partial().optional(),
});

export const postUpdateSchema = postCreateSchema.omit({ slug: true, type: true }).partial().extend({
  expectedVersion: z.number().int().min(1).optional(),
});

export const postChangeSlugSchema = z.object({
  newSlug: slugSchema,
  reason: z.string().max(200).optional(),
});

/** Autosave. Deliberately permissive - a half-written post must always save. */
export const postAutosaveSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  /** Optimistic-concurrency token; a mismatch means someone else saved first. */
  baseVersion: z.number().int().min(0),
});

/**
 * Publish now, or schedule.
 *
 * Scheduling needs NO new column: a future `publishedAt` on a DRAFT row is a
 * scheduled post, and a periodic task flips it. The index @@index([status,
 * publishedAt]) exists precisely for that scan.
 */
export const postPublishSchema = z.object({
  publishAt: z.coerce.date().optional(),
  changeNote: z.string().max(300).optional(),
});

export const postRollbackSchema = z.object({
  version: z.number().int().min(1),
  changeNote: z.string().max(300).optional(),
});

export const postListQuerySchema = offsetPaginationSchema
  .merge(searchSchema)
  .merge(sortSchema(SORTABLE_FIELDS.content, DEFAULT_SORT.content.field, DEFAULT_SORT.content.dir))
  .extend({
    type: multi(z.enum(CONTENT_TYPE)),
    categoryId: multi(cuidSchema),
    authorId: multi(cuidSchema),
    examId: cuidSchema.optional(),
    boardId: cuidSchema.optional(),
    isFeatured: z.coerce.boolean().optional(),
    status: publishStatusSchema.optional(),
    includeDeleted: z.coerce.boolean().default(false),
    withFacets: z.coerce.boolean().default(false),
  });

export const postFeedQuerySchema = cursorPaginationSchema
  .merge(sortSchema(SORTABLE_FIELDS.content, DEFAULT_SORT.content.field, DEFAULT_SORT.content.dir))
  .extend({
    type: multi(z.enum(CONTENT_TYPE)),
    categoryId: multi(cuidSchema),
  });

export const seoAuditSchema = z.object({
  metaTitleMax: z.literal(SEO_LIMITS.TITLE_MAX).optional(),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;
export type PostListQuery = z.infer<typeof postListQuerySchema>;
export type PostFeedQuery = z.infer<typeof postFeedQuerySchema>;
export type PostAutosaveInput = z.infer<typeof postAutosaveSchema>;
export type PostPublishInput = z.infer<typeof postPublishSchema>;
export type PostRollbackInput = z.infer<typeof postRollbackSchema>;