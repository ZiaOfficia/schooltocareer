import { z } from 'zod';

import { LOCALE } from '@stc/types';

/**
 * Search contracts.
 *
 * `type` is a free string array rather than an enum: the searchable kinds come
 * from the source REGISTRY at runtime, so hardcoding them here would mean two
 * lists that drift. The service validates against the registry and returns the
 * allowed set on mismatch.
 */

const multi = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
    z.array(inner).max(10).optional(),
  );

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  type: multi(z.string().max(60)),
  locale: z.enum(LOCALE).optional(),
  page: z.coerce.number().int().min(1).max(50).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  locale: z.enum(LOCALE).optional(),
  limit: z.coerce.number().int().min(1).max(15).default(8),
});

export const searchAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export const reindexSchema = z.object({
  ownerType: z.string().max(40).optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type SuggestQueryInput = z.infer<typeof suggestQuerySchema>;
export type ReindexInput = z.infer<typeof reindexSchema>;