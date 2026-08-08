import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { runWithContext, type RequestContext } from '../core/context.js';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Must be the FIRST middleware. Everything downstream — logging, error
 * responses, audit rows — reads the request id from AsyncLocalStorage, so
 * anything registered before this loses correlation.
 *
 * A client-supplied correlation id is honoured so a trace can be followed
 * across Next.js → API → worker. The request id is always generated here:
 * accepting a client-supplied one lets a caller collide traces on purpose.
 */
export function requestContext() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = randomUUID();
    const correlationId = headerValue(req, CORRELATION_HEADER) ?? requestId;

    const context: RequestContext = {
      requestId,
      correlationId,
      startedAt: Date.now(),
      method: req.method,
      path: req.originalUrl,
      ip: clientIp(req),
    };

    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.setHeader(CORRELATION_HEADER, correlationId);

    runWithContext(context, () => {
      next();
    });
  };
}

function headerValue(req: Request, name: string): string | undefined {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.length <= 128 ? value : undefined;
}

/**
 * Render sits behind a proxy, so `req.ip` is the proxy without `trust proxy`.
 * We read the leftmost X-Forwarded-For entry, which is the original client.
 */
function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first ?? req.ip ?? 'unknown').trim();
}
