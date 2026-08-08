import type { AppLogger } from '../logger.js';

import type { DomainEvent, IEventHandler } from './domain-event.js';

/**
 * Synchronous, in-transaction dispatcher.
 *
 * Deliberately NOT an async pub/sub bus. Handlers run inside the emitting
 * transaction so that outbox rows, revisions and the domain write commit or
 * roll back together. An async bus would reintroduce exactly the partial-write
 * problem the outbox exists to prevent.
 *
 * The real asynchrony happens one layer down: handlers write OutboxEvent rows,
 * and a worker drains them after commit.
 */
export class EventDispatcher {
  private readonly handlers: IEventHandler[] = [];

  constructor(private readonly logger: AppLogger) {}

  register(...handlers: IEventHandler[]): this {
    this.handlers.push(...handlers);
    return this;
  }

  /**
   * Dispatches to every handler that subscribes to this event type.
   *
   * A handler throwing rolls back the whole transaction. That is intentional:
   * if the search-index outbox row cannot be written, publishing the exam must
   * not appear to have succeeded — silent divergence between the database and
   * the index is far worse than a failed request the editor can retry.
   */
  async dispatch(event: DomainEvent, tx: unknown): Promise<void> {
    // Subscription is by ACTION, so one handler serves every module.
    const subscribed = this.handlers.filter((h) => h.handles.includes(event.action));

    this.logger.debug(
      {
        event: event.type,
        ownerType: event.entity.ownerType,
        entity: event.entity.ownerId,
        handlers: subscribed.length,
      },
      'dispatching domain event',
    );

    for (const handler of subscribed) {
      try {
        await handler.handle(event, tx);
      } catch (error) {
        this.logger.error(
          { err: error, handler: handler.name, event: event.type },
          'event handler failed — rolling back',
        );
        throw error;
      }
    }
  }

  async dispatchAll(events: readonly DomainEvent[], tx: unknown): Promise<void> {
    for (const event of events) {
      await this.dispatch(event, tx);
    }
  }
}
