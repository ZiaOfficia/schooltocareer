import type { PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';

/**
 * The readiness probe's only database access.
 *
 * Even a health check goes through a repository — the boundary has no
 * exceptions, and this is the smallest possible demonstration of the rule.
 */
export class HealthRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number }> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch {
      return { ok: false, latencyMs: Date.now() - startedAt };
    }
  }
}
