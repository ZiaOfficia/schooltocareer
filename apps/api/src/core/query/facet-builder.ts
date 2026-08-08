import type { FacetBucket, FacetCount, FacetGroup, FacetKind, FacetValue } from '@stc/types';

/**
 * Facet assembly.
 *
 * The split matters: this file is PURE. It knows nothing about Prisma or any
 * model — it takes raw `{ value, count }` aggregations and turns them into
 * labelled, sorted, selection-aware groups. The `GROUP BY` itself stays in the
 * repository, where model-specific typing belongs.
 *
 * That is what makes it reusable: Result, Search and College supply their own
 * aggregations and get identical filter-panel semantics for free.
 */

export type FacetSpec = {
  /** Query-parameter name. Must match the filter the service applies. */
  field: string;
  label: string;
  kind: FacetKind;
  /** Enum/id → display text. Omit when the raw value is already readable. */
  labelFor?: (value: FacetValue) => string;
  /** Buckets returned to the client. The rest are reachable via typeahead. */
  limit?: number;
  /** `count` (popularity) or `value` (chronological, alphabetical). */
  sort?: 'count' | 'value-desc' | 'value-asc';
  /** Hide options nobody can reach. Off for selected values — see below. */
  hideZero?: boolean;
};

export type FacetInput = {
  spec: FacetSpec;
  counts: FacetCount[];
  /** Currently applied values for this field. */
  selected: readonly FacetValue[];
};

const DEFAULT_LIMIT = 20;

export function buildFacetGroups(inputs: readonly FacetInput[]): FacetGroup[] {
  return inputs.map(buildFacetGroup);
}

export function buildFacetGroup({ spec, counts, selected }: FacetInput): FacetGroup {
  const selectedSet = new Set(selected.map(String));

  const buckets: FacetBucket[] = counts
    .filter((row): row is FacetCount & { value: FacetValue } => row.value !== null)
    .map((row) => ({
      value: row.value,
      label: spec.labelFor ? spec.labelFor(row.value) : String(row.value),
      count: row.count,
      selected: selectedSet.has(String(row.value)),
    }));

  // A selected value that now yields nothing MUST still render, or the checkbox
  // the user just ticked disappears and they cannot untick it. This is the
  // single most common faceted-search bug.
  for (const value of selected) {
    if (!buckets.some((bucket) => String(bucket.value) === String(value))) {
      buckets.push({
        value,
        label: spec.labelFor ? spec.labelFor(value) : String(value),
        count: 0,
        selected: true,
      });
    }
  }

  const visible = spec.hideZero ? buckets.filter((b) => b.count > 0 || b.selected) : buckets;
  sortBuckets(visible, spec.sort ?? 'count');

  // Selected options are pinned to the top so they never fall off the far side
  // of a display limit.
  visible.sort((a, b) => Number(b.selected) - Number(a.selected));

  const limit = spec.limit ?? DEFAULT_LIMIT;

  return {
    field: spec.field,
    label: spec.label,
    kind: spec.kind,
    buckets: visible.slice(0, limit),
    totalOptions: visible.length,
  };
}

function sortBuckets(buckets: FacetBucket[], sort: NonNullable<FacetSpec['sort']>): void {
  switch (sort) {
    case 'count':
      buckets.sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
      return;
    case 'value-desc':
      buckets.sort((a, b) => compareValues(b.value, a.value));
      return;
    case 'value-asc':
      buckets.sort((a, b) => compareValues(a.value, b.value));
  }
}

function compareValues(a: FacetValue, b: FacetValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * DISJUNCTIVE FACETING — the rule that decides whether a filter panel is usable.
 *
 * When the user filters `year=2024`, the YEAR facet must still show every year,
 * while every OTHER facet reflects the 2024 restriction. Computing all facets
 * against the fully-filtered set instead collapses the year list to a single
 * option and the user can never switch years without clearing the filter first.
 *
 * So each facet's counts are computed against the filters MINUS its own. This
 * returns the filter set to use for one facet.
 */
export function whereForFacet<TFilters extends Record<string, unknown>>(
  filters: TFilters,
  ownField: keyof TFilters & string,
): TFilters {
  const clone = { ...filters };
  delete clone[ownField];
  return clone;
}

/**
 * Facet aggregation costs one query per facet. Six facets over a filtered set
 * is six `GROUP BY` scans on top of the page query and the count.
 *
 * Mitigations, in order of preference:
 *   1. Run them in one transaction so it is a single round trip (repository).
 *   2. Cache the unfiltered facet set — the common landing-page case — under
 *      the entity's list tag, so it is computed once per publish rather than
 *      once per visitor.
 *   3. Only then consider a materialised counts table.
 */
export const FACET_CACHE_TTL_SECONDS = 300;
