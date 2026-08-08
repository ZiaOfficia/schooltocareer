import { Router } from 'express';

import { PERMISSIONS } from '@stc/constants';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import { CategoryController } from './category.controller.js';
import type { CategoryService } from './category.service.js';
import {
  categoryChangeSlugSchema,
  categoryCreateSchema,
  categoryIdParams,
  categoryListQuerySchema,
  categoryMoveSchema,
  categorySlugParams,
  categoryUpdateSchema,
} from './category.validation.js';

export function categoryRoutes(service: CategoryService, jwtSecret: Uint8Array): Router {
  const controller = new CategoryController(service);
  const router = Router();

  const admin = Router();
  admin.use(authenticate(jwtSecret));

  admin.get('/', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ query: categoryListQuerySchema }), controller.listAdmin);
  admin.get('/:id', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ params: categoryIdParams }), controller.getById);
  admin.post('/', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ body: categoryCreateSchema }), controller.create);
  admin.patch('/:id', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ params: categoryIdParams, body: categoryUpdateSchema }), controller.update);
  // Reparenting is its own route because it rewrites descendant breadcrumbs.
  admin.post('/:id/move', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ params: categoryIdParams, body: categoryMoveSchema }), controller.move);
  admin.post('/:id/change-slug', requirePermission(PERMISSIONS.CONTENT_CHANGE_SLUG), validate({ params: categoryIdParams, body: categoryChangeSlugSchema }), controller.changeSlug);
  admin.delete('/:id', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ params: categoryIdParams }), controller.remove);

  router.use('/admin', admin);

  router.get('/tree', controller.getTree);
  router.get('/:slug', validate({ params: categorySlugParams }), controller.getPublicBySlug);

  return router;
}