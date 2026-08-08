import type { OwnerType, RevisionType } from '@stc/types';

import type { DomainEvent, EntityRef } from './domain-event.js';

/**
 * Builds a module's event constructors.
 *
 * Each `<module>.events.ts` is three lines because of this. Without it, every
 * module would hand-roll seven near-identical object literals — about 60 lines
 * of copy-paste per module, which is exactly where drift starts.
 */

export type EventSubject = { id: string; slug: string };

export type ModuleEvents<T extends EventSubject> = {
  readonly ownerType: OwnerType;
  ref(subject: T): EntityRef;

  created(subject: T, snapshot: Record<string, unknown>, actorId?: string): DomainEvent;
  updated(
    subject: T,
    args: {
      before: Record<string, unknown>;
      snapshot: Record<string, unknown>;
      changedFields: readonly string[];
      actorId?: string | undefined;
      cascadeTags?: readonly string[];
      /** Overrides the default MANUAL revision type — see AuditHandler. */
      revisionType?: RevisionType;
      rollbackOfVersion?: number;
      changeNote?: string;
    },
  ): DomainEvent;
  published(
    subject: T,
    snapshot: Record<string, unknown>,
    actorId?: string,
    changeNote?: string,
  ): DomainEvent;
  unpublished(subject: T, actorId?: string): DomainEvent;
  slugChanged(
    subject: T,
    args: {
      oldSlug: string;
      reason: string;
      actorId?: string | undefined;
      /** Descendant tags/paths orphaned by the rename. See the Board module. */
      cascadeTags?: readonly string[];
      cascadePaths?: readonly string[];
    },
  ): DomainEvent;
  deleted(
    subject: T,
    args: { redirectTo: string; actorId?: string | undefined; cascadePaths?: readonly string[] },
  ): DomainEvent;
  restored(subject: T, snapshot: Record<string, unknown>, actorId?: string): DomainEvent;
};

export function defineEvents<T extends EventSubject>(
  /** Lowercase entity name used in `type`, e.g. "board". */
  name: string,
  ownerType: OwnerType,
  pathFor: (subject: T) => string,
): ModuleEvents<T> {
  const ref = (subject: T): EntityRef => ({
    ownerType,
    ownerId: subject.id,
    slug: subject.slug,
    path: pathFor(subject),
  });

  const base = (subject: T, actorId?: string) => ({
    entity: ref(subject),
    actorId,
    occurredAt: new Date(),
  });

  return {
    ownerType,
    ref,

    created: (subject, snapshot, actorId) => ({
      type: `${name}.created`,
      action: 'created',
      snapshot,
      ...base(subject, actorId),
    }),

    updated: (subject, args) => ({
      type: `${name}.updated`,
      action: 'updated',
      before: args.before,
      snapshot: args.snapshot,
      changedFields: args.changedFields,
      cascadeTags: args.cascadeTags,
      revisionType: args.revisionType,
      rollbackOfVersion: args.rollbackOfVersion,
      changeNote: args.changeNote,
      ...base(subject, args.actorId),
    }),

    published: (subject, snapshot, actorId, changeNote) => ({
      type: `${name}.published`,
      action: 'published',
      snapshot,
      changeNote,
      ...base(subject, actorId),
    }),

    unpublished: (subject, actorId) => ({
      type: `${name}.unpublished`,
      action: 'unpublished',
      ...base(subject, actorId),
    }),

    slugChanged: (subject, args) => ({
      type: `${name}.slug_changed`,
      action: 'slug_changed',
      oldSlug: args.oldSlug,
      newSlug: subject.slug,
      reason: args.reason,
      cascadeTags: args.cascadeTags,
      cascadePaths: args.cascadePaths,
      ...base(subject, args.actorId),
    }),

    deleted: (subject, args) => ({
      type: `${name}.deleted`,
      action: 'deleted',
      redirectTo: args.redirectTo,
      cascadePaths: args.cascadePaths,
      ...base(subject, args.actorId),
    }),

    restored: (subject, snapshot, actorId) => ({
      type: `${name}.restored`,
      action: 'restored',
      snapshot,
      ...base(subject, actorId),
    }),
  };
}
