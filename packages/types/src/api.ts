/**
 * The API response envelope. Every endpoint returns exactly one of these
 * shapes — no bare arrays, no bare objects. A consistent envelope is what lets
 * the frontend's fetch client narrow on `ok` and handle every error in one
 * place instead of per call site.
 */

export type ApiSuccess<TData, TMeta = undefined> = {
  ok: true;
  data: TData;
  meta: TMeta;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorBody;
  requestId: string;
};

export type ApiResponse<TData, TMeta = undefined> = ApiSuccess<TData, TMeta> | ApiFailure;

export type ApiErrorBody = {
  /** Stable, machine-readable. Clients switch on this, never on `message`. */
  code: ErrorCode;
  /** Human-readable, safe to show. Never contains stack traces or SQL. */
  message: string;
  /** Field-level validation failures, keyed by dot-path. */
  fields?: Record<string, string[]>;
  /** Present only outside production. */
  details?: unknown;
};

/**
 * Error codes are part of the public contract. Adding one is additive;
 * renaming one is a breaking change.
 */
export const ERROR_CODE = [
  // 400
  'VALIDATION_ERROR',
  'INVALID_QUERY',
  'INVALID_CURSOR',
  'UNSUPPORTED_MEDIA_TYPE',
  // 401 / 403
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'FORBIDDEN',
  'INSUFFICIENT_PERMISSION',
  // 404 / 409 / 410
  'NOT_FOUND',
  'SLUG_TAKEN',
  'DUPLICATE_RESOURCE',
  'CONFLICT',
  'VERSION_CONFLICT',
  'RESOURCE_GONE',
  // 422
  'BUSINESS_RULE_VIOLATION',
  'PUBLISH_BLOCKED',
  // 429
  'RATE_LIMITED',
  // 5xx
  'INTERNAL_ERROR',
  'DEPENDENCY_UNAVAILABLE',
  'STORAGE_ERROR',
  'SEARCH_UNAVAILABLE',
  'DATABASE_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODE)[number];

/** Single source of truth for code → HTTP status. Used by the error handler. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_QUERY: 400,
  INVALID_CURSOR: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSION: 403,
  NOT_FOUND: 404,
  SLUG_TAKEN: 409,
  DUPLICATE_RESOURCE: 409,
  CONFLICT: 409,
  VERSION_CONFLICT: 409,
  RESOURCE_GONE: 410,
  BUSINESS_RULE_VIOLATION: 422,
  PUBLISH_BLOCKED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  DEPENDENCY_UNAVAILABLE: 503,
  STORAGE_ERROR: 502,
  SEARCH_UNAVAILABLE: 503,
  DATABASE_ERROR: 500,
};
