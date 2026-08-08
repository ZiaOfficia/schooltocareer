import { Prisma, type PrismaClient } from '@stc/database';

import type { OwnerType, PublishStatus, RevisionType } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';

/**
 * ContentRevision writes for any owner type.
 *
 * Shared by every module — an exam edit and a blog edit produce structurally
 * identical history rows, so there is one implementation rather than twelve.
 */
export type RevisionInput = {
  ownerType: OwnerType;
  ownerId: string;
  revisionType: RevisionType;
  status: PublishStatus;
  snapshot: Record<string, unknown>;
  changedFields: string[];
  changeNote?: string | undefined;
  authorId?: string | undefined;
  rollbackOfVersion?: number | undefined;
};

export class RevisionRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Appends the next version inside the caller's transaction.
   *
   * The version is computed from MAX(version) in the same transaction; the
   * @@unique([ownerType, ownerId, version]) constraint is the real guard, so
   * two concurrent saves fail loudly instead of silently interleaving.
   */
  async append(input: RevisionInput, tx: unknown): Promise<number> {
    const client = asTx(tx);
    const latest = await client.contentRevision.aggregate({
      where: { ownerType: input.ownerType, ownerId: input.ownerId },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;

    await client.contentRevision.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        version,
        revisionType: input.revisionType,
        status: input.status,
        snapshot: input.snapshot as Prisma.InputJsonValue,
        changedFields: input.changedFields,
        changeNote: input.changeNote ?? null,
        authorId: input.authorId ?? null,
        rollbackOfVersion: input.rollbackOfVersion ?? null,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    return version;
  }

  async listFor(
    ownerType: OwnerType,
    ownerId: string,
    limit = 30,
  ): Promise<
    Array<{
      version: number;
      revisionType: RevisionType;
      status: PublishStatus;
      changedFields: string[];
      changeNote: string | null;
      authorId: string | null;
      createdAt: Date;
    }>
  > {
    return this.run(
      () =>
        this.prisma.contentRevision.findMany({
          where: { ownerType, ownerId },
          orderBy: { version: 'desc' },
          take: limit,
          select: {
            version: true,
            revisionType: true,
            status: true,
            changedFields: true,
            changeNote: true,
            authorId: true,
            createdAt: true,
          },
        }),
      { resource: 'ContentRevision', identifier: ownerId },
    );
  }

  async getSnapshot(
    ownerType: OwnerType,
    ownerId: string,
    version: number,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.run(
      () =>
        this.prisma.contentRevision.findUnique({
          where: { ownerType_ownerId_version: { ownerType, ownerId, version } },
          select: { snapshot: true },
        }),
      { resource: 'ContentRevision', identifier: ownerId },
    );
    return (row?.snapshot as Record<string, unknown> | undefined) ?? null;
  }
}

/** One cast, here, is the entire cost of keeping Prisma out of the handlers. */
function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}