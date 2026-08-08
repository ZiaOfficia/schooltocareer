import type { OutboxEventType } from '@stc/types';

import { DependencyError } from '../core/errors/dependency-error.js';
import type { AppLogger } from '../core/logger.js';
import type { ClaimedMessage, IQueueProvider } from '../providers/queue/queue.provider.js';
import { backoffFor, MAX_ATTEMPTS } from '../providers/queue/queue.provider.js';

import type { IOutboxHandler } from './handlers/outbox-handler.js';

export type OutboxWorkerOptions = {
  batchSize: number;
  /** Poll interval when the last batch was empty. */
  idleDelayMs: number;
  /** Poll interval when the last batch was full — drain fast under load. */
  busyDelayMs: number;
  /**
   * Rows stuck in PROCESSING longer than this are reclaimed. Without it, a
   * worker crash mid-batch strands those events forever: they are neither
   * PENDING nor DONE, so nothing ever picks them up again.
   */
  staleAfterMs: number;
  reclaimEveryMs: number;
};

export const DEFAULT_WORKER_OPTIONS: OutboxWorkerOptions = {
  batchSize: 50,
  idleDelayMs: 2_000,
  busyDelayMs: 100,
  staleAfterMs: 5 * 60_000,
  reclaimEveryMs: 60_000,
};

export type WorkerStats = {
  processed: number;
  failed: number;
  deadLettered: number;
  skipped: number;
  reclaimed: number;
  lastRunAt: Date | null;
};

/**
 * Drains the transactional outbox.
 *
 * Delivery is AT LEAST ONCE, not exactly once. A crash between performing an
 * effect and acking replays that effect on restart, which is why every handler
 * is required to be idempotent. Chasing exactly-once here would mean
 * distributed transactions across Postgres, Cloudinary and Vercel — vastly more
 * complexity than making four handlers repeatable.
 */
export class OutboxWorker {
  private readonly handlers = new Map<OutboxEventType, IOutboxHandler>();
  private running = false;
  private stopping = false;
  private timer: NodeJS.Timeout | undefined;
  private lastReclaimAt = 0;

  private readonly stats: WorkerStats = {
    processed: 0,
    failed: 0,
    deadLettered: 0,
    skipped: 0,
    reclaimed: 0,
    lastRunAt: null,
  };

  constructor(
    private readonly deps: {
      queue: IQueueProvider;
      logger: AppLogger;
      /** Optional: only the Postgres queue can reclaim stranded rows. */
      reclaimStale?: (olderThanMs: number) => Promise<number>;
    },
    private readonly options: OutboxWorkerOptions = DEFAULT_WORKER_OPTIONS,
  ) {}

  register(...handlers: IOutboxHandler[]): this {
    for (const handler of handlers) {
      this.handlers.set(handler.handles, handler);
    }
    return this;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    this.deps.logger.info(
      { handlers: [...this.handlers.keys()], batchSize: this.options.batchSize },
      'outbox worker started',
    );
    void this.loop();
  }

  /** Lets the current batch finish rather than abandoning half-processed work. */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    while (this.running) {
      await sleep(50);
    }
    this.deps.logger.info({ stats: this.stats }, 'outbox worker stopped');
  }

  getStats(): Readonly<WorkerStats> {
    return { ...this.stats };
  }

  /** One pass. Exposed so tests can drive the worker without timers. */
  async runOnce(): Promise<number> {
    await this.maybeReclaim();

    const messages = await this.deps.queue.claim(this.options.batchSize);
    if (messages.length === 0) return 0;

    this.stats.lastRunAt = new Date();

    // Sequential on purpose. Firing 50 concurrent handlers would open 50
    // database connections and 50 outbound HTTP requests, which is how a
    // background worker starves the API of Neon connections.
    for (const message of messages) {
      if (this.stopping) break;
      await this.process(message);
    }

    return messages.length;
  }

  private async loop(): Promise<void> {
    while (!this.stopping) {
      let handled = 0;
      try {
        handled = await this.runOnce();
      } catch (error) {
        // A failure to CLAIM (not to handle) means the database is unreachable.
        // Keep the loop alive and back off; the process should not die because
        // Neon blipped.
        this.deps.logger.error({ err: error }, 'outbox claim failed');
        await sleep(this.options.idleDelayMs);
        continue;
      }

      const delay =
        handled >= this.options.batchSize ? this.options.busyDelayMs : this.options.idleDelayMs;
      await sleep(delay);
    }
    this.running = false;
  }

  private async process(message: ClaimedMessage): Promise<void> {
    const handler = this.handlers.get(message.eventType);

    if (!handler) {
      // Unroutable. Acking rather than retrying, because no number of attempts
      // will conjure a handler — and leaving it PENDING makes it a permanent
      // hot row that every claim re-reads.
      this.stats.skipped++;
      this.deps.logger.warn(
        { eventType: message.eventType, id: String(message.id) },
        'no outbox handler registered — acking to avoid a poison row',
      );
      await this.deps.queue.ack(message.id);
      return;
    }

    try {
      await handler.handle(message);
      await this.deps.queue.ack(message.id);
      this.stats.processed++;
    } catch (error) {
      await this.handleFailure(message, handler.name, error);
    }
  }

  private async handleFailure(
    message: ClaimedMessage,
    handlerName: string,
    error: unknown,
  ): Promise<void> {
    const detail = error instanceof Error ? error.message : String(error);

    // A permanent failure (bad secret, rejected key) will never succeed. Dead-
    // letter it immediately so it surfaces now instead of twenty minutes and
    // five identical failures later.
    const permanent = DependencyError.isPermanent(error);
    const exhausted = message.attempts >= MAX_ATTEMPTS;

    if (permanent || exhausted) {
      await this.deps.queue.deadLetter(message.id, detail);
      this.stats.deadLettered++;
      this.deps.logger.error(
        {
          err: error,
          handler: handlerName,
          eventType: message.eventType,
          ownerId: message.ownerId,
          attempts: message.attempts,
          reason: permanent ? 'permanent' : 'attempts-exhausted',
        },
        'outbox event dead-lettered',
      );
      return;
    }

    const retryIn = backoffFor(message.attempts);
    await this.deps.queue.fail(message.id, detail, retryIn);
    this.stats.failed++;
    this.deps.logger.warn(
      { handler: handlerName, eventType: message.eventType, attempts: message.attempts, retryIn },
      'outbox event failed — will retry',
    );
  }

  private async maybeReclaim(): Promise<void> {
    if (!this.deps.reclaimStale) return;
    const now = Date.now();
    if (now - this.lastReclaimAt < this.options.reclaimEveryMs) return;
    this.lastReclaimAt = now;

    const count = await this.deps.reclaimStale(this.options.staleAfterMs);
    if (count > 0) {
      this.stats.reclaimed += count;
      this.deps.logger.warn({ count }, 'reclaimed stranded outbox rows');
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}
