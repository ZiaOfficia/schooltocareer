import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

import { ValidationError } from '../core/errors/app-error.js';

/**
 * Request validation.
 *
 * The parsed, coerced result REPLACES the raw input, so downstream handlers get
 * typed data with defaults applied and unknown keys stripped. Reading
 * `req.body` after a schema has run and finding an unvalidated field is the bug
 * this prevents.
 *
 * Schemas come from @stc/validation — the same objects the admin forms use.
 */

type Segment = 'body' | 'query' | 'params';

declare module 'express-serve-static-core' {
  interface Request {
    valid: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}

export function validate<
  TBody extends ZodTypeAny | undefined = undefined,
  TQuery extends ZodTypeAny | undefined = undefined,
  TParams extends ZodTypeAny | undefined = undefined,
>(schemas: { body?: TBody; query?: TQuery; params?: TParams }): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const fields: Record<string, string[]> = {};
    req.valid ??= {};

    for (const segment of ['params', 'query', 'body'] as const) {
      const schema = schemas[segment];
      if (!schema) continue;

      const result = schema.safeParse(req[segment]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = [segment, ...issue.path].join('.');
          (fields[key] ??= []).push(issue.message);
        }
        continue;
      }
      req.valid[segment] = result.data;
    }

    if (Object.keys(fields).length > 0) {
      next(new ValidationError(fields));
      return;
    }
    next();
  };
}

/** Typed accessors. Casting once here beats casting at every call site. */
export function validBody<T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> {
  return req.valid.body as z.infer<T>;
}

export function validQuery<T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> {
  return req.valid.query as z.infer<T>;
}

export function validParams<T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> {
  return req.valid.params as z.infer<T>;
}

export type { Segment };
