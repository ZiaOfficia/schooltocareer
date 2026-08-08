import { z } from 'zod';

export {
  postAutosaveSchema,
  postChangeSlugSchema,
  postCreateSchema,
  postFeedQuerySchema,
  postListQuerySchema,
  postPublishSchema,
  postRollbackSchema,
  postUpdateSchema,
  type PostAutosaveInput,
  type PostCreateInput,
  type PostFeedQuery,
  type PostListQuery,
  type PostPublishInput,
  type PostRollbackInput,
  type PostUpdateInput,
} from '@stc/validation';

export const postIdParams = z.object({ id: z.string().min(1) });
export const postSlugParams = z.object({ slug: z.string().min(1).max(140) });
/** Preview token for unpublished content. Signed, short-lived. */
export const previewQuery = z.object({ token: z.string().min(20).max(2048) });