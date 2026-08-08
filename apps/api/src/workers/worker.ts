import { createContainer, type AppContainer } from '../container.js';

/**
 * Worker process entry point.
 *
 * Deployed as a SEPARATE Render service from the API, sharing the same image
 * and database. Two reasons that matters:
 *
 *   - The API can scale on request volume while the worker stays at one
 *     instance, which keeps ordering sane and connection use predictable.
 *   - A worker stuck on a slow external call cannot consume the API's event
 *     loop or its Neon connections.
 *
 * For local development, `createContainer().startWorker()` runs it in-process
 * so there is only one thing to start.
 */
async function bootstrap(): Promise<void> {
  let container: AppContainer;

  try {
    container = createContainer();
  } catch (error) {
    console.error('Worker startup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const { logger } = container;
  const worker = container.startWorker();

  logger.info({ pid: process.pid }, 'outbox worker process started');

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal, stats: worker.getStats() }, 'worker shutting down');

    const force = setTimeout(() => {
      logger.error('worker shutdown timed out — forcing exit');
      process.exit(1);
    }, 20_000);
    force.unref();

    try {
      // Lets the in-flight batch finish. Abandoning it mid-batch is survivable
      // (reclaimStale recovers the rows) but replays external effects on
      // restart, so a clean drain is cheaper.
      await worker.stop();
      await container.shutdown();
      clearTimeout(force);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'worker shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled rejection in worker');
    void shutdown('unhandledRejection');
  });
}

void bootstrap();
