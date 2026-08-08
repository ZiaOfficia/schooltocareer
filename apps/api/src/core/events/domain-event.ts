import type { OwnerType, RevisionType } from '@stc/types';

/**
 * Domain events.
 *
 * Services emit these and nothing else — no cache purge, no search call, no
 * redirect write, no audit line appears in a service method. Handlers own those.
 *
 * DESIGN NOTE: events are keyed by ACTION, not by entity. An earlier version
 * declared a discriminated union of every event in the system, which meant a
 * god-file that all twelve modules had to edit, and handlers that hardcoded
 * `CACHE_TAGS.exam(...)`. Copying a cache handler per module is precisely the
 * duplication the architecture exists to prevent.
 *
 * Now `entity.ownerType` carries the "which entity" information, so ONE cache
 * handler, ONE search handler and ONE audit handler serve every module.
 */

export type EntityRef = {
  ownerType: OwnerType;
  ownerId: string;
  slug: string;
  /** Canonical public path, so handlers never rebuild URLs themselves. */
  path: string;
};

/**
 * The verbs. Adding a module adds no members here — that is the point.
 * All are past tense: an event describes what happened, never what to do.
 */
export const DOMAIN_ACTIONS = [
  'created',
  'updated',
  'published',
  'unpublished',
  'slug_changed',
  'deleted',
  'restored',
] as const;

export type DomainAction = (typeof DOMAIN_ACTIONS)[number];

export type DomainEvent = {
  /** `<entity>.<action>` — "board.published". Used for logs and audit copy. */
  readonly type: string;
  readonly action: DomainAction;
  readonly entity: EntityRef;
  readonly actorId?: string | undefined;
  readonly occurredAt: Date;

  /** Present on created/updated/published/restored. */
  readonly snapshot?: Record<string, unknown> | undefined;
  /** Present on updated. */
  readonly before?: Record<string, unknown> | undefined;
  readonly changedFields?: readonly string[] | undefined;

  /** Present on slug_changed. */
  readonly oldSlug?: string | undefined;
  readonly newSlug?: string | undefined;
  readonly reason?: string | undefined;

  /**
   * Revision intent, honoured by AuditHandler.
   *
   * AuditHandler is the ONLY writer of ContentRevision. A module that needs a
   * non-default revision type (a rollback, an import) says so here rather than
   * appending its own row — two writers means two rows and two consumed
   * version numbers for one save.
   */
  readonly revisionType?: RevisionType | undefined;
  readonly rollbackOfVersion?: number | undefined;
  readonly changeNote?: string | undefined;

  /** Present on deleted — where the orphaned URL should point. */
  readonly redirectTo?: string | undefined;

  /**
   * Extra cache tags and paths this entity's change should invalidate.
   *
   * This is the hierarchy escape hatch: renaming a board changes the URL of
   * every class, subject and chapter beneath it, and only the emitting service
   * knows what those are.
   */
  readonly cascadeTags?: readonly string[] | undefined;
  readonly cascadePaths?: readonly string[] | undefined;
};

/**
 * Handlers subscribe to ACTIONS and receive events from every module.
 *
 * They run inside the emitting transaction. A handler that writes must thread
 * `tx` through — an outbox row committed separately from the domain write
 * defeats the whole pattern, and `pnpm arch:check` fails the build if one
 * forgets.
 */
export interface IEventHandler {
  readonly name: string;
  readonly handles: readonly DomainAction[];
  handle(event: DomainEvent, tx: unknown): Promise<void>;
}

/** Every action, for handlers that genuinely care about all of them. */
export const ALL_ACTIONS: readonly DomainAction[] = DOMAIN_ACTIONS;
