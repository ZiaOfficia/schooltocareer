import { Prisma, type PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';

import type { ClaimedMessage, OutboxMessage } from './queue.provider.js';

/**
 * Outbox persistence. Prisma lives here and nowhere else in the queue provider
 * — the provider itself stays ORM-agnostic so a BullMQ transport can reuse it.
 */
export class OutboxRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /** Inside the caller's transaction — this is the whole point of the pattern. */
  async insertInTransaction(message: OutboxMessage, tx: unknown): Promise<void> {
    await (tx as Prisma.TransactionClient).outboxEvent.create({
      data: {
        eventType: message.eventType,
        ownerType: message.ownerType,
        ownerId: message.ownerId,
        payload: message.payload as Prisma.InputJsonValue,
      },
    });
  }

  async insert(message: OutboxMessage): Promise<void> {
    await this.run(
      () =>
        this.prisma.outboxEvent.create({
          data: {
            eventType: message.eventType,
            ownerType: message.ownerType,
            ownerId: message.ownerId,
            payload: message.payload as Prisma.InputJsonValue,
          },
        }),
      { resource: 'OutboxEvent' },
    );
  }

  /**
   * Atomically claims a batch.
   *
   * `FOR UPDATE SKIP LOCKED` is what makes horizontal worker scaling safe: two
   * workers running this concurrently take disjoint batches instead of both
   * processing the same rows. Expressed as raw SQL because Prisma has no API
   * for row-level lock hints.
   */
  async claim(limit: number): Promise<ClaimedMessage[]> {
    return this.run(
      () => this.prisma.$queryRaw<ClaimedMessage[]>`
        UPDATE "OutboxEvent"
           SET status = 'PROCESSING',
               attempts = attempts + 1
         WHERE id IN (
           SELECT id
             FROM "OutboxEvent"
            WHERE status IN ('PENDING', 'FAILED')
              AND "availableAt" <= NOW()
            ORDER BY id ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
         )
        RETURNING id,
                  "eventType",
                  "ownerType",
                  "ownerId",
                  payload,
                  attempts
      `,
      { resource: 'OutboxEvent' },
    );
  }

  async markDone(id: bigint): Promise<void> {
    await this.run(
      () =>
        this.prisma.outboxEvent.update({
          where: { id },
          data: { status: 'DONE', processedAt: new Date(), lastError: null },
        }),
      { resource: 'OutboxEvent', identifier: String(id) },
    );
  }

  async markFailed(id: bigint, error: string, retryInSeconds: number): Promise<void> {
    await this.run(
      () =>
        this.prisma.outboxEvent.update({
          where: { id },
          data: {
            status: 'FAILED',
            lastError: error.slice(0, 1000),
            availableAt: new Date(Date.now() + retryInSeconds * 1000),
          },
        }),
      { resource: 'OutboxEvent', identifier: String(id) },
    );
  }

  async markDead(id: bigint, error: string): Promise<void> {
    await this.run(
      () =>
        this.prisma.outboxEvent.update({
          where: { id },
          data: { status: 'DEAD', lastError: error.slice(0, 1000), processedAt: new Date() },
        }),
      { resource: 'OutboxEvent', identifier: String(id) },
    );
  }

  /**
   * Returns rows stranded in PROCESSING to the queue.
   *
   * A worker that dies mid-batch leaves its claimed rows marked PROCESSING
   * forever — neither PENDING nor DONE, so no future claim ever sees them and
   * the search index silently stops updating. This is the only mechanism that
   * recovers from that, and it is why `claim` sets PROCESSING rather than
   * deleting.
   *
   * `attempts` is NOT incremented here: the row never got a real attempt.
   */
  async reclaimStale(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await this.run(
      () =>
        this.prisma.outboxEvent.updateMany({
          where: { status: 'PROCESSING', createdAt: { lt: cutoff } },
          data: { status: 'PENDING', availableAt: new Date() },
        }),
      { resource: 'OutboxEvent' },
    );
    return result.count;
  }

  async countPending(): Promise<number> {
    return this.run(
      () => this.prisma.outboxEvent.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }),
      { resource: 'OutboxEvent' },
    );
  }
}
