import { Router, type Request, type Response } from 'express';

import { sendOk, setPrivateNoStore } from '../../core/http/response.js';

import type { HealthService } from './health.service.js';

/**
 * Health endpoints. Deliberately unauthenticated and un-rate-limited so the
 * platform can always reach them, and always `no-store` so a CDN never serves
 * a cached "ready" for an instance that has since fallen over.
 */
export function healthRoutes(service: HealthService): Router {
  const router = Router();

  // Liveness — no external calls. Failure here means "restart me".
  router.get('/', (_req: Request, res: Response) => {
    setPrivateNoStore(res);
    sendOk(res, service.liveness());
  });

  // Readiness — checks dependencies. Failure means "stop routing to me".
  router.get('/ready', async (_req: Request, res: Response) => {
    const report = await service.readiness();
    setPrivateNoStore(res);
    // 503 so Render's load balancer actually drains this instance rather than
    // reading a 200 body that says "degraded".
    res.status(report.status === 'ready' ? 200 : 503);
    sendOk(res, report, res.statusCode);
  });

  return router;
}
