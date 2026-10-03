import type {
  ExamEventType,
  FactChangeKind,
  FactConfidence,
  FactRisk,
  FactReviewStatus,
  FactType,
  OwnerType,
} from '@stc/types';

/**
 * CANONICAL OWNERSHIP — resolved by reading the schema, not by preference.
 *
 * The rule this table enforces: a fact has exactly ONE owner, and it is a model
 * that already exists. Nothing here adds a column. The full derivation, with
 * the rejected alternatives, is in docs/CANONICAL-FACT-OWNERSHIP.md.
 *
 * Every one of the six fact types lands on `ExamEvent`, which is not a
 * coincidence — ExamEvent is already the model the exam page reads its dates
 * from, and its own schema comment calls the important-dates block "the single
 * highest-traffic block on any exam page". Routing facts anywhere else would
 * mean the page and the fact engine disagreed about where truth lives.
 *
 * TWO NEAR-MISSES, and why they are wrong:
 *
 *   `Exam.examDate`      Does not exist, and must not. An exam has a date PER
 *                        CYCLE — JEE Main runs two sessions a year — so a
 *                        single column on Exam cannot represent the data, and
 *                        adding it would make ExamEvent and Exam disagree the
 *                        first time a second session was announced.
 *
 *   `Result.declaredAt`  Exists, and is tempting for RESULT_DATE. Rejected:
 *                        `Result` is the DECLARED ARTEFACT — a scorecard with
 *                        links and statistics — and one exam cycle can have
 *                        several (paper 1, paper 2, final merit). The date on
 *                        the exam timeline is one value and belongs to the
 *                        timeline. So: ExamEvent(RESULT) owns "when results
 *                        come out"; Result owns "here is the scorecard". Split
 *                        by question answered, not by name similarity.
 */
export const CANONICAL_OWNER: Record<
  FactType,
  {
    /** Prisma model that holds the published value. */
    model: 'ExamEvent';
    /** Which ExamEvent row within the cycle. */
    eventType: ExamEventType;
    /** Which column an approval writes. */
    field: 'dateRange' | 'officialUrl';
  }
> = {
  EXAM_DATE: { model: 'ExamEvent', eventType: 'EXAM_DATE', field: 'dateRange' },
  APPLICATION_START: { model: 'ExamEvent', eventType: 'APPLICATION_START', field: 'dateRange' },
  APPLICATION_END: { model: 'ExamEvent', eventType: 'APPLICATION_END', field: 'dateRange' },
  RESULT_DATE: { model: 'ExamEvent', eventType: 'RESULT', field: 'dateRange' },
  // Per-cycle application and result links hang off the same event as the date
  // they belong to — `ExamEvent.officialUrl` already exists and the exam page
  // already renders it as "Official notice".
  OFFICIAL_APPLICATION_URL: {
    model: 'ExamEvent',
    eventType: 'APPLICATION_START',
    field: 'officialUrl',
  },
  OFFICIAL_RESULT_URL: { model: 'ExamEvent', eventType: 'RESULT', field: 'officialUrl' },
};

/** Default titles for an event row the approval has to create. */
export const EVENT_TITLE: Record<ExamEventType, string> = {
  NOTIFICATION: 'Official notification',
  APPLICATION_START: 'Application opens',
  APPLICATION_END: 'Last date to apply',
  CORRECTION_WINDOW: 'Correction window',
  ADMIT_CARD: 'Admit card release',
  EXAM_DATE: 'Exam date',
  ANSWER_KEY: 'Answer key release',
  RESULT: 'Result declaration',
  COUNSELLING: 'Counselling',
};

/** A source the extractor may read, joined to the exam it speaks for. */
export type ExtractionTarget = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  snapshotId: string;
  snapshotFetchedAt: Date;
  rawContent: string | null;
  rawTruncated: boolean;
  examId: string;
  examSlug: string;
  /** The cycle an approval would write into. Null when the exam has no cycle. */
  examYearId: string | null;
  examYear: number | null;
  /** The cycle the source page is bound to in the registry. */
  boundCycleYear: number;
};

/** The canonical value as it stands right now, for one fact. */
export type CanonicalSnapshot = {
  /** Null when no event row exists yet. */
  eventId: string | null;
  /** Normalised the same way an observation is, so comparison is string-equal. */
  value: string | null;
  /** Optimistic-concurrency token: the event row's `updatedAt`. */
  version: Date | null;
};

export type ExtractedFactRecord = {
  id: string;
  sourceId: string;
  snapshotId: string;
  ownerType: OwnerType;
  ownerId: string;
  factType: FactType;
  rawValue: string;
  normalizedValue: string;
  confidence: FactConfidence;
  isTentative: boolean;
  evidence: string;
  extractorVersion: string;
  extractedAt: Date;
};

export type FactChangeRecord = {
  id: string;
  extractedFactId: string;
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
  canonicalVersion: Date | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A change plus the evidence and entity labels a reviewer needs on screen. */
export type FactChangeDetailRecord = FactChangeRecord & {
  extractedFact: ExtractedFactRecord & {
    source: { id: string; name: string; url: string; authority: string };
    snapshot: { id: string; fetchedAt: Date; contentHash: string | null };
  };
  reviewedBy: { id: string; name: string } | null;
};

export type FactChangeListParams = {
  page: number;
  perPage: number;
  status?: FactReviewStatus | undefined;
  risk?: FactRisk | undefined;
  ownerId?: string | undefined;
  factType?: FactType | undefined;
};

/** What one extraction pass did. Reported by the worker task, and to metrics. */
export type ExtractionTally = {
  snapshots: number;
  observations: number;
  changes: number;
  critical: number;
  /** Values that parsed to an impossible date and were discarded. */
  invalid: number;
  /** Refused because the stored body was truncated. */
  truncated: number;
  /** Read successfully and stated nothing about any watched fact. */
  silent: number;
  /**
   * Skipped because the page is bound to a different cycle from the exam's
   * current one — usually a site that has not rolled to the new year yet.
   */
  offCycle: number;
  superseded: number;
};
