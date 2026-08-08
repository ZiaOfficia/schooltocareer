import type { FacetGroup } from '@stc/types';

import type { SearchHit } from '../../providers/search/search.provider.js';

/**
 * Search DTOs.
 *
 * `highlight` arrives from the provider with <mark> around matches. It is
 * server-generated from the indexed text, never from user input, so it is safe
 * to render - but the frontend must still render it as sanitised HTML rather
 * than trusting it blindly.
 */

export type SearchHitDto = {
  path: string;
  title: string;
  summary: string | null;
  highlight: string | null;
  entityLabel: string;
  imageUrl: string | null;
  score: number;
};

export type SearchSuggestionDto = {
  title: string;
  path: string;
  entityLabel: string;
};

export type SearchResultDto = {
  query: string;
  hits: SearchHitDto[];
  total: number;
  tookMs: number;
  facets: FacetGroup[];
  /** Populated only when the search found nothing - usually a typo. */
  suggestions: SearchSuggestionDto[];
};

export function toSearchResultDto(hit: SearchHit): SearchHitDto {
  return {
    path: hit.path,
    title: hit.title,
    summary: hit.summary,
    highlight: hit.highlight,
    entityLabel: hit.entityLabel,
    imageUrl: hit.imageUrl,
    // Rounded: exposing raw ts_rank_cd values leaks the scoring formula and
    // means nothing to a client.
    score: Math.round(hit.score * 1000) / 1000,
  };
}