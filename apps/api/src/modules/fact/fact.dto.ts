import type {
  FactChangeKind,
  FactConfidence,
  FactReviewStatus,
  FactRisk,
  FactType,
  OwnerType,
} from '@stc/types';
import { toIsoDate } from '@stc/utils';

import type { FactChangeDetailRecord, FactChangeRecord } from './fact.types.js';

/**
 * The public shape of a fact change.
 *
 * Same two rules as every other DTO in the codebase: no database row reaches a
 * controller, and dates cross the boundary as ISO strings.
 *
 * A third rule specific to this module: THE EVIDENCE IS PART OF THE CONTRACT.
 * It is tempting to trim it for payload size, but a review UI that shows a
 * proposed exam date without the sentence it came from is asking a human to
 * rubber-stamp, which is worse than no review at all.
 */

export type FactChangeDto = {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  factType: FactType;
  kind: FactChangeKind;
  previousValue: string | null;
  proposedValue: string | null;
  risk: FactRisk;
  confidence: FactConfidence;
  status: FactReviewStatus;
  canonicalModel: string;
  canonicalId: string | null;
  /**
   * True when this change may not be approved without a written reason —
   * surfaced so the admin can require the field before the request is sent
   * rather than after a 422.
   */
  requiresReason: boolean;
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FactChangeDetailDto = FactChangeDto & {
  observation: {
    id: string;
    rawValue: string;
    normalizedValue: string;
    isTentative: boolean;
    evidence: string;
    extractorVersion: string;
    extractedAt: string;
  };
  source: { id: string; name: string; url: string; authority: string };
  snapshot: { id: string; fetchedAt: string; contentHash: string | null };
  reviewedBy: { id: string; name: string } | null;
};

export function toFactChangeDto(record: FactChangeRecord): FactChangeDto {
  return {
    id: record.id,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    factType: record.factType,
    kind: record.kind,
    previousValue: record.previousValue,
    proposedValue: record.proposedValue,
    risk: record.risk,
    confidence: record.confidence,
    status: record.status,
    canonicalModel: record.canonicalModel,
    canonicalId: record.canonicalId,
    requiresReason: record.confidence === 'LOW',
    reviewedAt: toIsoDate(record.reviewedAt),
    decisionReason: record.decisionReason,
    createdAt: toIsoDate(record.createdAt) ?? '',
    updatedAt: toIsoDate(record.updatedAt) ?? '',
  };
}

export function toFactChangeDetailDto(record: FactChangeDetailRecord): FactChangeDetailDto {
  return {
    ...toFactChangeDto(record),
    observation: {
      id: record.extractedFact.id,
      rawValue: record.extractedFact.rawValue,
      normalizedValue: record.extractedFact.normalizedValue,
      isTentative: record.extractedFact.isTentative,
      evidence: record.extractedFact.evidence,
      extractorVersion: record.extractedFact.extractorVersion,
      extractedAt: toIsoDate(record.extractedFact.extractedAt) ?? '',
    },
    // Provenance is not optional on this endpoint. A reviewer must be able to
    // open the page the value was read from and the exact snapshot it came
    // from; "the system says so" is not a basis for publishing a date.
    source: record.extractedFact.source,
    snapshot: {
      id: record.extractedFact.snapshot.id,
      fetchedAt: toIsoDate(record.extractedFact.snapshot.fetchedAt) ?? '',
      contentHash: record.extractedFact.snapshot.contentHash,
    },
    reviewedBy: record.reviewedBy,
  };
}
