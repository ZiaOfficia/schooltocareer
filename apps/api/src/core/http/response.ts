import type { Response } from 'express';

import type { ApiFailure, ApiSuccess, PageMeta } from '@stc/types';

import { getRequestId } from '../context.js';

/**
 * Envelope helpers. Controllers call these; nothing calls `res.json` directly.
 *
 * The consistency is the point: the frontend's fetch client narrows on `ok`
 * once, and every error is handled in one place instead of per call site.
 */

export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T, undefined> = {
    ok: true,
    data,
    meta: undefined,
    requestId: getRequestId(),
  };
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T, location?: string): void {
  if (location) res.setHeader('Location', location);
  sendOk(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function sendPaginated<T>(res: Response, items: T[], meta: PageMeta, status = 200): void {
  const body: ApiSuccess<T[], PageMeta> = {
    ok: true,
    data: items,
    meta,
    requestId: getRequestId(),
  };
  res.status(status).json(body);
}

export function sendFailure(res: Response, status: number, error: ApiFailure['error']): void {
  const body: ApiFailure = { ok: false, error, requestId: getRequestId() };
  res.status(status).json(body);
}

/**
 * Cache-Control for public GETs. The CDN caches for `sMaxAge` and may serve a
 * stale copy for `staleWhileRevalidate` while it refreshes — which is what
 * keeps p99 flat when a result page goes viral on declaration day.
 */
export function setPublicCache(
  res: Response,
  opts: { sMaxAge: number; staleWhileRevalidate?: number },
): void {
  const swr = opts.staleWhileRevalidate ?? opts.sMaxAge * 10;
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${opts.sMaxAge}, stale-while-revalidate=${swr}`,
  );
}

/** Anything user-scoped or authenticated must never land in a shared cache. */
export function setPrivateNoStore(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
}
