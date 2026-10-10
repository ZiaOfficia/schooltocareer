import { z } from 'zod';

import { slugSchema } from './common.js';

/**
 * Question bank contracts. Read-only for now: questions are loaded by the
 * reviewed import (tooling/scripts/import-questions.ts), not through the API.
 */

/**
 * A question's public id: the 10-character suffix of its URL. Lowercase
 * letters and digits only, so it can sit after a hyphen in a slug and still
 * be split off unambiguously.
 */
export const QUESTION_PUBLIC_ID_LENGTH = 10;

export const questionPublicIdSchema = z
  .string()
  .length(QUESTION_PUBLIC_ID_LENGTH)
  .regex(/^[a-z0-9]+$/, 'Must be lowercase letters and digits');

export const questionParams = z.object({ publicId: questionPublicIdSchema });

export const paperQuestionsParams = z.object({ paperSlug: slugSchema });

export const examChapterParams = z.object({
  exam: slugSchema,
  subject: slugSchema,
  chapter: slugSchema,
});

export type ExamChapterParams = z.infer<typeof examChapterParams>;
