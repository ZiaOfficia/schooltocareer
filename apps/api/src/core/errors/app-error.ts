import { ERROR_STATUS, type ErrorCode } from '@stc/types';

/**
 * The error hierarchy.
 *
 * Two properties matter:
 *   `code`           — stable, machine-readable, part of the public contract.
 *   `isOperational`  — an expected failure (404, validation) versus a bug.
 *                      Only non-operational errors page anyone at 3am.
 *
 * HTTP status is DERIVED from `code` via ERROR_STATUS, never passed in. That
 * single mapping is why a code can never disagree with its status.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly isOperational: boolean;
  readonly fields?: Record<string, string[]>;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      isOperational?: boolean;
      fields?: Record<string, string[]>;
      details?: unknown;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.isOperational = options.isOperational ?? true;
    if (options.fields) this.fields = options.fields;
    if (options.details !== undefined) this.details = options.details;
    Error.captureStackTrace?.(this, new.target);
  }

  static isAppError(value: unknown): value is AppError {
    return value instanceof AppError;
  }
}

// ── Client errors ──────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(fields: Record<string, string[]>, message = 'Request validation failed') {
    super('VALIDATION_ERROR', message, { fields });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      'NOT_FOUND',
      identifier ? `${resource} '${identifier}' was not found` : `${resource} was not found`,
    );
  }
}

/**
 * 410, not 404. A soft-deleted or unpublished page that Google has indexed
 * should tell the crawler it is permanently gone, so it drops out of the index
 * instead of being re-crawled for months.
 */
export class GoneError extends AppError {
  constructor(resource: string, redirectTo?: string) {
    super('RESOURCE_GONE', `${resource} is no longer available`, {
      details: redirectTo ? { redirectTo } : undefined,
    });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('TOKEN_EXPIRED', 'Access token has expired');
  }
}

export class ForbiddenError extends AppError {
  constructor(permission?: string) {
    super(
      permission ? 'INSUFFICIENT_PERMISSION' : 'FORBIDDEN',
      permission
        ? `This action requires the '${permission}' permission`
        : 'You do not have access to this resource',
    );
  }
}

export class SlugTakenError extends AppError {
  constructor(slug: string) {
    super('SLUG_TAKEN', `The slug '${slug}' is already in use`, { fields: { slug: ['Already in use'] } });
  }
}

export class DuplicateError extends AppError {
  constructor(resource: string, field?: string) {
    super('DUPLICATE_RESOURCE', `This ${resource} already exists`, {
      ...(field ? { fields: { [field]: ['Already exists'] } } : {}),
    });
  }
}

/**
 * Optimistic concurrency. Two editors opened the same record; the second save
 * must fail loudly rather than silently overwrite the first.
 */
export class VersionConflictError extends AppError {
  constructor(expected: number, actual: number) {
    super('VERSION_CONFLICT', 'This record was modified by someone else', {
      details: { expectedVersion: expected, currentVersion: actual },
    });
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super('BUSINESS_RULE_VIOLATION', message, { details });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many requests', { details: { retryAfterSeconds } });
  }
}

export class InvalidCursorError extends AppError {
  constructor() {
    super('INVALID_CURSOR', 'The pagination cursor is invalid or no longer applies');
  }
}

// ── Server / dependency errors ─────────────────────────────────────────────

/** Not operational: these mean something is broken, not that input was bad. */
export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred', cause?: unknown) {
    super('INTERNAL_ERROR', message, { isOperational: false, cause });
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'A database error occurred', cause?: unknown) {
    super('DATABASE_ERROR', message, { isOperational: false, cause });
  }
}

export class StorageError extends AppError {
  constructor(message = 'File storage is unavailable', cause?: unknown) {
    super('STORAGE_ERROR', message, { isOperational: false, cause });
  }
}

export class SearchUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super('SEARCH_UNAVAILABLE', 'Search is temporarily unavailable', {
      isOperational: false,
      cause,
    });
  }
}
