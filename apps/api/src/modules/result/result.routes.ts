import { Router } from 'express';

import { PERMISSIONS } from '@stc/constants';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import { ResultController } from './result.controller.js';
import type { ResultService } from './result.service.js';
import {
  resultChangeSlugSchema,
  resultCreateSchema,
  resultDeclareSchema,
  resultIdParams,
  resultListQuerySchema,
  resultRetractSchema,
  resultSlugParams,
  resultUpdateSchema,
} from './result.validation.js';

export function resultRoutes(service: ResultService, jwtSecret: Uint8Array): Router {
  const controller = new ResultController(service);
  const router = Router();

  const admin = Router();
  admin.use(authenticate(jwtSecret));

  admin.get('/', requirePermission(PERMISSIONS.RESULT_MANAGE), validate({ query: resultListQuerySchema }), controller.listAdmin);
  admin.get('/:id', requirePermission(PERMISSIONS.RESULT_MANAGE), validate({ params: resultIdParams }), controller.getById);
  admin.post('/', requirePermission(PERMISSIONS.RESULT_MANAGE), validate({ body: resultCreateSchema }), controller.create);
  admin.patch('/:id', requirePermission(PERMISSIONS.RESULT_MANAGE), validate({ params: resultIdParams, body: resultUpdateSchema }), controller.update);
  admin.post('/:id/publish', requirePermission(PERMISSIONS.RESULT_PUBLISH), validate({ params: resultIdParams }), controller.publish);
  admin.post('/:id/unpublish', requirePermission(PERMISSIONS.RESULT_PUBLISH), validate({ params: resultIdParams }), controller.unpublish);
  // Declaring is the highest-stakes action in the system: it is visible to tens
  // of thousands of students within minutes. Same permission as publishing.
  admin.post('/:id/declare', requirePermission(PERMISSIONS.RESULT_PUBLISH), validate({ params: resultIdParams, body: resultDeclareSchema }), controller.declare);
  admin.post('/:id/retract', requirePermission(PERMISSIONS.RESULT_PUBLISH), validate({ params: resultIdParams, body: resultRetractSchema }), controller.retract);
  admin.post('/:id/change-slug', requirePermission(PERMISSIONS.CONTENT_CHANGE_SLUG), validate({ params: resultIdParams, body: resultChangeSlugSchema }), controller.changeSlug);
  admin.delete('/:id', requirePermission(PERMISSIONS.RESULT_MANAGE), validate({ params: resultIdParams }), controller.remove);

  router.use('/admin', admin);

  router.get('/', validate({ query: resultListQuerySchema }), controller.listPublic);
  router.get('/upcoming', controller.listUpcoming);
  router.get('/search', controller.search);
  router.get('/:slug', validate({ params: resultSlugParams }), controller.getPublicBySlug);

  return router;
}