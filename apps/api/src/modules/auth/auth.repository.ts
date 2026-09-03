import { type PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';

/**
 * The only file in this module that may import Prisma (arch:check metric 1).
 *
 * `passwordHash` leaves this layer exactly once, into the service that compares
 * it, and never into a DTO. There is deliberately no `findById` that returns it.
 */

export type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'EDITOR' | 'AUTHOR';
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  passwordHash: string;
  deletedAt: Date | null;
};

export class AuthRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Looks a user up for authentication.
   *
   * Soft-deleted rows ARE returned, and the service refuses them. Filtering
   * them out here would make a deleted account and a wrong email
   * indistinguishable to the caller — which is fine for the response, but it
   * also hides the case from the logs, where the difference between "unknown
   * address" and "a former editor is still trying to sign in" matters.
   */
  async findForLogin(email: string): Promise<AuthUserRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            passwordHash: true,
            deletedAt: true,
          },
        }),
      { resource: 'User', identifier: email },
    );
    return record as AuthUserRecord | null;
  }

  async recordLogin(id: string): Promise<void> {
    await this.run(
      () => this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),
      { resource: 'User', identifier: id },
    );
  }

  /**
   * Sets a password hash on an existing user.
   *
   * Used ONLY by the operational `pnpm admin:set-password` script. There is no
   * HTTP route that reaches this: password reset, invitation and self-service
   * change are all deliberately out of scope for the minimal login slice.
   */
  async setPasswordHash(email: string, passwordHash: string): Promise<{ id: string; email: string } | null> {
    const user = await this.run(
      () => this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      { resource: 'User', identifier: email },
    );
    if (!user) return null;

    return this.run(
      () =>
        this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
          select: { id: true, email: true },
        }),
      { resource: 'User', identifier: email },
    );
  }

  /** Reviewer accounts, for the operational script to list. */
  async listStaff(): Promise<
    Array<{ email: string; name: string; role: string; status: string; hasPassword: boolean }>
  > {
    const rows = await this.run(
      () =>
        this.prisma.user.findMany({
          where: { deletedAt: null },
          select: { email: true, name: true, role: true, status: true, passwordHash: true },
          orderBy: { email: 'asc' },
        }),
      { resource: 'User' },
    );
    return rows.map((row) => ({
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      // Never the hash itself — only whether one is usable.
      hasPassword: row.passwordHash.startsWith('scrypt$'),
    }));
  }
}
