import { z } from 'zod';

/**
 * Environment contract, validated ONCE at boot.
 *
 * Every app calls its loader at startup so a missing variable crashes the
 * process with a readable message instead of surfacing as `undefined` inside a
 * request three hours later. Nothing in the codebase reads `process.env`
 * directly — that is an ESLint error.
 */

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().url(),
  /** The single seeded Site row. See platform.prisma for why siteId exists. */
  SITE_ID: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'Use at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  /** Salt for IP hashing. Rotating it resets rate-limit buckets. */
  IP_HASH_SALT: z.string().min(16),

  /** Shared secret for the API -> Next.js revalidation webhook. */
  REVALIDATE_SECRET: z.string().min(24),
  WEB_BASE_URL: z.string().url(),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(120),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** IndexNow submission key. Absent disables the ping handler cleanly. */
  INDEXNOW_KEY: z.string().min(8).optional(),

  /** Run the outbox worker inside the API process (development convenience). */
  RUN_WORKER_IN_PROCESS: z.coerce.boolean().default(false),

  /** Optional. Absent means the in-memory cache provider is used. */
  REDIS_URL: z.string().url().optional(),
});

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SITE_NAME: z.string().default('SchoolToCareer'),
  API_BASE_URL: z.string().url(),
  REVALIDATE_SECRET: z.string().min(24),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_ADSENSE_CLIENT: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

/** Fails loudly with every missing/invalid key listed, not just the first. */
export function loadEnv<T extends z.ZodTypeAny>(schema: T, source: unknown = process.env): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data as z.infer<T>;
}
