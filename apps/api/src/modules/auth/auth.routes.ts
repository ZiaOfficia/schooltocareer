import { Router, type RequestHandler } from 'express';

import { loginSchema } from '@stc/validation';

import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';

import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

/**
 * Two routes. That is the whole module.
 *
 *   POST /auth/login   credentials -> access token
 *   GET  /auth/me      token       -> principal and permissions
 *
 * There is no register, no password reset, no refresh, no logout. Staff
 * accounts are created operationally (`pnpm admin:set-password`), and a
 * stateless access token has nothing to log out of — a logout route that only
 * tells the client to forget the token would imply a revocation guarantee that
 * does not exist.
 *
 * `rateLimitPresets.auth` (10 attempts per 15 minutes, per hashed IP) already
 * existed for exactly this endpoint and had no caller until now. Login is the
 * brute-force surface, and the generous `publicRead` limiter mounted on the API
 * prefix is not appropriate for it.
 */
export function authRoutes(
  service: AuthService,
  jwtSecret: Uint8Array,
  authLimiter: RequestHandler,
): Router {
  const controller = new AuthController(service);
  const router = Router();

  router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
  router.get('/me', authenticate(jwtSecret), controller.me);

  return router;
}
