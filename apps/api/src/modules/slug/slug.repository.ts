import { Prisma, type PrismaClient } from '@stc/database';

import type { Locale, OwnerType, SlugChangeReason } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';

/**
 * SlugHistory and Redirect persistence. Shared by every module.
 */
export class SlugRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Resolves a historical slug to the entity's current one.
   *
   * `isActive` is false for tombstoned (soft-deleted) entries, so a deleted
   * exam's old URL does not silently resurrect as a 301 to a 404.
   */
  async resolveHistorical(
    entityType: OwnerType,
    oldSlug: string,
    locale: Locale = 'EN',
  ): Promise<{ entityId: string; newSlug: string; isActive: boolean } | null> {
    const row = await this.run(
      () =>
        this.prisma.slugHistory.findUnique({
          where: { entityType_oldSlug_locale: { entityType, oldSlug, locale } },
          select: { entityId: true, newSlug: true, isActive: true },
        }),
      { resource: 'SlugHistory', identifier: oldSlug },
    );
    return row ?? null;
  }

  /** History row + one Redirect per registered sub-path template. */
  async recordChange(
    params: {
      entityType: OwnerType;
      entityId: string;
      oldSlug: string;
      newSlug: string;
      locale: Locale;
      reason: SlugChangeReason;
      isActive: boolean;
      changedById?: string | undefined;
      siteId: string;
      redirects: Array<{ from: string; to: string }>;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.slugHistory.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        oldSlug: params.oldSlug,
        newSlug: params.newSlug,
        locale: params.locale,
        reason: params.reason,
        isActive: params.isActive,
        changedById: params.changedById ?? null,
      },
    });

    if (params.redirects.length === 0) return;

    // A path may already have a redirect from an earlier rename. Updating it to
    // the new destination is how `a -> b -> c` collapses to `a -> c` instead of
    // becoming a chain Google stops following.
    for (const redirect of params.redirects) {
      await tx.redirect.upsert({
        where: { siteId_fromPath: { siteId: params.siteId, fromPath: redirect.from } },
        create: {
          siteId: params.siteId,
          fromPath: redirect.from,
          toPath: redirect.to,
          statusCode: 301,
          reason: params.reason,
          createdById: params.changedById ?? null,
        },
        update: { toPath: redirect.to, isActive: true, reason: params.reason },
      });
    }

    // Repoint any redirect that used to target the old paths, so an older slug
    // still lands on the current URL in a single hop.
    for (const redirect of params.redirects) {
      await tx.redirect.updateMany({
        where: { siteId: params.siteId, toPath: redirect.from, isActive: true },
        data: { toPath: redirect.to },
      });
    }
  }

  /** Deactivates the history chain for a hard-deleted entity. */
  async deactivateHistory(
    entityType: OwnerType,
    entityId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.slugHistory.updateMany({
      where: { entityType, entityId },
      data: { isActive: false },
    });
  }
}
