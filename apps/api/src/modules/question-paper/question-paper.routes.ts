import { Router } from 'express';

import { PERMISSIONS } from '@stc/constants';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import { QuestionPaperController } from './question-paper.controller.js';
import type { QuestionPaperService } from './question-paper.service.js';
import {
  paperIdParams,
  questionPaperChangeSlugSchema,
  paperSlugParams,
  questionPaperCreateSchema,
  questionPaperFeedQuerySchema,
  questionPaperFileSchema,
  questionPaperListQuerySchema,
  questionPaperUpdateSchema,
} from './question-paper.validation.js';

export function questionPaperRoutes(service: QuestionPaperService, jwtSecret: Uint8Array): Router {
  const controller = new QuestionPaperController(service);
  const router = Router();

  const admin = Router();
  admin.use(authenticate(jwtSecret));

  admin.get('/', requirePermission(PERMISSIONS.PAPER_MANAGE), validate({ query: questionPaperListQuerySchema }), controller.listAdmin);
  admin.get('/:id', requirePermission(PERMISSIONS.PAPER_MANAGE), validate({ params: paperIdParams }), controller.getById);
  admin.get('/:id/files', requirePermission(PERMISSIONS.PAPER_MANAGE), validate({ params: paperIdParams }), controller.listFileVersions);
  admin.post('/', requirePermission(PERMISSIONS.PAPER_MANAGE), validate({ body: questionPaperCreateSchema }), controller.create);
  admin.patch('/:id', requirePermission(PERMISSIONS.PAPER_MANAGE), validate({ params: paperIdParams, body: questionPaperUpdateSchema }), controller.update);
  // Attaching a file creates a new VERSION; it never overwrites.
  admin.post('/:id/files', requirePermission(PERMISSIONS.PAPER_MANAGE), validate({ params: paperIdParams, body: questionPaperFileSchema }), controller.addFile);
  admin.post('/:id/publish', requirePermission(PERMISSIONS.PAPER_PUBLISH), validate({ params: paperIdParams }), controller.publish);
  admin.post('/:id/unpublish', requirePermission(PERMISSIONS.PAPER_PUBLISH), validate({ params: paperIdParams }), controller.unpublish);
  admin.post('/:id/change-slug', requirePermission(PERMISSIONS.CONTENT_CHANGE_SLUG), validate({ params: paperIdParams, body: questionPaperChangeSlugSchema }), controller.changeSlug);
  admin.delete('/:id', requirePermission(PERMISSIONS.PAPER_MANAGE), validate({ params: paperIdParams }), controller.remove);

  router.use('/admin', admin);

  router.get('/', validate({ query: questionPaperListQuerySchema }), controller.listPublic);
  router.get('/feed', validate({ query: questionPaperFeedQuerySchema }), controller.listFeed);
  router.get('/search', controller.search);
  router.get('/:slug', validate({ params: paperSlugParams }), controller.getPublicBySlug);

  return router;
}