import { Prisma, type PrismaClient } from '@stc/database';

import type { OwnerType } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';

/**
 * ContentDraft persistence - autosave, shared by every editorial module.
 *
 * ONE ROW per (content, editor). Autosave overwrites in place, so the table
 * never grows unboundedly and two editors on the same post each keep their own
 * work rather than silently overwriting each other.
 *
 * Drafts are NOT revisions. Autosaving into ContentRevision produces 200 junk
 * rows per article and makes real history unreadable.
 */
export type DraftRecord = {
  id: string;
  authorId: string;
  payload: Record<string, unknown>;
  baseVersion: number;
  savedAt: Date;
};

export class DraftRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async save(params: {
    ownerType: OwnerType;
    ownerId: string;
    authorId: string;
    payload: Record<string, unknown>;
    baseVersion: number;
  }): Promise<DraftRecord> {
    const row = await this.run(
      () =>
        this.prisma.contentDraft.upsert({
          where: {
            ownerType_ownerId_authorId: {
              ownerType: params.ownerType,
              ownerId: params.ownerId,
              authorId: params.authorId,
            },
          },
          create: {
            ownerType: params.ownerType,
            ownerId: params.ownerId,
            authorId: params.authorId,
            payload: params.payload as Prisma.InputJsonValue,
            baseVersion: params.baseVersion,
          },
          update: {
            payload: params.payload as Prisma.InputJsonValue,
            baseVersion: params.baseVersion,
          },
          select: { id: true, authorId: true, payload: true, baseVersion: true, savedAt: true },
        }),
      { resource: 'ContentDraft', identifier: params.ownerId },
    );
    return row as unknown as DraftRecord;
  }

  async findFor(ownerType: OwnerType, ownerId: string, authorId: string): Promise<DraftRecord | null> {
    const row = await this.run(
      () =>
        this.prisma.contentDraft.findUnique({
          where: { ownerType_ownerId_authorId: { ownerType, ownerId, authorId } },
          select: { id: true, authorId: true, payload: true, baseVersion: true, savedAt: true },
        }),
      { resource: 'ContentDraft', identifier: ownerId },
    );
    return row as unknown as DraftRecord | null;
  }

  /** Every editor with unsaved work on this post - drives the "also editing" hint. */
  async listFor(ownerType: OwnerType, ownerId: string): Promise<DraftRecord[]> {
    const rows = await this.run(
      () =>
        this.prisma.contentDraft.findMany({
          where: { ownerType, ownerId },
          orderBy: { savedAt: 'desc' },
          select: { id: true, authorId: true, payload: true, baseVersion: true, savedAt: true },
        }),
      { resource: 'ContentDraft', identifier: ownerId },
    );
    return rows as unknown as DraftRecord[];
  }

  /** Called on publish: the draft has been folded into the live record. */
  async discard(ownerType: OwnerType, ownerId: string, authorId: string, tx?: unknown): Promise<void> {
    const client = (tx ? (tx as Prisma.TransactionClient) : this.prisma);
    await client.contentDraft.deleteMany({ where: { ownerType, ownerId, authorId } });
  }

  /** Periodic cleanup. Abandoned drafts are not history, just clutter. */
  async pruneOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const result = await this.run(
      () => this.prisma.contentDraft.deleteMany({ where: { savedAt: { lt: cutoff } } }),
      { resource: 'ContentDraft' },
    );
    return result.count;
  }
}