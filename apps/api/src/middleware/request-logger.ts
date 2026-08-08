import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { getContext } from '../core/context.js';
import type { AppLogger } from '../core/logger.js';

/**
 * Access logging on response finish.
 *
 * Health checks are skipped: Render polls `/health` every few seconds and those
 * lines bury everything else. Slow requests are promoted to `warn` so the
 * latency tail is visible without opening a dashboard.
 */
export function requestLogger(logger: AppLogger, options: { slowMs?: number } = {}): RequestHandler {
  const slowMs = options.slowMs ?? 1_000;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/health' || req.path === '/health/ready') {
      next();
      return;
    }

    res.on('finish', () => {
      const ctx = getContext();
      const durationMs = ctx ? Date.now() - ctx.startedAt : 0;

      const payload = {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        contentLength: res.getHeader('content-length'),
        userAgent: req.headers['user-agent'],
      };

      // 4xx/5xx are logged by the error handler with full detail; logging them
      // again here would double every failure in the log volume.
      if (res.statusCode >= 400) return;

      if (durationMs >= slowMs) {
        logger.warn(payload, 'slow request');
      } else {
        logger.info(payload, 'request');
      }
    });

    next();
  };
}
