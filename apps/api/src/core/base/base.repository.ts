import { Prisma, type PrismaClient } from '@stc/database';

import {
  DatabaseError,
  DuplicateError,
  NotFoundError,
  SlugTakenError,
} from '../errors/app-error.js';

/**
 * Base class for every repository.
 *
 * THIS FILE AND `*.repository.ts` ARE THE ONLY PLACES PRISMA MAY BE IMPORTED.
 * Enforced by tooling/eslint-config/layers.js — a service importing Prisma is
 * a build failure, not a review comment.
 *
 * The most important thing here is `translateError`: Prisma's error codes are
 * an implementation detail of the ORM. Letting a `P2002` reach the HTTP layer
 * would mean the error handler needs to know about Prisma, which is exactly the
 * coupling the repository layer exists to prevent.
 */
export abstract class BaseRepository {
  protected constructor(protected readonly prisma: PrismaClient) {}

  /**
   * Wraps a Prisma call and converts driver errors into domain errors.
   * Every repository method funnels through this.
   */
  protected async run<T>(
    operation: () => Promise<T>,
    context: { resource: string; identifier?: string },
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.translateError(error, context);
    }
  }

  protected translateError(error: unknown, context: { resource: string; identifier?: string }): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': {
          // Unique constraint. `target` names the failing column(s).
          const target = normaliseTarget(error.meta?.['target']);
          if (target.includes('slug')) {
            return new SlugTakenError(context.identifier ?? 'unknown');
          }
          return new DuplicateError(context.resource, target[0]);
        }
        case 'P2025':
          // "An operation failed because it depends on required records."
          return new NotFoundError(context.resource, context.identifier);
        case 'P2003':
          return new DatabaseError(
            `Cannot complete this operation: a related ${context.resource} record is missing or still referenced`,
            error,
          );
        case 'P2014':
          return new DatabaseError(
            `This change would break a required relation on ${context.resource}`,
            error,
          );
        case 'P2000':
          return new DatabaseError(`A value is too long for ${context.resource}`, error);
        default:
          return new DatabaseError(`Database error (${error.code})`, error);
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      // A malformed query is a programming error, never bad user input —
      // validation middleware runs before anything reaches a repository.
      return new DatabaseError('Malformed database query', error);
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return new DatabaseError('Could not connect to the database', error);
    }

    return error instanceof Error ? error : new DatabaseError('Unknown database error', error);
  }

  /**
   * Runs work inside a transaction.
   *
   * Every write that also enqueues an OutboxEvent MUST use this — the whole
   * point of the outbox is that the event and the domain write commit together.
   */
  protected transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, {
      maxWait: 5_000,
      timeout: 15_000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}

function normaliseTarget(target: unknown): string[] {
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  return [];
}
