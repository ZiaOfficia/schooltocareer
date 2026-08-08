import { z } from 'zod';

/**
 * Module validation surface.
 *
 * The DOMAIN contracts live in @stc/validation, not here, and are re-exported
 * below. That is deliberate: the admin app validates its forms with the exact
 * same Zod objects the API validates requests with, and the admin app cannot
 * import from apps/api. One definition, no drift.
 *
 * What lives HERE is validation that is purely an HTTP routing concern and has
 * no meaning to a form - path params, query-only toggles.
 */
export {
  examChangeSlugSchema,
  examCreateSchema,
  examEventCreateSchema,
  examListQuerySchema,
  examUpdateSchema,
  examYearCreateSchema,
  type ExamChangeSlugInput,
  type ExamCreateInput,
  type ExamListQuery,
  type ExamUpdateInput,
} from '@stc/validation';

export const examIdParams = z.object({ id: z.string().min(1) });
export const examSlugParams = z.object({ slug: z.string().min(1).max(120) });
export const examFeedQuery = z.object({ cursor: z.string().max(512).optional() });