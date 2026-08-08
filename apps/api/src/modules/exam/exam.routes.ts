import { Router } from 'express';
import { z } from 'zod';

import { PERMISSIONS } from '@stc/constants';
import { examChangeSlugSchema, examCreateSchema, examListQuerySchema, examUpdateSchema } from '@stc/validation';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import { ExamController } from './exam.controller.js';
import type { ExamService } from './exam.service.js';

const idParams = z.object({ id: z.string().min(1) });
const slugParams = z.object({ slug: z.string().min(1).max(120) });

/**
 * Route table.
 *
 * PUBLIC and ADMIN routes are separate router trees rather than one tree with
 * conditional auth. That separation is why `publicOnly` can be decided by the
 * route instead of by a request parameter — a client cannot escalate to seeing
 * drafts by adding `?status=DRAFT`, because the public handler never passes it.
 */
export function examRoutes(service: ExamService, jwtSecret: Uint8Array): Router {
  const controller = new ExamController(service);
  const router = Router();

  // ── Admin ────────────────────────────────────────────────────────────────
  // Mounted BEFORE `/:slug`, or Express would match `/exams/admin` as an exam
  // with the slug "admin". (`admin` is in RESERVED_SLUGS for the same reason —
  // belt and braces, because this ordering is easy to break in a later edit.)
  const admin = Router();
  admin.use(authenticate(jwtSecret));

  admin.get(
    '/',
    requirePermission(PERMISSIONS.EXAM_MANAGE),
    validate({ query: examListQuerySchema }),
    controller.listAdmin,
  );

  admin.get(
    '/:id',
    requirePermission(PERMISSIONS.EXAM_MANAGE),
    validate({ params: idParams }),
    controller.getById,
  );

  admin.post(
    '/',
    requirePermission(PERMISSIONS.EXAM_MANAGE),
    validate({ body: examCreateSchema }),
    controller.create,
  );

  admin.patch(
    '/:id',
    requirePermission(PERMISSIONS.EXAM_MANAGE),
    validate({ params: idParams, body: examUpdateSchema }),
    controller.update,
  );

  // Publishing is a separate permission from editing: an AUTHOR may draft an
  // exam page but must not be able to put it in front of Google.
  admin.post(
    '/:id/publish',
    requirePermission(PERMISSIONS.EXAM_PUBLISH),
    validate({ params: idParams }),
    controller.publish,
  );

  admin.post(
    '/:id/unpublish',
    requirePermission(PERMISSIONS.EXAM_PUBLISH),
    validate({ params: idParams }),
    controller.unpublish,
  );

  // Renaming is its own permission because it rewrites live URLs.
  admin.post(
    '/:id/change-slug',
    requirePermission(PERMISSIONS.CONTENT_CHANGE_SLUG),
    validate({ params: idParams, body: examChangeSlugSchema }),
    controller.changeSlug,
  );

  admin.delete(
    '/:id',
    requirePermission(PERMISSIONS.EXAM_MANAGE),
    validate({ params: idParams }),
    controller.remove,
  );

  admin.post(
    '/:id/restore',
    requirePermission(PERMISSIONS.EXAM_MANAGE),
    validate({ params: idParams }),
    controller.restore,
  );

  router.use('/admin', admin);

  // ── Public ───────────────────────────────────────────────────────────────
  // Specific paths first, `/:slug` last — it matches anything.
  router.get('/', validate({ query: examListQuerySchema }), controller.listPublic);
  router.get('/feed', validate({ query: examListQuerySchema }), controller.listFeed);
  router.get('/search', controller.search);
  router.get('/popular-slugs', controller.listPopularSlugs);
  router.get('/:slug', validate({ params: slugParams }), controller.getPublicBySlug);

  return router;
}
