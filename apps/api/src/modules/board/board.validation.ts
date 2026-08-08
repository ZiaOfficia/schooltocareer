import { z } from 'zod';

/**
 * Domain contracts live in @stc/validation so the admin app validates its forms
 * with the same objects the API validates requests with. Re-exported here so
 * the module surface is complete; HTTP-only schemas are declared locally.
 */
export {
  boardChangeSlugSchema,
  boardClassCreateSchema,
  boardClassUpdateSchema,
  boardCreateSchema,
  boardListQuerySchema,
  boardUpdateSchema,
  type BoardCreateInput,
  type BoardListQuery,
  type BoardUpdateInput,
} from '@stc/validation';

export const boardIdParams = z.object({ id: z.string().min(1) });
export const boardSlugParams = z.object({ slug: z.string().min(1).max(120) });
export const boardClassParams = z.object({
  slug: z.string().min(1).max(120),
  classSlug: z.string().min(1).max(120),
});