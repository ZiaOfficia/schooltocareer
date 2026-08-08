import { z } from 'zod';
import { PAGINATION, SEO_LIMITS, RESERVED_SLUGS } from '@stc/constants';
import { LOCALE, PUBLISH_STATUS } from '@stc/types';

/**
 * Shared primitives. Every module schema composes these rather than
 * redeclaring `z.string().min(1)` forty times.
 *
 * These schemas run in BOTH places: Express validates the request body with
 * them, and the admin form validates the same shape client-side. One
 * definition, no drift.
 */

export const cuidSchema = z.string().cuid2().or(z.string().cuid());

export const slugSchema = z
  .string()
  .min(1)
  .max(SEO_LIMITS.SLUG_MAX)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase words separated by single hyphens')
  .refine((s) => !RESERVED_SLUGS.has(s), { message: 'This slug is reserved' });

export const localeSchema = z.enum(LOCALE).default('EN');
export const publishStatusSchema = z.enum(PUBLISH_STATUS);
export const sortDirSchema = z.enum(['asc', 'desc']);

export const urlSchema = z.string().url().max(2048);
export const optionalUrlSchema = urlSchema.or(z.literal('')).nullish();

export const yearSchema = z
  .number()
  .int()
  .min(1950)
  .max(new Date().getFullYear() + 5);

/** Coerced because query-string values always arrive as strings. */
export const offsetPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PER_PAGE)
    .default(PAGINATION.DEFAULT_PER_PAGE),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().max(512).optional(),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PER_PAGE)
    .default(PAGINATION.FEED_PER_PAGE),
});

export const searchSchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
});

/**
 * Builds a sort schema constrained to an allowlist. An open `sortBy` is both
 * an information leak (`?sortBy=passwordHash`) and an unindexed sort.
 */
export function sortSchema<const T extends readonly [string, ...string[]]>(
  fields: T,
  defaultField: T[number],
  defaultDir: 'asc' | 'desc' = 'desc',
) {
  return z.object({
    sortBy: z.enum(fields).default(defaultField),
    sortDir: sortDirSchema.default(defaultDir),
  });
}

export const seoFieldsSchema = z.object({
  metaTitle: z.string().max(SEO_LIMITS.TITLE_MAX).nullish(),
  metaDescription: z.string().max(SEO_LIMITS.DESCRIPTION_MAX).nullish(),
  keywords: z.array(z.string().max(60)).max(20).default([]),
  canonicalUrl: optionalUrlSchema,
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
  ogImageId: cuidSchema.nullish(),
});

export const idParamSchema = z.object({ id: cuidSchema });
export const slugParamSchema = z.object({ slug: slugSchema });

export type OffsetPaginationInput = z.infer<typeof offsetPaginationSchema>;
export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>;
export type SeoFieldsInput = z.infer<typeof seoFieldsSchema>;
