import { z } from 'zod';

import { DEFAULT_SORT, SORTABLE_FIELDS } from '@stc/constants';
import { RESULT_TYPE } from '@stc/types';

import {
  cuidSchema,
  offsetPaginationSchema,
  optionalUrlSchema,
  publishStatusSchema,
  searchSchema,
  slugSchema,
  sortSchema,
  urlSchema,
  yearSchema,
} from './common.js';

/**
 * Result contracts.
 *
 * A result page has TWO independent lifecycles, and conflating them is the
 * classic mistake:
 *
 *   status      - is the PAGE published? (published weeks early to rank)
 *   isDeclared  - has the RESULT actually been announced?
 *
 * "JEE Main Result 2026: Date, Time & Direct Link" goes live in February and
 * ranks; the result itself lands in April. Declaration is its own operation.
 */

const multi = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
    z.array(inner).max(30).optional(),
  );

/** Direct download links. Stored as JSON - never queried independently. */
export const resultLinkSchema = z.object({
  label: z.string().trim().min(2).max(120),
  url: urlSchema,
  region: z.string().trim().max(60).nullish(),
});

export const resultCreateSchema = z.object({
  title: z.string().trim().min(5).max(240),
  slug: slugSchema.optional(),
  resultType: z.enum(RESULT_TYPE),
  year: yearSchema,
  examId: cuidSchema.nullish(),
  examYearId: cuidSchema.nullish(),
  boardId: cuidSchema.nullish(),
  boardClassId: cuidSchema.nullish(),
  /** Announced expected date. Drives the countdown and the cache TTL. */
  expectedAt: z.coerce.date().nullish(),
  officialUrl: optionalUrlSchema,
  status: publishStatusSchema.default('DRAFT'),
});

export const resultUpdateSchema = resultCreateSchema.omit({ slug: true }).partial().extend({
  expectedVersion: z.number().int().min(1).optional(),
});

export const resultChangeSlugSchema = z.object({
  newSlug: slugSchema,
  reason: z.string().max(200).optional(),
});

/**
 * The declaration transition. Separate from update because it is the moment
 * the page`s meaning changes, and it demands the links that make it useful.
 */
export const resultDeclareSchema = z.object({
  declaredAt: z.coerce.date().optional(),
  officialUrl: urlSchema.optional(),
  links: z.array(resultLinkSchema).min(1).max(20),
  statistics: z
    .object({
      appeared: z.number().int().min(0).optional(),
      passed: z.number().int().min(0).optional(),
      passPercentage: z.number().min(0).max(100).optional(),
      toppers: z
        .array(z.object({ name: z.string().max(120), score: z.string().max(40) }))
        .max(20)
        .optional(),
    })
    .passthrough()
    .optional(),
});

/** Undo a premature or mistaken declaration. Always audited. */
export const resultRetractSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});

export const resultListQuerySchema = offsetPaginationSchema
  .merge(searchSchema)
  .merge(sortSchema(SORTABLE_FIELDS.result, DEFAULT_SORT.result.field, DEFAULT_SORT.result.dir))
  .extend({
    year: multi(z.coerce.number().int()),
    resultType: multi(z.enum(RESULT_TYPE)),
    examId: multi(cuidSchema),
    boardId: multi(cuidSchema),
    isDeclared: z.coerce.boolean().optional(),
    /** Results expected in the next N days - drives the "upcoming" widget. */
    expectedWithinDays: z.coerce.number().int().min(1).max(365).optional(),
    status: publishStatusSchema.optional(),
    includeDeleted: z.coerce.boolean().default(false),
    withFacets: z.coerce.boolean().default(false),
  });

export type ResultCreateInput = z.infer<typeof resultCreateSchema>;
export type ResultUpdateInput = z.infer<typeof resultUpdateSchema>;
export type ResultListQuery = z.infer<typeof resultListQuerySchema>;
export type ResultDeclareInput = z.infer<typeof resultDeclareSchema>;
export type ResultRetractInput = z.infer<typeof resultRetractSchema>;
export type ResultLinkInput = z.infer<typeof resultLinkSchema>;