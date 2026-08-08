import type { Locale, OwnerType } from '@stc/types';
import { normalizeQuery } from '@stc/utils';

import { SearchUnavailableError } from '../../core/errors/app-error.js';

import type { SearchRepository } from './search.repository.js';
import type {
  ISearchProvider,
  SearchDocumentInput,
  SearchQueryParams,
  SearchResultPage,
  SearchSuggestion,
  SuggestParams,
} from './search.provider.js';

/**
 * PostgreSQL full-text search. The launch implementation.
 *
 * At 100k documents this is genuinely sufficient and costs nothing extra.
 * Committing to Elasticsearch on day one is infrastructure spend against a
 * problem that does not exist yet.
 */
export class PostgresSearchProvider implements ISearchProvider {
  readonly name = 'postgres-fts';

  constructor(private readonly repository: SearchRepository) {}

  async index(document: SearchDocumentInput): Promise<void> {
    // Skip when nothing changed — most reindex events fire on unrelated edits.
    if (document.sourceHash) {
      const existing = await this.repository.getSourceHash(
        document.siteId,
        document.ownerType,
        document.ownerId,
        document.locale,
      );
      if (existing === document.sourceHash) return;
    }
    await this.repository.upsert(document);
  }

  async indexMany(documents: readonly SearchDocumentInput[]): Promise<void> {
    // Sequential on purpose. A bulk import firing 5,000 concurrent upserts
    // exhausts the Neon connection pool and takes the API down with it.
    for (const doc of documents) {
      await this.index(doc);
    }
  }

  async remove(ownerType: OwnerType, ownerId: string, locale?: Locale): Promise<void> {
    await this.repository.deactivate(ownerType, ownerId, locale);
  }

  async query(params: SearchQueryParams): Promise<SearchResultPage> {
    const cleaned = normalizeQuery(params.query);
    if (!cleaned) return { hits: [], total: 0, tookMs: 0 };

    const startedAt = Date.now();
    try {
      const { hits, total } = await this.repository.search({
        siteId: params.siteId,
        query: cleaned,
        locale: params.locale ?? 'EN',
        ...(params.entityLabels ? { entityLabels: params.entityLabels } : {}),
        limit: params.limit,
        offset: params.offset ?? 0,
      });
      return { hits, total, tookMs: Date.now() - startedAt };
    } catch (error) {
      throw new SearchUnavailableError(error);
    }
  }

  async suggest(params: SuggestParams): Promise<SearchSuggestion[]> {
    const cleaned = normalizeQuery(params.prefix);
    if (cleaned.length < 2) return [];
    try {
      return await this.repository.suggest({
        siteId: params.siteId,
        prefix: cleaned,
        locale: params.locale ?? 'EN',
        limit: params.limit,
      });
    } catch (error) {
      throw new SearchUnavailableError(error);
    }
  }

  healthy(): Promise<boolean> {
    return this.repository.ping();
  }
}
