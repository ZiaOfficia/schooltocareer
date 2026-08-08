import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { hashIp } from '@stc/utils';

import { getContext, getCurrentUser } from '../core/context.js';
import { RateLimitError } from '../core/errors/app-error.js';

/**
 * Fixed-window rate limiting, in memory.
 *
 * Honest about its limits: with N Render instances the effective limit is
 * N × max, and a restart resets every counter. That is acceptable for abuse
 * damping and unacceptable as a security control — which is why the write and
 * auth limiters below are tight enough that even N × max stays sane. Redis
 * makes this exact and is the natural upgrade.
 *
 * Buckets are keyed by a SALTED HASH of the IP, never the raw address. A raw
 * IP in process memory (and in any heap dump) is personal data with no upside.
 */
type Bucket = { count: number; resetAt: number };

export function rateLimit(options: {
  windowMs: number;
  max: number;
  ipSalt: string;
  /** Authenticated callers get their own bucket, keyed by user id. */
  keyByUser?: boolean;
  name?: string;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = buildKey(req, options);
    const now = Date.now();

    // Opportunistic sweep instead of a timer — no wakeups on an idle process.
    if (now - lastSweep > options.windowMs) {
      for (const [k, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(k);
      }
      lastSweep = now;
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      setHeaders(res, options.max, options.max - 1, now + options.windowMs);
      next();
      return;
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    setHeaders(res, options.max, remaining, bucket.resetAt);

    if (bucket.count > options.max) {
      next(new RateLimitError(Math.ceil((bucket.resetAt - now) / 1000)));
      return;
    }
    next();
  };
}

function buildKey(req: Request, options: { keyByUser?: boolean; ipSalt: string; name?: string }): string {
  const scope = options.name ?? 'global';
  if (options.keyByUser) {
    const user = getCurrentUser();
    if (user) return `${scope}:u:${user.id}`;
  }
  const ip = getContext()?.ip ?? req.ip ?? 'unknown';
  return `${scope}:i:${hashIp(ip, options.ipSalt)}`;
}

function setHeaders(res: Response, limit: number, remaining: number, resetAt: number): void {
  res.setHeader('RateLimit-Limit', String(limit));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil((resetAt - Date.now()) / 1000)));
}

/**
 * Preset limiters. Public reads are generous because they are cached and
 * crawler traffic is desirable; auth is tight because it is the brute-force
 * surface.
 */
export const rateLimitPresets = (ipSalt: string) => ({
  publicRead: rateLimit({ windowMs: 60_000, max: 300, ipSalt, name: 'read' }),
  write: rateLimit({ windowMs: 60_000, max: 60, ipSalt, keyByUser: true, name: 'write' }),
  auth: rateLimit({ windowMs: 900_000, max: 10, ipSalt, name: 'auth' }),
  upload: rateLimit({ windowMs: 60_000, max: 20, ipSalt, keyByUser: true, name: 'upload' }),
  search: rateLimit({ windowMs: 60_000, max: 120, ipSalt, name: 'search' }),
});
