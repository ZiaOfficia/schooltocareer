import { CACHE_TAGS } from '@stc/constants';

import type { ICacheProvider } from '../../../providers/cache/cache.provider.js';
import type { IQueueProvider } from '../../../providers/queue/queue.provider.js';
import { ALL_ACTIONS, type DomainAction, type DomainEvent, type IEventHandler } from '../domain-event.js';

/**
 * Invalidates both cache tiers, for every module.
 *
 * Entity-agnostic: tags are derived from `entity.ownerType`, so adding a module
 * requires no change here. That is the payoff of action-based events.
 *
 * Two tiers, two mechanisms, and the difference matters:
 *
 *   API cache   — cleared IMMEDIATELY and in-process. Safe inline, because a
 *                 false invalidation costs one query.
 *   Next.js ISR — enqueued as CACHE_REVALIDATE and delivered by the worker
 *                 AFTER commit. Purging the CDN inline would rebuild pages from
 *                 a transaction that might still roll back.
 */
export class CacheInvalidationHandler implements IEventHandler {
  readonly name = 'cache-invalidation';
  readonly handles: readonly DomainAction[] = ALL_ACTIONS;

  constructor(
    private readonly cache: ICacheProvider,
    private readonly queue: IQueueProvider,
  ) {}

  async handle(event: DomainEvent, tx: unknown): Promise<void> {
    const tags = this.tagsFor(event);
    const paths = this.pathsFor(event);

    await this.cache.delByTag(tags);

    await this.queue.publish(
      {
        eventType: 'CACHE_REVALIDATE',
        ownerType: event.entity.ownerType,
        ownerId: event.entity.ownerId,
        payload: { tags, paths, reason: event.type },
      },
      tx,
    );
  }

  private tagsFor(event: DomainEvent): string[] {
    const { ownerType, slug } = event.entity;

    const tags = [
      CACHE_TAGS.entity(ownerType, slug),
      CACHE_TAGS.entityList(ownerType),
      CACHE_TAGS.sitemap(),
    ];

    // A rename orphans the old tag; without purging it the previous URL keeps
    // serving from cache until its TTL expires.
    if (event.action === 'slug_changed' && event.oldSlug) {
      tags.push(CACHE_TAGS.entity(ownerType, event.oldSlug));
    }

    // Publish/unpublish changes what the home page and navigation show.
    if (event.action === 'published' || event.action === 'unpublished') {
      tags.push(CACHE_TAGS.homepage(), CACHE_TAGS.navigation());
    }

    // Hierarchical entities: renaming a board changes the URL of every class,
    // subject and chapter under it. Only the emitting service knows what those
    // are, so it supplies them.
    if (event.cascadeTags?.length) tags.push(...event.cascadeTags);

    return [...new Set(tags)];
  }

  private pathsFor(event: DomainEvent): string[] {
    const paths = [event.entity.path];
    if (event.cascadePaths?.length) paths.push(...event.cascadePaths);
    return [...new Set(paths)];
  }
}
