import type { AppLogger } from '../../core/logger.js';
import type { FactService } from '../../modules/fact/fact.service.js';
import type { PeriodicTask, TaskOutcome } from '../periodic-task.js';

/**
 * Phase 2A — turn stored snapshots into reviewable semantic changes.
 *
 * A SECOND STAGE ON THE EXISTING RUNNER, not a second worker, queue or
 * scheduler. It reads what `fetch-sources` already stored and writes
 * observations and pending changes; nothing here fetches anything, and nothing
 * here writes canonical data.
 *
 * WHY IT RUNS ON A CLOCK RATHER THAN REACTING TO A FETCH. The fetch task could
 * enqueue an outbox event per changed source, but that couples ingestion to
 * extraction: a slow or failing extractor would then push retries back into the
 * one process that has to stay polite to government servers. Reading the
 * newest stored body on a timer is idempotent by construction and cannot
 * disturb the fetch cadence.
 *
 * It runs a little after the fetch interval so a pass normally sees bodies
 * stored by the previous one, and `runOnStart` is deliberately off — a worker
 * restart loop should not re-scan every source each time it comes up.
 */
export function extractFactsTask(deps: {
  service: FactService;
  logger: AppLogger;
}): PeriodicTask {
  return {
    name: 'extract-facts',
    everyMs: 45 * 60_000,
    async run(): Promise<TaskOutcome> {
      const tally = await deps.service.detect();

      // A critical change is the one thing here worth waking someone for: an
      // exam date or an application deadline moved and a student is looking at
      // the old one until it is reviewed.
      if (tally.critical > 0) {
        deps.logger.warn(
          { critical: tally.critical, changes: tally.changes },
          'CRITICAL official fact changes are waiting for review',
        );
      }

      // `processed` counts SNAPSHOTS READ, not changes found. Zero changes
      // across six sources is the normal, healthy result — reporting it as
      // "processed: 0" would make a working extractor look asleep.
      return {
        processed: tally.snapshots,
        detail: {
          observations: tally.observations,
          changes: tally.changes,
          critical: tally.critical,
          // Kept in the log line because each is a different fixable
          // condition: `invalid` is a parser bug, `truncated` is a storage cap,
          // `silent` is usually a JavaScript-rendered page we cannot read.
          invalid: tally.invalid,
          truncated: tally.truncated,
          silent: tally.silent,
          offCycle: tally.offCycle,
        },
      };
    },
  };
}
