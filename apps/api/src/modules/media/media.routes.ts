import { Router } from 'express';

import { PERMISSIONS } from '@stc/constants';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';

import { MediaController } from './media.controller.js';
import type { MediaService } from './media.service.js';
import {
  mediaIdParams,
  mediaListQuerySchema,
  mediaReplaceSchema,
  mediaUpdateSchema,
  uploadConfirmSchema,
  uploadSignSchema,
} from './media.validation.js';

/**
 * Every route here is authenticated. Media has no public surface: assets are
 * delivered by the storage CDN, so the API never serves bytes.
 */
export function mediaRoutes(service: MediaService, jwtSecret: Uint8Array, ipSalt: string): Router {
  const controller = new MediaController(service);
  const router = Router();

  router.use(authenticate(jwtSecret));

  // Signing is rate-limited separately and tightly: each signature is a licence
  // to write to our storage bucket, and an unbounded loop of them is a bill.
  const signLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    ipSalt,
    keyByUser: true,
    name: 'media-sign',
  });

  router.post(
    '/uploads/sign',
    requirePermission(PERMISSIONS.MEDIA_UPLOAD),
    signLimiter,
    validate({ body: uploadSignSchema }),
    controller.sign,
  );
  router.post(
    '/uploads/confirm',
    requirePermission(PERMISSIONS.MEDIA_UPLOAD),
    validate({ body: uploadConfirmSchema }),
    controller.confirm,
  );

  router.get('/abandoned', requirePermission(PERMISSIONS.MEDIA_DELETE), controller.listAbandoned);
  router.get('/', requirePermission(PERMISSIONS.MEDIA_UPLOAD), validate({ query: mediaListQuerySchema }), controller.list);
  router.get('/:id', requirePermission(PERMISSIONS.MEDIA_UPLOAD), validate({ params: mediaIdParams }), controller.getById);
  router.patch('/:id', requirePermission(PERMISSIONS.MEDIA_UPLOAD), validate({ params: mediaIdParams, body: mediaUpdateSchema }), controller.update);
  router.post('/:id/replace', requirePermission(PERMISSIONS.MEDIA_UPLOAD), validate({ params: mediaIdParams, body: mediaReplaceSchema }), controller.replace);
  router.delete('/:id', requirePermission(PERMISSIONS.MEDIA_DELETE), validate({ params: mediaIdParams }), controller.remove);

  return router;
}