import { z } from 'zod';

export {
  resultChangeSlugSchema,
  resultCreateSchema,
  resultDeclareSchema,
  resultListQuerySchema,
  resultRetractSchema,
  resultUpdateSchema,
  type ResultCreateInput,
  type ResultDeclareInput,
  type ResultListQuery,
  type ResultRetractInput,
  type ResultUpdateInput,
} from '@stc/validation';

export const resultIdParams = z.object({ id: z.string().min(1) });
export const resultSlugParams = z.object({ slug: z.string().min(1).max(140) });