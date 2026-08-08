import { z } from 'zod';

export {
  questionPaperChangeSlugSchema,
  questionPaperCreateSchema,
  questionPaperFeedQuerySchema,
  questionPaperFileSchema,
  questionPaperListQuerySchema,
  questionPaperUpdateSchema,
  type QuestionPaperCreateInput,
  type QuestionPaperFeedQuery,
  type QuestionPaperFileInput,
  type QuestionPaperListQuery,
  type QuestionPaperUpdateInput,
} from '@stc/validation';

export const paperIdParams = z.object({ id: z.string().min(1) });
export const paperSlugParams = z.object({ slug: z.string().min(1).max(140) });