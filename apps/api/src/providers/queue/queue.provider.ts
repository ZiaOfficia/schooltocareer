import type { OutboxEventType, OwnerType } from '@stc/types';

/**
 * Queue abstraction over the transactional outbox.
 *
 * The outbox is the GUARANTEE (the event row commits with the domain write);
 * the queue is the TRANSPORT. BullMQ or SQS later replaces the transport and
 * keeps the guarantee — they are not alternatives to each other.
 *
 * `publish` deliberately takes a transaction handle: publishing outside the
 * writing transaction is the exact bug the outbox pattern exists to prevent.
 */
export interface IQueueProvider {
  /**
   * Enqueue within an existing transaction. `tx` is the Prisma transaction
   * client, typed loosely here so this interface stays ORM-agnostic.
   */
  publish(event: OutboxMessage, tx: unknown): Promise<void>;
  /** Enqueue outside a transaction. Only for genuinely fire-and-forget work. */
  publishDetached(event: OutboxMessage): Promise<void>;
  /** Claims a batch with FOR UPDATE SKIP LOCKED so N workers can run safely. */
  claim(limit: number): Promise<ClaimedMessage[]>;
  ack(id: bigint): Promise<void>;
  fail(id: bigint, error: string, retryInSeconds: number): Promise<void>;
  deadLetter(id: bigint, error: string): Promise<void>;
  pendingCount(): Promise<number>;
}

export type OutboxMessage = {
  eventType: OutboxEventType;
  ownerType: OwnerType;
  ownerId: string;
  payload: Record<string, unknown>;
};

export type ClaimedMessage = OutboxMessage & {
  id: bigint;
  attempts: number;
};

/** Retry schedule in seconds. Caps out rather than growing forever. */
export const RETRY_BACKOFF_SECONDS = [10, 30, 120, 600, 1800] as const;
export const MAX_ATTEMPTS = RETRY_BACKOFF_SECONDS.length;

export function backoffFor(attempts: number): number {
  return RETRY_BACKOFF_SECONDS[Math.min(attempts, MAX_ATTEMPTS - 1)] ?? 1800;
}
