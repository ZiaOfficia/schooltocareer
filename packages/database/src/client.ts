import { PrismaClient } from '@prisma/client';

/**
 * PrismaClient singleton.
 *
 * The globalThis cache is not a style choice: tsx watch mode and Next.js dev
 * re-evaluate modules on every change, and without it each reload opens a new
 * connection pool until Neon starts refusing connections.
 */
const globalForPrisma = globalThis as unknown as { __stcPrisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
    errorFormat: 'minimal',
  });
}

export const prisma: PrismaClient = globalForPrisma.__stcPrisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.__stcPrisma = prisma;
}
