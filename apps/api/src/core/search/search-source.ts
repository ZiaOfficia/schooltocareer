import type { OwnerType } from '@stc/types';

import type { SearchDocumentInput } from '../../providers/search/search.provider.js';

/**
 * The extension point every indexable module plugs into.
 *
 * The outbox worker receives `{ ownerType, ownerId }` and must produce a search
 * document. It cannot know how to read an Exam versus a QuestionPaper, so each
 * module registers a source that does.
 *
 * Returning `null` from `build` means "this row should NOT be in the index" —
 * unpublished, soft-deleted, or gone. The worker removes it rather than
 * treating a missing row as an error, because by the time the worker runs the
 * row may legitimately have been unpublished.
 *
 * ── INTERFACE EVOLUTION (Phase 5, Search) ─────────────────────────────────
 * The original interface carried only `ownerType` and `build()`. Building the
 * Search module exposed two things it could not answer WITHOUT the caller
 * branching on entity type — which is exactly the failure mode a registry is
 * supposed to prevent:
 *
 *   1. "What are the searchable entity kinds?"  The search facet panel and the
 *      `?type=` filter need the labels BEFORE any document is built. Without a
 *      static `entityLabel`, SearchService would have needed a hardcoded list.
 *
 *   2. "Give me every id of this kind."  A full reindex — after a provider
 *      migration or a scoring change — has to enumerate rows. Without
 *      `listIndexableIds`, the reindex endpoint would need a switch over
 *      modules.
 *
 * Extending the interface was the fix; branching in SearchService was the
 * alternative and would have coupled search to every module.
 */
export interface ISearchDocumentSource {
  readonly ownerType: OwnerType;

  /**
   * Display label for this kind, e.g. "Previous Year Paper".
   *
   * MUST match the `entityLabel` that `build()` emits — sources reference this
   * property rather than repeating the string, so the two cannot drift.
   */
  readonly entityLabel: string;

  /**
   * False for kinds that are crawlable but deliberately absent from SITE
   * search. Categories are the case in point: a search for "JEE" should return
   * articles, not the category page that lists them.
   */
  readonly searchable?: boolean;

  /** Ranking multiplier applied to every document from this source. */
  readonly defaultBoost?: number;

  build(ownerId: string): Promise<SearchDocumentInput | null>;

  /**
   * Enumerates ids for a full reindex, in pages.
   *
   * Optional: a source that omits it simply cannot be bulk-reindexed and is
   * kept current by events alone. Cursor-based rather than offset — a reindex
   * walks the entire table, which is precisely where `OFFSET 40000` hurts.
   */
  listIndexableIds?(cursor: string | undefined, limit: number): Promise<{
    ids: string[];
    nextCursor: string | null;
  }>;
}

export class SearchSourceRegistry {
  private readonly sources = new Map<OwnerType, ISearchDocumentSource>();

  register(...sources: ISearchDocumentSource[]): this {
    for (const source of sources) {
      this.sources.set(source.ownerType, source);
    }
    return this;
  }

  get(ownerType: OwnerType): ISearchDocumentSource | undefined {
    return this.sources.get(ownerType);
  }

  registeredTypes(): OwnerType[] {
    return [...this.sources.keys()];
  }

  /** Sources that participate in site search. */
  searchable(): ISearchDocumentSource[] {
    return [...this.sources.values()].filter((source) => source.searchable !== false);
  }

  /** Entity labels for the search facet panel and the `?type=` allowlist. */
  searchableLabels(): string[] {
    return [...new Set(this.searchable().map((source) => source.entityLabel))];
  }

  /** Sources that can be bulk-reindexed. */
  reindexable(): ISearchDocumentSource[] {
    return this.searchable().filter((source) => typeof source.listIndexableIds === 'function');
  }

  byLabel(label: string): ISearchDocumentSource | undefined {
    return this.searchable().find((source) => source.entityLabel === label);
  }
}
