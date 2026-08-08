import { pino, type Logger } from 'pino';

import { getContext } from './context.js';

/**
 * Structured logging with automatic correlation.
 *
 * `mixin` pulls requestId/correlationId/userId out of AsyncLocalStorage on
 * every line, so no call site ever passes them explicitly and no log line is
 * ever missing them.
 *
 * Redaction is not optional: tokens and cookies in logs are a credential leak
 * with a long tail, because log aggregators retain far longer than sessions do.
 */
export type AppLogger = Logger;

export function createLogger(options: {
  level: string;
  pretty: boolean;
  service?: string;
}): AppLogger {
  return pino({
    level: options.level,
    base: { service: options.service ?? 'api' },
    mixin() {
      const ctx = getContext();
      if (!ctx) return {};
      return {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        userId: ctx.user?.id,
      };
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'passwordHash',
        'newPassword',
        'currentPassword',
        'refreshToken',
        'accessToken',
        'token',
        '*.password',
        '*.refreshToken',
        '*.accessToken',
        'CLOUDINARY_API_SECRET',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'DATABASE_URL',
      ],
      censor: '[redacted]',
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(options.pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
          },
        }
      : {}),
  });
}
