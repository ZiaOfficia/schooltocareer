import type { Locale, OwnerType } from '@stc/types';

/**
 * Search abstraction.
 *
 * SearchDocument is the canonical index and is already provider-agnostic.
 * PostgresSearchProvider reads it directly via the generated tsvector;
 * a future MeilisearchProvider is FED from the same table by a second
 * OutboxEvent consumer. Migration is a new consumer, not a schema change.
 */
export interface ISearchProvider {
  readonly name: string;

  index(document: SearchDocumentInput): Promise<void>;
  indexMany(documents: readonly SearchDocumentInput[]): Promise<void>;
  remove(ownerType: OwnerType, ownerId: string, locale?: Locale): Promise<void>;

  query(params: SearchQueryParams): Promise<SearchResultPage>;
  /** Prefix/typo-tolerant suggestions for the search-as-you-type box. */
  suggest(params: SuggestParams): Promise<SearchSuggestion[]>;

  healthy(): Promise<boolean>;
}

export type SearchDocumentInput = {
  siteId: string;
  ownerType: OwnerType;
  ownerId: string;
  locale: Locale;
  path: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  keywords?: string[];
  entityLabel: string;
  imageUrl?: string | null;
  facets?: Record<string, unknown> | null;
  popularity?: number;
  boost?: number;
  publishedAt?: Date | null;
  /** Skips the write when unchanged — most reindex events are no-ops. */
  sourceHash?: string | null;
};

export type SearchQueryParams = {
  siteId: string;
  query: string;
  locale?: Locale;
  /** Restrict to entity kinds, e.g. only papers. */
  entityLabels?: readonly string[];
  facets?: Record<string, string | number | undefined>;
  limit: number;
  offset?: number;
};

export type SearchHit = {
  ownerType: OwnerType;
  ownerId: string;
  path: string;
  title: string;
  summary: string | null;
  entityLabel: string;
  imageUrl: string | null;
  /** Server-highlighted fragment with <mark> around matches. */
  highlight: string | null;
  score: number;
};

export type SearchResultPage = {
  hits: SearchHit[];
  total: number;
  tookMs: number;
};

export type SuggestParams = {
  siteId: string;
  prefix: string;
  locale?: Locale;
  limit: number;
};

export type SearchSuggestion = {
  title: string;
  path: string;
  entityLabel: string;
};
