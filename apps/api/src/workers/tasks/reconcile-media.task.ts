import type { MediaService } from '../../modules/media/media.service.js';
import type { PeriodicTask, TaskOutcome } from '../periodic-task.js';

/**
 * Removes soft-deleted assets from the storage provider.
 *
 * The second consumer of PeriodicTaskRunner, and time-driven for the same
 * reason as the first: nothing emits an event when a provider delete that
 * failed yesterday becomes retryable today.
 *
 * The DB row is deleted only AFTER the provider confirms removal, so a failure
 * leaves the row pending and the next sweep retries it - the object is never
 * orphaned silently.
 */
export function reconcileMediaTask(deps: {
  service: Pick<MediaService, 'purgeDeletedFromProvider'>;
}): PeriodicTask {
  return {
    name: 'reconcile-media',
    // Hourly. Storage costs pennies; hammering a provider API does not pay off.
    everyMs: 3_600_000,
    async run(): Promise<TaskOutcome> {
      const purged = await deps.service.purgeDeletedFromProvider(50);
      return { processed: purged };
    },
  };
}