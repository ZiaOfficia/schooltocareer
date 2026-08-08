import { PAGINATION, REVALIDATE } from '@stc/constants';
import type { FacetGroup, Locale } from '@stc/types';
import { normalizeQuery } from '@stc/utils';

import { getActorId } from '../../core/context.js';
import { BusinessRuleError } from '../../core/errors/app-error.js';
import type { AppLogger } from '../../core/logger.js';
import { buildFacetGroup } from '../../core/query/facet-builder.js';
import type { SearchSourceRegistry } from '../../core/search/search-source.js';
import { cacheKey, type ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { IQueueProvider } from '../../providers/queue/queue.provider.js';
import type { ISearchProvider } from '../../providers/search/search.provider.js';
import type { SearchRepository } from '../../providers/search/search.repository.js';

import { toSearchResultDto, type SearchResultDto, type SearchSuggestionDto } from './search.dto.js';
import type { SearchQuery, SuggestQuery } from './search.types.js';

/**
 * Site search.
 *
 * PURE ORCHESTRATION — and that was the design target, not an accident.
 *
 * There is NO `switch (entityType)` anywhere in this file. Every entity-specific
 * fact it needs comes from the registry:
 *
 *   which kinds are searchable   -> registry.searchableLabels()
 *   how to label a kind          -> source.entityLabel
 *   how to enumerate for reindex -> source.listIndexableIds()
 *   how to build a document      -> source.build()   (called by the worker)
 *
 * Getting there required two additions to `ISearchDocumentSource` — see the
 * comment on that interface. The alternative was branching here, which would
 * have coupled search to every module and inverted the dependency the registry
 * exists to protect.
 */

export type SearchServiceDeps = {
  provider: ISearchProvider;
  registry: SearchSourceRegistry;
  repository: Pick<SearchRepository, 'logQuery' | 'topQueries' | 'zeroResultQueries'>;
  queue: IQueueProvider;
  cache: ICacheProvider;
  logger: AppLogger;
  siteId: string;
};

/** Batch size for a full reindex. Bounded so one request cannot enqueue 100k rows. */
const REINDEX_PAGE = 500;
const REINDEX_MAX_PAGES = 200;

export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  /**
   * The search box.
   *
   * The `type` filter is validated against the REGISTRY rather than a hardcoded
   * list, so a module that registers a source becomes filterable with no change
   * here.
   */
  async search(query: SearchQuery): Promise<SearchResultDto> {
    const cleaned = normalizeQuery(query.q);
    if (cleaned.length < 2) {
      return { query: query.q, hits: [], total: 0, tookMs: 0, facets: [], suggestions: [] };
    }

    const allowedLabels = this.deps.registry.searchableLabels();
    const requested = query.type?.filter((label) => allowedLabels.includes(label)) ?? [];

    if (query.type?.length && requested.length === 0) {
      throw new BusinessRuleError('No searchable content of that kind', { allowed: allowedLabels });
    }

    const limit = Math.min(query.perPage, PAGINATION.SEARCH_PER_PAGE);
    const offset = Math.min((query.page - 1) * limit, PAGINATION.SEARCH_MAX_RESULTS);

    const page = await this.deps.provider.query({
      siteId: this.deps.siteId,
      query: cleaned,
      ...(query.locale ? { locale: query.locale } : {}),
      ...(requested.length > 0 ? { entityLabels: requested } : {}),
      limit,
      offset,
    });

    // Fire-and-forget. A logging failure must never fail a search, and the
    // caller should not wait on it.
    void this.recordQuery(cleaned, query.q, page.total);

    return {
      query: query.q,
      hits: page.hits.map(toSearchResultDto),
      total: page.total,
      tookMs: page.tookMs,
      facets: this.buildTypeFacet(page.hits, requested),
      // A zero-result search is the moment to help, not to shrug.
      suggestions: page.total === 0 ? await this.suggestAlternatives(cleaned) : [],
    };
  }

  /**
   * Search-as-you-type.
   *
   * Cached briefly and aggressively: the same prefixes are typed thousands of
   * times a day, and every keystroke is a request.
   */
  async suggest(query: SuggestQuery): Promise<SearchSuggestionDto[]> {
    const cleaned = normalizeQuery(query.q);
    if (cleaned.length < 2) return [];

    return this.deps.cache.wrap(
      cacheKey('search:suggest', query.locale ?? 'EN', cleaned),
      async () => {
        const results = await this.deps.provider.suggest({
          siteId: this.deps.siteId,
          prefix: cleaned,
          ...(query.locale ? { locale: query.locale } : {}),
          limit: Math.min(query.limit, 15),
        });
        return results.map((hit) => ({
          title: hit.title,
          path: hit.path,
          entityLabel: hit.entityLabel,
        }));
      },
      { ttl: REVALIDATE.VOLATILE },
    );
  }

  /** What people search for. Feeds the admin's content-gap report. */
  async analytics(days: number): Promise<{
    topQueries: Array<{ query: string; searches: number }>;
    contentGaps: Array<{ query: string; searches: number }>;
  }> {
    const [topQueries, contentGaps] = await Promise.all([
      this.deps.repository.topQueries(days, 50),
      this.deps.repository.zeroResultQueries(days, 50),
    ]);
    return { topQueries, contentGaps };
  }

  /**
   * Full reindex.
   *
   * Enqueues a SEARCH_UPSERT per row and lets the existing outbox worker do the
   * work — no bespoke reindex pipeline, no second code path that can disagree
   * with the incremental one. That is the property that matters: the reindex
   * produces exactly what an edit would.
   *
   * Bounded by REINDEX_MAX_PAGES so a mistaken call cannot enqueue a million
   * rows and starve every other event behind them.
   */
  async reindex(options: { ownerType?: string } = {}): Promise<{ enqueued: number; sources: string[] }> {
    const actorId = getActorId();
    const sources = this.deps.registry
      .reindexable()
      .filter((source) => !options.ownerType || source.ownerType === options.ownerType);

    if (sources.length === 0) {
      throw new BusinessRuleError('No reindexable sources matched', {
        available: this.deps.registry.reindexable().map((s) => s.ownerType),
      });
    }

    let enqueued = 0;

    for (const source of sources) {
      let cursor: string | undefined;
      let pages = 0;

      do {
        const batch = await source.listIndexableIds!(cursor, REINDEX_PAGE);

        for (const id of batch.ids) {
          // publishDetached, not publish: a reindex is not part of any domain
          // transaction, and wrapping 100k inserts in one would hold a
          // transaction open for minutes.
          await this.deps.queue.publishDetached({
            eventType: 'SEARCH_UPSERT',
            ownerType: source.ownerType,
            ownerId: id,
            payload: { reason: 'reindex' },
          });
          enqueued += 1;
        }

        cursor = batch.nextCursor ?? undefined;
        pages += 1;
      } while (cursor && pages < REINDEX_MAX_PAGES);

      if (cursor) {
        this.deps.logger.warn(
          { ownerType: source.ownerType, pages },
          'reindex hit the page cap — run again to continue',
        );
      }
    }

    this.deps.logger.info(
      { enqueued, sources: sources.map((s) => s.ownerType), actorId },
      'reindex enqueued',
    );

    return { enqueued, sources: sources.map((s) => s.ownerType) };
  }

  async health(): Promise<{ provider: string; healthy: boolean; sources: string[] }> {
    return {
      provider: this.deps.provider.name,
      healthy: await this.deps.provider.healthy().catch(() => false),
      sources: this.deps.registry.searchableLabels(),
    };
  }

  // Internals

  /**
   * The entity-kind facet, built from the CURRENT page of hits.
   *
   * Deliberately not a separate aggregation: an accurate per-kind count means a
   * second full-text scan per kind, and on a search box the counts are a
   * navigation hint rather than a report. The shared facet builder still
   * supplies zero-count retention and selection pinning — this is its fourth
   * consumer.
   */
  private buildTypeFacet(
    hits: Array<{ entityLabel: string }>,
    selected: readonly string[],
  ): FacetGroup[] {
    const counts = new Map<string, number>();
    for (const label of this.deps.registry.searchableLabels()) counts.set(label, 0);
    for (const hit of hits) counts.set(hit.entityLabel, (counts.get(hit.entityLabel) ?? 0) + 1);

    return [
      buildFacetGroup({
        spec: { field: 'type', label: 'Show', kind: 'multi', sort: 'count' },
        counts: [...counts].map(([value, count]) => ({ value, count })),
        selected,
      }),
    ];
  }

  /** Trigram suggestions for a query that found nothing — usually a typo. */
  private async suggestAlternatives(cleaned: string): Promise<SearchSuggestionDto[]> {
    try {
      const results = await this.deps.provider.suggest({
        siteId: this.deps.siteId,
        prefix: cleaned,
        limit: 5,
      });
      return results.map((hit) => ({
        title: hit.title,
        path: hit.path,
        entityLabel: hit.entityLabel,
      }));
    } catch {
      return [];
    }
  }

  private async recordQuery(normalized: string, raw: string, resultCount: number): Promise<void> {
    try {
      await this.deps.repository.logQuery({ rawQuery: raw, normalizedQuery: normalized, resultCount });
    } catch (error) {
      this.deps.logger.warn({ err: error }, 'search query logging failed');
    }
  }
}

export type { Locale };
