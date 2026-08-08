import type { OutboxEventType } from '@stc/types';

import type { ClaimedMessage } from '../../providers/queue/queue.provider.js';

/**
 * Outbox handlers run AFTER commit, in a worker process.
 *
 * Not to be confused with the in-transaction domain-event handlers in
 * core/events/handlers. The division:
 *
 *   Domain event handler  — runs inside the transaction, WRITES the outbox row.
 *   Outbox handler        — runs after commit, PERFORMS the external effect.
 *
 * That split is what makes external calls (search, CDN purge, IndexNow) safe:
 * none of them happens for a transaction that later rolled back.
 *
 * Handlers must be IDEMPOTENT. `FOR UPDATE SKIP LOCKED` plus retries gives
 * at-least-once delivery, so the same event can legitimately be processed
 * twice — after a worker crashes between the effect and the ack, for instance.
 */
export interface IOutboxHandler {
  readonly name: string;
  readonly handles: OutboxEventType;
  handle(message: ClaimedMessage): Promise<void>;
}
