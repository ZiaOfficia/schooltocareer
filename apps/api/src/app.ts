import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { API_PREFIX } from '@stc/constants';

import type { AppContainer } from './container.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { rateLimitPresets } from './middleware/rate-limit.js';
import { requestContext } from './middleware/request-context.js';
import { requestLogger } from './middleware/request-logger.js';
import { boardRoutes } from './modules/board/board.routes.js';
import { categoryRoutes } from './modules/category/category.routes.js';
import { examRoutes } from './modules/exam/exam.routes.js';
import { questionPaperRoutes } from './modules/question-paper/question-paper.routes.js';
import { resultRoutes } from './modules/result/result.routes.js';
import { blogRoutes } from './modules/blog/blog.routes.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';

/**
 * Express assembly. Ordering here is load-bearing — see the comments.
 *
 * `app.ts` builds the application; `server.ts` starts it. Keeping them apart is
 * what lets integration tests import the app and drive it with supertest
 * without binding a port.
 */
export function createApp(container: AppContainer): Express {
  const { env, logger } = container;
  const app = express();
  const limiters = rateLimitPresets(env.IP_HASH_SALT);

  // Render terminates TLS at its proxy. Without this, req.ip is the proxy and
  // every rate-limit bucket collapses into one.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.set('etag', 'strong');

  // 1. Context FIRST. Everything downstream reads the request id from
  //    AsyncLocalStorage; anything registered above this loses correlation.
  app.use(requestContext());

  // 2. Security headers. CSP is off here because this process serves JSON, not
  //    HTML — the CSP that matters is set by Next.js on the pages themselves.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // 3. CORS. An explicit allowlist — `origin: true` reflects any origin and
  //    quietly defeats the point of having CORS at all.
  app.use(
    cors({
      origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : [env.WEB_BASE_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
      exposedHeaders: ['X-Request-Id', 'X-Correlation-Id', 'RateLimit-Remaining'],
      maxAge: 86_400,
    }),
  );

  app.use(compression());

  // 4. Body parsing with a hard cap. File uploads never come through here —
  //    they go direct-to-Cloudinary via a presigned URL, because a 40MB PDF
  //    through a Render dyno is a reliable way to exhaust memory.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(requestLogger(logger));

  // 5. Health BEFORE rate limiting — the platform's probes must never be
  //    throttled, or a traffic spike turns into a false unhealthy signal.
  app.use('/health', healthRoutes(container.services.health));

  app.use(API_PREFIX, limiters.publicRead);

  // 6. Feature modules. Each router owns its own auth and permission gates —
  //    there is no global "everything under /admin is protected" rule, because
  //    one misplaced mount would then silently expose a whole module.
  const jwtSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  app.use(`${API_PREFIX}/exams`, examRoutes(container.services.exam, jwtSecret));
  app.use(`${API_PREFIX}/boards`, boardRoutes(container.services.board, jwtSecret));
  app.use(`${API_PREFIX}/categories`, categoryRoutes(container.services.category, jwtSecret));
  app.use(
    `${API_PREFIX}/question-papers`,
    questionPaperRoutes(container.services.questionPaper, jwtSecret),
  );
  app.use(`${API_PREFIX}/results`, resultRoutes(container.services.result, jwtSecret));
  app.use(`${API_PREFIX}/posts`, blogRoutes(container.services.blog, jwtSecret));
  app.use(
    `${API_PREFIX}/media`,
    mediaRoutes(container.services.media, jwtSecret, env.IP_HASH_SALT),
  );
  app.use(
    `${API_PREFIX}/search`,
    searchRoutes(container.services.search, jwtSecret, env.IP_HASH_SALT),
  );

  // 7. Terminal handlers, always last and in this order.
  app.use(notFoundHandler());
  app.use(errorHandler(logger, env.NODE_ENV === 'production'));

  return app;
}
