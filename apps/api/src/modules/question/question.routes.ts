import { Router } from 'express';

import { validate } from '../../middleware/validate.js';

import { QuestionController } from './question.controller.js';
import type { QuestionService } from './question.service.js';
import { examChapterParams, paperQuestionsParams, questionParams } from './question.validation.js';

/**
 * Public, read-only. There is no admin surface: questions are loaded by the
 * reviewed import script, and a correction is a re-import, not an API edit.
 * Fixed segments are registered before `/:publicId` so they are never read as ids.
 */
export function questionRoutes(service: QuestionService): Router {
  const controller = new QuestionController(service);
  const router = Router();

  router.get('/chapters/:exam/:subject/:chapter', validate({ params: examChapterParams }), controller.getChapter);
  router.get('/by-paper/:paperSlug', validate({ params: paperQuestionsParams }), controller.getPaperQuestions);
  router.get('/:publicId', validate({ params: questionParams }), controller.getQuestion);

  return router;
}
