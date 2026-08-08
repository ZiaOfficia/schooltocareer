import { z } from 'zod';

import { DEFAULT_SORT, SORTABLE_FIELDS } from '@stc/constants';
import { LOCALE, PAPER_FILE_ROLE, PAPER_TYPE } from '@stc/types';

import {
  cuidSchema,
  cursorPaginationSchema,
  offsetPaginationSchema,
  publishStatusSchema,
  searchSchema,
  slugSchema,
  sortSchema,
  yearSchema,
} from './common.js';

/**
 * Question paper contracts.
 *
 * The list query is the widest in the system - this is the faceted browse
 * surface over ~20,000 rows. Multi-value filters accept either `?year=2024` or
 * `?year=2024&year=2023`, which is how checkbox panels submit.
 */

/** Accepts a single value or a repeated parameter; always yields an array. */
const multi = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
    z.array(inner).max(30).optional(),
  );

export const questionPaperCreateSchema = z.object({
  title: z.string().trim().min(5).max(240),
  slug: slugSchema.optional(),
  paperType: z.enum(PAPER_TYPE),
  year: yearSchema,
  shift: z.string().trim().max(40).nullish(),
  setCode: z.string().trim().max(20).nullish(),
  locale: z.enum(LOCALE).default('EN'),
  examId: cuidSchema.nullish(),
  boardId: cuidSchema.nullish(),
  boardClassId: cuidSchema.nullish(),
  subjectId: cuidSchema.nullish(),
  totalQuestions: z.number().int().min(1).max(500).nullish(),
  totalMarks: z.number().int().min(1).max(2000).nullish(),
  durationMin: z.number().int().min(1).max(600).nullish(),
  status: publishStatusSchema.default('DRAFT'),
});

export const questionPaperUpdateSchema = questionPaperCreateSchema
  .omit({ slug: true })
  .partial()
  .extend({ expectedVersion: z.number().int().min(1).optional() });

export const questionPaperChangeSlugSchema = z.object({
  newSlug: slugSchema,
  reason: z.string().max(200).optional(),
});

/** Attaches a new FILE VERSION. Files are never overwritten in place. */
export const questionPaperFileSchema = z.object({
  mediaId: cuidSchema,
  fileRole: z.enum(PAPER_FILE_ROLE),
  locale: z.enum(LOCALE).default('EN'),
  changeNote: z.string().max(500).optional(),
});

const facetFilters = {
  year: multi(z.coerce.number().int()),
  paperType: multi(z.enum(PAPER_TYPE)),
  examId: multi(cuidSchema),
  boardId: multi(cuidSchema),
  boardClassId: multi(cuidSchema),
  subjectId: multi(cuidSchema),
  shift: multi(z.string().max(40)),
  locale: multi(z.enum(LOCALE)),
  hasSolution: z.coerce.boolean().optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
};

export const questionPaperListQuerySchema = offsetPaginationSchema
  .merge(searchSchema)
  .merge(
    sortSchema(
      SORTABLE_FIELDS.questionPaper,
      DEFAULT_SORT.questionPaper.field,
      DEFAULT_SORT.questionPaper.dir,
    ),
  )
  .extend({
    ...facetFilters,
    status: publishStatusSchema.optional(),
    includeDeleted: z.coerce.boolean().default(false),
    /** Facets cost one aggregation per field; opt out on pages that do not show them. */
    withFacets: z.coerce.boolean().default(false),
  });

export const questionPaperFeedQuerySchema = cursorPaginationSchema
  .merge(
    sortSchema(
      SORTABLE_FIELDS.questionPaper,
      DEFAULT_SORT.questionPaper.field,
      DEFAULT_SORT.questionPaper.dir,
    ),
  )
  .extend(facetFilters);

export type QuestionPaperCreateInput = z.infer<typeof questionPaperCreateSchema>;
export type QuestionPaperUpdateInput = z.infer<typeof questionPaperUpdateSchema>;
export type QuestionPaperListQuery = z.infer<typeof questionPaperListQuerySchema>;
export type QuestionPaperFeedQuery = z.infer<typeof questionPaperFeedQuerySchema>;
export type QuestionPaperFileInput = z.infer<typeof questionPaperFileSchema>;