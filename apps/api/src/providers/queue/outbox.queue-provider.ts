import type { OutboxRepository } from './outbox.repository.js';
import {
  backoffFor,
  MAX_ATTEMPTS,
  type ClaimedMessage,
  type IQueueProvider,
  type OutboxMessage,
} from './queue.provider.js';

/**
 * PostgreSQL-backed queue. The default transport.
 *
 * No extra infrastructure, exactly-once-ish semantics via SKIP LOCKED, and the
 * enqueue participates in the caller's transaction. That last property is the
 * one a Redis-backed queue cannot give you, which is why the outbox stays even
 * after BullMQ arrives.
 */
export class OutboxQueueProvider implements IQueueProvider {
  constructor(private readonly repository: OutboxRepository) {}

  async publish(event: OutboxMessage, tx: unknown): Promise<void> {
    await this.repository.insertInTransaction(event, tx);
  }

  async publishDetached(event: OutboxMessage): Promise<void> {
    await this.repository.insert(event);
  }

  claim(limit: number): Promise<ClaimedMessage[]> {
    return this.repository.claim(limit);
  }

  async ack(id: bigint): Promise<void> {
    await this.repository.markDone(id);
  }

  async fail(id: bigint, error: string, retryInSeconds: number): Promise<void> {
    await this.repository.markFailed(id, error, retryInSeconds);
  }

  async deadLetter(id: bigint, error: string): Promise<void> {
    await this.repository.markDead(id, error);
  }

  pendingCount(): Promise<number> {
    return this.repository.countPending();
  }

  /**
   * Decides retry versus dead-letter. Kept here rather than in the worker so
   * every future transport inherits the same policy.
   */
  async handleFailure(message: ClaimedMessage, error: unknown): Promise<void> {
    const detail = error instanceof Error ? error.message : String(error);
    if (message.attempts >= MAX_ATTEMPTS) {
      await this.deadLetter(message.id, detail);
      return;
    }
    await this.fail(message.id, detail, backoffFor(message.attempts));
  }
}
