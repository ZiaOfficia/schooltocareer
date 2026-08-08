import { Router } from 'express';

import { PERMISSIONS } from '@stc/constants';

import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import { BlogController } from './blog.controller.js';
import type { BlogService } from './blog.service.js';
import {
  postAutosaveSchema,
  postChangeSlugSchema,
  postCreateSchema,
  postIdParams,
  postListQuerySchema,
  postPublishSchema,
  postRollbackSchema,
  postUpdateSchema,
} from './blog.validation.js';

export function blogRoutes(service: BlogService, jwtSecret: Uint8Array): Router {
  const controller = new BlogController(service);
  const router = Router();

  const admin = Router();
  admin.use(authenticate(jwtSecret));

  admin.get('/', requirePermission(PERMISSIONS.CONTENT_READ), validate({ query: postListQuerySchema }), controller.listAdmin);
  admin.get('/:id', requirePermission(PERMISSIONS.CONTENT_READ), validate({ params: postIdParams }), controller.getById);
  admin.get('/:id/preview', requirePermission(PERMISSIONS.CONTENT_READ), validate({ params: postIdParams }), controller.preview);
  admin.get('/:id/revisions', requirePermission(PERMISSIONS.CONTENT_READ), validate({ params: postIdParams }), controller.listRevisions);
  admin.get('/:id/active-drafts', requirePermission(PERMISSIONS.CONTENT_READ), validate({ params: postIdParams }), controller.listActiveDrafts);

  admin.post('/', requirePermission(PERMISSIONS.CONTENT_CREATE), validate({ body: postCreateSchema }), controller.create);

  // Autosave accepts either permission: an AUTHOR saving their own draft and an
  // EDITOR saving anyone`s both go through here, and row-level ownership is
  // checked in the service where the row is available.
  admin.put(
    '/:id/autosave',
    requireAnyPermission(PERMISSIONS.CONTENT_UPDATE, PERMISSIONS.CONTENT_UPDATE_OWN),
    validate({ params: postIdParams, body: postAutosaveSchema }),
    controller.autosave,
  );
  admin.patch(
    '/:id',
    requireAnyPermission(PERMISSIONS.CONTENT_UPDATE, PERMISSIONS.CONTENT_UPDATE_OWN),
    validate({ params: postIdParams, body: postUpdateSchema }),
    controller.update,
  );

  // Publishing is a separate permission: an AUTHOR drafts, an EDITOR ships.
  admin.post('/:id/publish', requirePermission(PERMISSIONS.CONTENT_PUBLISH), validate({ params: postIdParams, body: postPublishSchema }), controller.publish);
  admin.post('/:id/unpublish', requirePermission(PERMISSIONS.CONTENT_PUBLISH), validate({ params: postIdParams }), controller.unpublish);
  admin.post('/:id/rollback', requirePermission(PERMISSIONS.CONTENT_ROLLBACK), validate({ params: postIdParams, body: postRollbackSchema }), controller.rollback);
  admin.post('/:id/change-slug', requirePermission(PERMISSIONS.CONTENT_CHANGE_SLUG), validate({ params: postIdParams, body: postChangeSlugSchema }), controller.changeSlug);
  admin.delete('/:id', requirePermission(PERMISSIONS.CONTENT_DELETE), validate({ params: postIdParams }), controller.remove);

  router.use('/admin', admin);

  router.get('/', validate({ query: postListQuerySchema }), controller.listPublic);
  router.get('/search', controller.search);
  // Posts are addressed by their full canonical path, which may be
  // /blog/:category/:slug or /blog/:slug.
  router.get('/{*splat}', controller.getPublicByPath);

  return router;
}