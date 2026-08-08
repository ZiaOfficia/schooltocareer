import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import type { ApiErrorBody } from '@stc/types';

import { getContext } from '../core/context.js';
import { AppError, NotFoundError } from '../core/errors/app-error.js';
import type { AppLogger } from '../core/logger.js';
import { sendFailure } from '../core/http/response.js';

/**
 * The single exit point for every failure.
 *
 * Note what it does NOT know about: Prisma. Driver errors are translated into
 * domain errors by BaseRepository, so the HTTP layer never learns that the ORM
 * exists. That is the repository boundary paying for itself.
 */
export function errorHandler(logger: AppLogger, isProduction: boolean): ErrorRequestHandler {
  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const normalized = normalize(error);
    const ctx = getContext();
    const durationMs = ctx ? Date.now() - ctx.startedAt : undefined;

    const logPayload = {
      err: normalized,
      code: normalized.code,
      status: normalized.status,
      method: req.method,
      path: req.originalUrl,
      durationMs,
    };

    // Operational errors are expected outcomes, not incidents. Logging a 404
    // at error level trains everyone to ignore the error channel.
    if (normalized.isOperational) {
      logger.warn(logPayload, normalized.message);
    } else {
      logger.error(logPayload, normalized.message);
    }

    const body: ApiErrorBody = {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.fields ? { fields: normalized.fields } : {}),
      // Internals never cross the wire in production — stack traces and driver
      // messages are reconnaissance for an attacker.
      ...(!isProduction && normalized.details !== undefined
        ? { details: normalized.details }
        : {}),
    };

    if (normalized.code === 'RATE_LIMITED') {
      const retry = (normalized.details as { retryAfterSeconds?: number } | undefined)
        ?.retryAfterSeconds;
      if (retry) res.setHeader('Retry-After', String(retry));
    }

    sendFailure(res, normalized.status, body);
  };
}

function normalize(error: unknown): AppError {
  if (AppError.isAppError(error)) return error;

  if (error instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_root';
      (fields[path] ??= []).push(issue.message);
    }
    return new AppError('VALIDATION_ERROR', 'Request validation failed', { fields });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return new AppError('VALIDATION_ERROR', 'Request body is not valid JSON');
  }

  // Anything reaching here is a bug. It is deliberately non-operational so it
  // shows up in the error channel and in alerting.
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred', {
    isOperational: false,
    cause: error,
    details: error instanceof Error ? { name: error.name, message: error.message } : { error },
  });
}

/** Terminal 404 for unmatched routes. Registered after every router. */
export function notFoundHandler() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    next(new NotFoundError('Route', `${req.method} ${req.path}`));
  };
}
