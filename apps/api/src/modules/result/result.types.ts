import type { PublishStatus, ResultType, SortDirection } from '@stc/types';

export type ResultLink = { label: string; url: string; region?: string | null | undefined };

/**
 * Statistics are schema-validated but deliberately open: boards publish
 * different aggregates (stream-wise pass rates, district toppers) and a closed
 * type would reject real data. The named fields are the ones the UI renders.
 */
export type ResultStatistics = {
  appeared?: number | undefined;
  passed?: number | undefined;
  passPercentage?: number | undefined;
  toppers?: Array<{ name: string; score: string }> | undefined;
  [key: string]: unknown;
};

export type ResultListRecord = {
  id: string;
  slug: string;
  title: string;
  resultType: ResultType;
  year: number;
  isDeclared: boolean;
  declaredAt: Date | null;
  expectedAt: Date | null;
  status: PublishStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  exam: { id: string; slug: string; shortName: string } | null;
  board: { id: string; slug: string; shortName: string } | null;
};

export type ResultRecord = ResultListRecord & {
  examId: string | null;
  examYearId: string | null;
  boardId: string | null;
  boardClassId: string | null;
  officialUrl: string | null;
  links: ResultLink[] | null;
  statistics: ResultStatistics | null;
  createdAt: Date;
  deletedAt: Date | null;
};

/** Same five-field pattern as papers. Reuses the shared facet builder as-is. */
export const RESULT_FACET_FIELDS = ['year', 'resultType', 'examId', 'boardId', 'isDeclared'] as const;
export type ResultFacetField = (typeof RESULT_FACET_FIELDS)[number];

export type ResultFilters = {
  year?: number[] | undefined;
  resultType?: ResultType[] | undefined;
  examId?: string[] | undefined;
  boardId?: string[] | undefined;
  isDeclared?: boolean | undefined;
  expectedWithinDays?: number | undefined;
  search?: string | undefined;
  status?: PublishStatus | undefined;
  includeDeleted?: boolean;
  publicOnly?: boolean;
};

export type ResultListParams = ResultFilters & {
  page: number;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type ResultWriteData = {
  title: string;
  resultType: ResultType;
  year: number;
  examId: string | null;
  examYearId: string | null;
  boardId: string | null;
  boardClassId: string | null;
  expectedAt: Date | null;
  officialUrl: string | null;
  status: PublishStatus;
};