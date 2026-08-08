import type { AppLogger } from '../core/logger.js';

/**
 * Periodic tasks.
 *
 * The outbox worker reacts to events. Some work is not event-driven — it is
 * time-driven, and nothing emits an event when a clock passes a threshold:
 *
 *   publish-scheduled   Blog     flip DRAFT rows whose publishedAt has arrived
 *   flush-view-counts   all      drain batched counters into denormalised columns
 *   refresh-popularity  all      recompute popularityScore from daily stats
 *   prune-stale-drafts  Blog     delete ContentDraft rows older than 30 days
 *   collapse-redirects  Slug     rewrite a→b→c chains to a→c
 *
 * Five consumers, so this is shared infrastructure rather than a Blog utility.
 * It is deliberately the smallest thing that works: no cron expressions, no
 * distributed locking, no persistence. An interval and a function.
 *
 * SINGLE-INSTANCE ASSUMPTION: the worker runs as one Render process, so two
 * runners cannot overlap. If that ever changes, tasks need a database advisory
 * lock — and that is the moment to add one, not before.
 */
export type PeriodicTask = {
  name: string;
  everyMs: number;
  /** Run once at startup rather than waiting a full interval. */
  runOnStart?: boolean;
  run(): Promise<TaskOutcome>;
};

export type TaskOutcome = {
  /** Rows affected. Zero is normal and logged at debug, not info. */
  processed: number;
  detail?: Record<string, unknown>;
};

type TaskState = { lastRunAt: number; runs: number; failures: number };

export class PeriodicTaskRunner {
  private readonly tasks: PeriodicTask[] = [];
  private readonly state = new Map<string, TaskState>();
  private timer: NodeJS.Timeout | undefined;
  private stopping = false;
  private running = false;

  constructor(
    private readonly logger: AppLogger,
    /** How often to check whether anything is due. */
    private readonly tickMs = 15_000,
  ) {}

  register(...tasks: PeriodicTask[]): this {
    for (const task of tasks) {
      this.tasks.push(task);
      this.state.set(task.name, {
        // `runOnStart` tasks are marked as never having run, so the first tick
        // fires them immediately.
        lastRunAt: task.runOnStart ? 0 : Date.now(),
        runs: 0,
        failures: 0,
      });
    }
    return this;
  }

  start(): void {
    if (this.timer) return;
    this.stopping = false;
    this.logger.info(
      { tasks: this.tasks.map((t) => `${t.name}@${t.everyMs}ms`) },
      'periodic task runner started',
    );
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    this.timer.unref();
    void this.tick();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // Let an in-flight task finish rather than abandoning a half-done batch.
    while (this.running) await sleep(50);
  }

  /** Exposed so tests drive the runner without waiting on timers. */
  async tick(now = Date.now()): Promise<void> {
    if (this.running || this.stopping) return;
    this.running = true;

    try {
      for (const task of this.tasks) {
        if (this.stopping) break;
        const state = this.state.get(task.name)!;
        if (now - state.lastRunAt < task.everyMs) continue;

        state.lastRunAt = now;
        state.runs += 1;

        try {
          const outcome = await task.run();
          if (outcome.processed > 0) {
            this.logger.info(
              { task: task.name, processed: outcome.processed, ...outcome.detail },
              'periodic task completed',
            );
          } else {
            this.logger.debug({ task: task.name }, 'periodic task: nothing to do');
          }
        } catch (error) {
          state.failures += 1;
          // A failing task must not kill the runner or stop its siblings —
          // one broken backfill should not stop scheduled posts from going out.
          this.logger.error(
            { err: error, task: task.name, failures: state.failures },
            'periodic task failed',
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  getStats(): Record<string, TaskState> {
    return Object.fromEntries(this.state);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}
