import type { Server } from 'node:http';

import { createApp } from './app.js';
import { createContainer, type AppContainer } from './container.js';

/**
 * Process bootstrap and lifecycle.
 *
 * Graceful shutdown is not ceremony. Render sends SIGTERM and waits ~30s before
 * SIGKILL; without draining, every in-flight request at deploy time returns a
 * connection reset, and Prisma leaves connections held until Neon times them
 * out. Both are visible to users during an otherwise routine deploy.
 */

const SHUTDOWN_TIMEOUT_MS = 20_000;

async function bootstrap(): Promise<void> {
  let container: AppContainer;

  try {
    // Env is validated here, at boot. A missing variable crashes the process
    // with a readable message instead of surfacing as `undefined` inside a
    // request three hours later.
    container = createContainer();
  } catch (error) {
    console.error('Startup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const { env, logger } = container;

  // SITE_ID must name a real Site row.
  //
  // The env schema only checks it is a non-empty string, so a wrong value
  // passes validation and the process starts looking completely healthy — 200s
  // everywhere, /health green — while every siteId-scoped module returns an
  // empty set. That is exactly what happened in production: /api/v1/exams
  // returned all 20 exams because ExamRepository does not scope by site, while
  // /api/v1/posts returned 0 of 300 because BlogRepository does.
  //
  // A wrong id is a deployment mistake, and a deployment mistake should stop
  // the deployment, not quietly serve an empty website.
  try {
    const site = await container.prisma.site.findUnique({
      where: { id: env.SITE_ID },
      select: { id: true },
    });
    if (!site) {
      const available = await container.prisma.site.findMany({ select: { id: true, name: true } });
      console.error(
        `Startup failed: SITE_ID="${env.SITE_ID}" does not match any Site row.\n` +
          '  Every site-scoped query would return nothing while the API looked healthy.\n' +
          `  Sites in this database: ${
            available.length > 0
              ? available.map((s) => `"${s.id}" (${s.name})`).join(', ')
              : 'NONE — the database has not been seeded'
          }`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      'Startup failed: could not verify SITE_ID against the database:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const app = createApp(container);

  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, pid: process.pid },
      'API listening',
    );
  });

  // Neon idle connections drop; keepAlive slightly above the load balancer's
  // idle timeout avoids the 502s that come from reusing a half-closed socket.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    const forceExit = setTimeout(() => {
      logger.error('graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      // 1. Stop accepting new connections, let in-flight requests finish.
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      // 2. Release the database pool and clear caches.
      await container.shutdown();
      logger.info('shutdown complete');
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // An unhandled rejection leaves the process in an unknown state. Logging and
  // continuing is how a service ends up serving corrupted responses for hours;
  // draining and letting the platform restart is the safer default.
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled promise rejection');
    void shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    void shutdown('uncaughtException');
  });
}

void bootstrap();
