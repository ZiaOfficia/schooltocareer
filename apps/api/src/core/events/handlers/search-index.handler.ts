import type { IQueueProvider } from '../../../providers/queue/queue.provider.js';
import type { DomainAction, DomainEvent, IEventHandler } from '../domain-event.js';

/**
 * Keeps the search index in step with the database, for every module.
 *
 * Everything goes through the outbox — never a direct ISearchProvider call from
 * a service. If indexing ran inline and the transaction rolled back, the index
 * would advertise a row that does not exist, and nothing would correct it.
 *
 * The worker resolves the right ISearchDocumentSource by `ownerType`, so a
 * module becomes searchable by registering a source, not by touching this file.
 */
export class SearchIndexHandler implements IEventHandler {
  readonly name = 'search-index';
  readonly handles: readonly DomainAction[] = [
    'published',
    'updated',
    'unpublished',
    'slug_changed',
    'deleted',
    'restored',
  ];

  constructor(private readonly queue: IQueueProvider) {}

  async handle(event: DomainEvent, tx: unknown): Promise<void> {
    // Only PUBLISHED content is indexed. A draft in search results leaks
    // unreleased information — on this site, exam dates before the conducting
    // body announces them.
    const remove =
      event.action === 'unpublished' ||
      event.action === 'deleted' ||
      (event.action === 'updated' && event.snapshot?.['status'] !== 'PUBLISHED');

    await this.queue.publish(
      {
        eventType: remove ? 'SEARCH_DELETE' : 'SEARCH_UPSERT',
        ownerType: event.entity.ownerType,
        ownerId: event.entity.ownerId,
        payload: { path: event.entity.path, slug: event.entity.slug, reason: event.type },
      },
      tx,
    );
  }
}

/**
 * Notifies search engines when a URL becomes newly available.
 * Publish and rename only — an ordinary edit does not warrant a submission.
 */
export class SitemapPingHandler implements IEventHandler {
  readonly name = 'sitemap-ping';
  readonly handles: readonly DomainAction[] = ['published', 'slug_changed'];

  constructor(private readonly queue: IQueueProvider) {}

  async handle(event: DomainEvent, tx: unknown): Promise<void> {
    await this.queue.publish(
      {
        eventType: 'SITEMAP_PING',
        ownerType: event.entity.ownerType,
        ownerId: event.entity.ownerId,
        payload: { path: event.entity.path },
      },
      tx,
    );
  }
}
