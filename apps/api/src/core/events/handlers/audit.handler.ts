import type { RevisionRepository } from '../../../modules/revision/revision.repository.js';
import { getContext } from '../../context.js';
import type { AppLogger } from '../../logger.js';
import { ALL_ACTIONS, type DomainAction, type DomainEvent, type IEventHandler } from '../domain-event.js';

/**
 * The audit trail, split across two sinks because they answer different
 * questions:
 *
 *   ContentRevision  — "what did this record look like, and what changed?"
 *                      A real, queryable table. Written in-transaction.
 *   Structured log   — "who did it, from where, in which request?"
 *                      Tagged `audit: true` for filtering and long-term
 *                      shipping.
 *
 * NOTE ON THE FROZEN SCHEMA: the dedicated `AuditLog` table was deliberately
 * cut from the launch model set. Promoting the actor trail to a table later
 * means changing `writeActorTrail` and nothing else — every call site already
 * emits the event.
 *
 * Entity-agnostic: works for every module without modification.
 */
export class AuditHandler implements IEventHandler {
  readonly name = 'audit';
  readonly handles: readonly DomainAction[] = ALL_ACTIONS;

  constructor(
    private readonly revisions: RevisionRepository,
    private readonly logger: AppLogger,
  ) {}

  async handle(event: DomainEvent, tx: unknown): Promise<void> {
    if (event.snapshot) {
      await this.revisions.append(
        {
          ownerType: event.entity.ownerType,
          ownerId: event.entity.ownerId,
          // The event may declare its intent (rollback, import); otherwise the
          // action decides. This handler is the SOLE writer of revisions.
          revisionType:
            event.revisionType ?? (event.action === 'published' ? 'PUBLISHED' : 'MANUAL'),
          rollbackOfVersion: event.rollbackOfVersion,
          status: (event.snapshot['status'] as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') ?? 'DRAFT',
          snapshot: event.snapshot,
          changedFields: [...(event.changedFields ?? [])],
          changeNote: event.changeNote ?? describe(event),
          authorId: event.actorId,
        },
        tx,
      );
    }

    this.writeActorTrail(event);
  }

  private writeActorTrail(event: DomainEvent): void {
    const ctx = getContext();
    this.logger.info(
      {
        audit: true,
        action: event.type,
        ownerType: event.entity.ownerType,
        ownerId: event.entity.ownerId,
        slug: event.entity.slug,
        actorId: event.actorId ?? 'system',
        ip: ctx?.ip,
        changedFields: event.changedFields,
        occurredAt: event.occurredAt.toISOString(),
      },
      describe(event),
    );
  }
}

function describe(event: DomainEvent): string {
  const label = `${event.entity.ownerType.toLowerCase()} '${event.entity.slug}'`;
  switch (event.action) {
    case 'created':
      return `Created ${label}`;
    case 'updated':
      return `Updated ${event.changedFields?.length ?? 0} field(s) on ${label}`;
    case 'published':
      return `Published ${label}`;
    case 'unpublished':
      return `Unpublished ${label}`;
    case 'slug_changed':
      return `Renamed '${event.oldSlug}' to '${event.newSlug}' (${event.reason ?? 'manual'})`;
    case 'deleted':
      return `Deleted ${label}`;
    case 'restored':
      return `Restored ${label}`;
  }
}
