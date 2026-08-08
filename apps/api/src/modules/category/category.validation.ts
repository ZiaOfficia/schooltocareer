import { z } from 'zod';

export {
  categoryChangeSlugSchema,
  categoryCreateSchema,
  categoryListQuerySchema,
  categoryMoveSchema,
  categoryUpdateSchema,
  type CategoryCreateInput,
  type CategoryListQuery,
  type CategoryMoveInput,
  type CategoryUpdateInput,
} from '@stc/validation';

export const categoryIdParams = z.object({ id: z.string().min(1) });
export const categorySlugParams = z.object({ slug: z.string().min(1).max(120) });