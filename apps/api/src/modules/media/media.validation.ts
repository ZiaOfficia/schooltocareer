import { z } from 'zod';

export {
  mediaListQuerySchema,
  mediaReplaceSchema,
  mediaUpdateSchema,
  uploadConfirmSchema,
  uploadSignSchema,
  type MediaListQuery,
  type MediaReplaceInput,
  type MediaUpdateInput,
  type UploadConfirmInput,
  type UploadSignInput,
} from '@stc/validation';

export const mediaIdParams = z.object({ id: z.string().min(1) });