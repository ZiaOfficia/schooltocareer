import type { AppLogger } from '../../core/logger.js';
import type { BlogRepository } from '../../modules/blog/blog.repository.js';
import type { BlogService } from '../../modules/blog/blog.service.js';
import type { PeriodicTask, TaskOutcome } from '../periodic-task.js';

const BATCH_SIZE = 50;

/**
 * Publishes posts whose scheduled time has arrived.
 *
 * The scheduled state needs no dedicated column: DRAFT + a future `publishedAt`
 * IS scheduled, and `@@index([status, publishedAt])` turns this into a range
 * scan over a handful of rows rather than a table scan.
 *
 * Runs every minute. Publishing a post 40 seconds late is invisible; scanning
 * every second all year to avoid that is not worth the connection.
 */
export function publishScheduledTask(deps: {
  repository: Pick<BlogRepository, 'listDueForPublication'>;
  service: Pick<BlogService, 'publishScheduled'>;
  logger: AppLogger;
}): PeriodicTask {
  return {
    name: 'publish-scheduled',
    everyMs: 60_000,
    runOnStart: true,
    async run(): Promise<TaskOutcome> {
      const due = await deps.repository.listDueForPublication(new Date(), BATCH_SIZE);
      if (due.length === 0) return { processed: 0 };

      let published = 0;
      for (const post of due) {
        try {
          // Each post publishes in its own transaction, so one bad row does not
          // hold back the rest of the batch.
          await deps.service.publishScheduled(post);
          published += 1;
        } catch (error) {
          deps.logger.error({ err: error, postId: post.id }, 'scheduled publish failed');
        }
      }

      return { processed: published, detail: { due: due.length } };
    },
  };
}
