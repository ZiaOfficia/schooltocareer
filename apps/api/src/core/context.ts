import { AsyncLocalStorage } from 'node:async_hooks';

import type { AuthUser } from '@stc/types';

/**
 * Per-request context, propagated with AsyncLocalStorage.
 *
 * This is why the logger can stamp a correlation id on every line without the
 * request object being threaded through six call layers, and why a repository
 * can record `updatedById` without the service passing the actor down as an
 * argument to every method.
 *
 * It is READ-ONLY to consumers. Nothing outside the middleware mutates it.
 */
export type RequestContext = {
  readonly requestId: string;
  /** Client-supplied trace id, echoed back so logs join across services. */
  readonly correlationId: string;
  readonly startedAt: number;
  readonly method: string;
  readonly path: string;
  readonly ip: string;
  user?: AuthUser;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string {
  return storage.getStore()?.requestId ?? 'no-request-context';
}

export function getCorrelationId(): string {
  return storage.getStore()?.correlationId ?? getRequestId();
}

export function getCurrentUser(): AuthUser | undefined {
  return storage.getStore()?.user;
}

/**
 * The actor for audit columns. Returns undefined for anonymous traffic, which
 * is correct — `createdById` should be null for a system import, not a
 * fabricated user id.
 */
export function getActorId(): string | undefined {
  return storage.getStore()?.user?.id;
}

/** Set by the auth middleware once, after the token is verified. */
export function attachUser(user: AuthUser): void {
  const store = storage.getStore();
  if (store) store.user = user;
}
