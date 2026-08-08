import {
  ABSOLUTE_MIN_WORD_COUNT,
  INDEXABILITY_THRESHOLD,
  INDEXABILITY_WEIGHTS,
  REQUIRED_FIELDS,
  WORD_COUNT_FLOOR,
  type IndexOverride,
  type PageKind,
} from '@stc/constants';

import { wordCount } from './text.js';

/**
 * Multi-signal indexability scoring.
 *
 * Returns a decision plus the reasons behind it, so the admin can show an
 * editor exactly what to fix rather than a bare "not indexable".
 */

export type IndexabilityInput = {
  kind: PageKind;
  /** Raw HTML or plain text of the page body. */
  body: string;
  /** Field name → whether it is populated. Compared against REQUIRED_FIELDS. */
  fields: Record<string, unknown>;
  /** schema.org @type values emitted on the page. */
  structuredDataTypes?: readonly string[];
  /**
   * 0..1 — share of the page that is not boilerplate shared with sibling
   * pages. Computed by comparing against the page-kind template; when unknown,
   * pass undefined and it is treated as neutral rather than penalised.
   */
  uniqueness?: number;
  override?: IndexOverride;
};

export type IndexabilityReason = {
  signal: 'WORD_COUNT' | 'STRUCTURED_DATA' | 'COMPLETENESS' | 'UNIQUENESS' | 'OVERRIDE' | 'FLOOR';
  earned: number;
  possible: number;
  detail: string;
};

export type IndexabilityResult = {
  indexable: boolean;
  score: number;
  words: number;
  reasons: readonly IndexabilityReason[];
  /** Fields an editor still needs to fill in. Drives the admin checklist. */
  missingFields: readonly string[];
};

export function evaluateIndexability(input: IndexabilityInput): IndexabilityResult {
  const words = wordCount(input.body);
  const floor = WORD_COUNT_FLOOR[input.kind];
  const required = REQUIRED_FIELDS[input.kind];
  const reasons: IndexabilityReason[] = [];

  const missingFields = required.filter((f) => {
    const v = input.fields[f];
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
  });

  // 1. Word count — ratio to this page kind's floor, capped at full marks.
  const wordRatio = Math.min(1, floor === 0 ? 1 : words / floor);
  const wordScore = wordRatio * INDEXABILITY_WEIGHTS.WORD_COUNT;
  reasons.push({
    signal: 'WORD_COUNT',
    earned: round(wordScore),
    possible: INDEXABILITY_WEIGHTS.WORD_COUNT,
    detail: `${words} words against a ${floor}-word floor for ${input.kind}`,
  });

  // 2. Structured data — present or not. Binary; partial JSON-LD is not a thing.
  const hasSchema = (input.structuredDataTypes?.length ?? 0) > 0;
  const schemaScore = hasSchema ? INDEXABILITY_WEIGHTS.STRUCTURED_DATA : 0;
  reasons.push({
    signal: 'STRUCTURED_DATA',
    earned: schemaScore,
    possible: INDEXABILITY_WEIGHTS.STRUCTURED_DATA,
    detail: hasSchema
      ? `JSON-LD present: ${input.structuredDataTypes!.join(', ')}`
      : 'No JSON-LD emitted',
  });

  // 3. Completeness — proportion of required fields populated.
  const completeRatio = required.length === 0 ? 1 : 1 - missingFields.length / required.length;
  const completeScore = completeRatio * INDEXABILITY_WEIGHTS.COMPLETENESS;
  reasons.push({
    signal: 'COMPLETENESS',
    earned: round(completeScore),
    possible: INDEXABILITY_WEIGHTS.COMPLETENESS,
    detail:
      missingFields.length === 0
        ? 'All required fields populated'
        : `Missing: ${missingFields.join(', ')}`,
  });

  // 4. Uniqueness — unknown is neutral (full marks), not a penalty. Penalising
  //    a signal you have not measured makes the score meaningless.
  const uniqueRatio = input.uniqueness ?? 1;
  const uniqueScore = clamp01(uniqueRatio) * INDEXABILITY_WEIGHTS.UNIQUENESS;
  reasons.push({
    signal: 'UNIQUENESS',
    earned: round(uniqueScore),
    possible: INDEXABILITY_WEIGHTS.UNIQUENESS,
    detail:
      input.uniqueness === undefined
        ? 'Not measured — treated as neutral'
        : `${Math.round(uniqueRatio * 100)}% non-boilerplate`,
  });

  const score = round(wordScore + schemaScore + completeScore + uniqueScore);

  // Hard floor: no override rescues an essentially empty page. An empty URL in
  // the sitemap is a crawl-budget leak no matter who insists on it.
  if (words < ABSOLUTE_MIN_WORD_COUNT) {
    reasons.push({
      signal: 'FLOOR',
      earned: 0,
      possible: 0,
      detail: `Below the absolute floor of ${ABSOLUTE_MIN_WORD_COUNT} words — override ignored`,
    });
    return { indexable: false, score, words, reasons, missingFields };
  }

  const override = input.override ?? 'AUTO';
  if (override !== 'AUTO') {
    reasons.push({
      signal: 'OVERRIDE',
      earned: 0,
      possible: 0,
      detail: `Editor override: ${override}`,
    });
    return {
      indexable: override === 'FORCE_INDEX',
      score,
      words,
      reasons,
      missingFields,
    };
  }

  return { indexable: score >= INDEXABILITY_THRESHOLD, score, words, reasons, missingFields };
}

/** Convenience for the metadata builder. */
export function robotsDirective(result: IndexabilityResult): string {
  return result.indexable ? 'index, follow' : 'noindex, follow';
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
