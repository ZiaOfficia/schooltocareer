import { Router } from 'express';

import { PERMISSIONS } from '@stc/constants';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';

import { SearchController } from './search.controller.js';
import type { SearchService } from './search.service.js';
import {
  reindexSchema,
  searchAnalyticsQuerySchema,
  searchQuerySchema,
  suggestQuerySchema,
} from './search.validation.js';

export function searchRoutes(service: SearchService, jwtSecret: Uint8Array, ipSalt: string): Router {
  const controller = new SearchController(service);
  const router = Router();

  // Suggest fires on every keystroke, so it gets a much higher ceiling than
  // full search - and a much lower cost per call, since it is cached.
  const suggestLimiter = rateLimit({ windowMs: 60_000, max: 600, ipSalt, name: 'suggest' });
  const searchLimiter = rateLimit({ windowMs: 60_000, max: 120, ipSalt, name: 'search' });

  router.get('/', searchLimiter, validate({ query: searchQuerySchema }), controller.search);
  router.get('/suggest', suggestLimiter, validate({ query: suggestQuerySchema }), controller.suggest);

  const admin = Router();
  admin.use(authenticate(jwtSecret));

  admin.get('/health', requirePermission(PERMISSIONS.SEARCH_REINDEX), controller.health);
  // The content-gap report: what people searched for and did not find.
  admin.get(
    '/analytics',
    requirePermission(PERMISSIONS.SEARCH_REINDEX),
    validate({ query: searchAnalyticsQuerySchema }),
    controller.analytics,
  );
  // Reindex enqueues one outbox event per row; it is bounded, but it is still
  // the heaviest button in the admin.
  admin.post(
    '/reindex',
    requirePermission(PERMISSIONS.SEARCH_REINDEX),
    validate({ body: reindexSchema }),
    controller.reindex,
  );

  router.use('/admin', admin);

  return router;
}