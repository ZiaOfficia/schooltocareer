/**
 * Faceted browsing.
 *
 * A facet is a filter that also reports how many results each option would
 * yield: `2024 (312) · 2023 (289) · Shift 1 (156)`. It is the difference
 * between a filter panel a user can navigate and one they have to guess at.
 *
 * These types are shared rather than module-local because facets are needed by
 * QuestionPaper (year, exam, subject, shift), Result (year, board, type),
 * Search (entity kind, level) and eventually College (state, fees, ranking).
 * Four consumers, one shape.
 */

export type FacetValue = string | number | boolean;

export type FacetBucket = {
  /** The filter value to send back, e.g. `2024` or `"PREVIOUS_YEAR"`. */
  value: FacetValue;
  /** Human-readable, resolved server-side — the client never maps enums. */
  label: string;
  count: number;
  /** True when this option is part of the current query. */
  selected: boolean;
};

export type FacetGroup = {
  /** Query-parameter name: `year`, `paperType`, `examId`. */
  field: string;
  label: string;
  kind: FacetKind;
  buckets: FacetBucket[];
  /** Total distinct options, when `buckets` is truncated by a display limit. */
  totalOptions: number;
};

/**
 * How the client should render the group, decided server-side because the
 * server knows the cardinality. Twelve years is a checkbox list; four hundred
 * exams is a typeahead.
 */
export const FACET_KINDS = ['single', 'multi', 'range', 'boolean', 'typeahead'] as const;
export type FacetKind = (typeof FACET_KINDS)[number];

/** A faceted list response: the page, its meta, and the filter panel. */
export type FacetedResult<T, TMeta> = {
  items: T[];
  meta: TMeta;
  facets: FacetGroup[];
};

/** Raw aggregation output, before labels and selection are applied. */
export type FacetCount = { value: FacetValue | null; count: number };
