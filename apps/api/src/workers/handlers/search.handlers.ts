import type { OutboxEventType } from '@stc/types';

import type { AppLogger } from '../../core/logger.js';
import type { SearchSourceRegistry } from '../../core/search/search-source.js';
import type { ClaimedMessage } from '../../providers/queue/queue.provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';

import type { IOutboxHandler } from './outbox-handler.js';

/**
 * Reindexes one entity.
 *
 * Idempotent by construction: it re-reads the current row and upserts. Running
 * it twice produces the same index state, and the provider's `sourceHash`
 * check turns the second run into a no-op write.
 */
export class SearchUpsertHandler implements IOutboxHandler {
  readonly name = 'search-upsert';
  readonly handles: OutboxEventType = 'SEARCH_UPSERT';

  constructor(
    private readonly registry: SearchSourceRegistry,
    private readonly search: ISearchProvider,
    private readonly logger: AppLogger,
  ) {}

  async handle(message: ClaimedMessage): Promise<void> {
    const source = this.registry.get(message.ownerType);

    if (!source) {
      // Not an error worth retrying — this owner type simply is not indexable
      // yet. Retrying would burn attempts until the row dead-letters and would
      // hide the real signal, which is "someone emitted an event for a module
      // that has no search source".
      this.logger.warn(
        { ownerType: message.ownerType, ownerId: message.ownerId },
        'no search source registered — skipping',
      );
      return;
    }

    const document = await source.build(message.ownerId);

    // The row was unpublished or deleted between the event and now. Removing
    // is the correct response, not failing.
    if (!document) {
      await this.search.remove(message.ownerType, message.ownerId);
      this.logger.debug(
        { ownerType: message.ownerType, ownerId: message.ownerId },
        'source returned null — removed from index',
      );
      return;
    }

    await this.search.index(document);
  }
}

export class SearchDeleteHandler implements IOutboxHandler {
  readonly name = 'search-delete';
  readonly handles: OutboxEventType = 'SEARCH_DELETE';

  constructor(private readonly search: ISearchProvider) {}

  async handle(message: ClaimedMessage): Promise<void> {
    // Deactivating an already-inactive document is a no-op, so this is safely
    // repeatable.
    await this.search.remove(message.ownerType, message.ownerId);
  }
}
