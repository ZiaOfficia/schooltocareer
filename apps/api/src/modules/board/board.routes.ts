import { Router } from 'express';

import { PERMISSIONS } from '@stc/constants';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import { BoardController } from './board.controller.js';
import type { BoardService } from './board.service.js';
import {
  boardChangeSlugSchema,
  boardCreateSchema,
  boardIdParams,
  boardListQuerySchema,
  boardSlugParams,
  boardUpdateSchema,
} from './board.validation.js';

/**
 * Same two-tree layout as exam.routes.ts: separate PUBLIC and ADMIN routers, so
 * `publicOnly` is decided by the route rather than by a request parameter.
 * Admin mounts BEFORE `/:slug`, which otherwise swallows it.
 */
export function boardRoutes(service: BoardService, jwtSecret: Uint8Array): Router {
  const controller = new BoardController(service);
  const router = Router();

  const admin = Router();
  admin.use(authenticate(jwtSecret));

  admin.get(
    '/',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ query: boardListQuerySchema }),
    controller.listAdmin,
  );
  admin.get(
    '/:id',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ params: boardIdParams }),
    controller.getById,
  );
  admin.post(
    '/',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ body: boardCreateSchema }),
    controller.create,
  );
  admin.patch(
    '/:id',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ params: boardIdParams, body: boardUpdateSchema }),
    controller.update,
  );
  admin.post(
    '/:id/publish',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ params: boardIdParams }),
    controller.publish,
  );
  admin.post(
    '/:id/unpublish',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ params: boardIdParams }),
    controller.unpublish,
  );
  // Renaming a board rewrites every class URL beneath it, so it needs the
  // dedicated slug permission rather than plain board:manage.
  admin.post(
    '/:id/change-slug',
    requirePermission(PERMISSIONS.CONTENT_CHANGE_SLUG),
    validate({ params: boardIdParams, body: boardChangeSlugSchema }),
    controller.changeSlug,
  );
  admin.delete(
    '/:id',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ params: boardIdParams }),
    controller.remove,
  );
  admin.post(
    '/:id/restore',
    requirePermission(PERMISSIONS.BOARD_MANAGE),
    validate({ params: boardIdParams }),
    controller.restore,
  );

  router.use('/admin', admin);

  router.get('/', validate({ query: boardListQuerySchema }), controller.listPublic);
  router.get('/feed', validate({ query: boardListQuerySchema }), controller.listFeed);
  router.get('/search', controller.search);
  router.get('/popular-slugs', controller.listPopularSlugs);
  router.get('/:slug', validate({ params: boardSlugParams }), controller.getPublicBySlug);

  return router;
}