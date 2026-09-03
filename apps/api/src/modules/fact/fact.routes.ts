import { Router } from 'express';
import { z } from 'zod';

import { PERMISSIONS } from '@stc/constants';
import { factApproveSchema, factChangeListQuerySchema, factDecisionSchema } from '@stc/validation';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import { FactController } from './fact.controller.js';
import type { FactService } from './fact.service.js';

const idParams = z.object({ id: z.string().min(1) });

/**
 * Route table — ADMIN ONLY, with no public tree at all.
 *
 * Every other module in this codebase mounts a public router alongside its
 * admin one. This module deliberately does not. A pending FactChange is an
 * unverified claim about an exam date; publishing it read-only would put an
 * unreviewed date on a URL, which is the exact outcome the review queue exists
 * to prevent. What a student sees is the CANONICAL value on the exam page,
 * after approval.
 *
 * Two permissions, not one. Reading the queue and writing a source-derived date
 * into canonical data are different acts with different consequences — the same
 * split as EXAM_MANAGE / EXAM_PUBLISH.
 */
export function factRoutes(service: FactService, jwtSecret: Uint8Array): Router {
  const controller = new FactController(service);
  const router = Router();

  router.use(authenticate(jwtSecret));

  router.get(
    '/metrics',
    requirePermission(PERMISSIONS.FACT_REVIEW),
    controller.metrics,
  );

  router.get(
    '/',
    requirePermission(PERMISSIONS.FACT_REVIEW),
    validate({ query: factChangeListQuerySchema }),
    controller.listChanges,
  );

  router.get(
    '/:id',
    requirePermission(PERMISSIONS.FACT_REVIEW),
    validate({ params: idParams }),
    controller.getChange,
  );

  // The only endpoint in the codebase that moves canonical exam data from a
  // machine-read value. Gated on its own permission for that reason.
  router.post(
    '/:id/approve',
    requirePermission(PERMISSIONS.FACT_APPROVE),
    validate({ params: idParams, body: factApproveSchema }),
    controller.approve,
  );

  // Rejecting and ignoring write no canonical data, so they sit on the lower
  // permission — clearing a queue of misreads should not require the authority
  // to publish one.
  router.post(
    '/:id/reject',
    requirePermission(PERMISSIONS.FACT_REVIEW),
    validate({ params: idParams, body: factDecisionSchema }),
    controller.reject,
  );

  router.post(
    '/:id/ignore',
    requirePermission(PERMISSIONS.FACT_REVIEW),
    validate({ params: idParams, body: factDecisionSchema }),
    controller.ignore,
  );

  return router;
}
