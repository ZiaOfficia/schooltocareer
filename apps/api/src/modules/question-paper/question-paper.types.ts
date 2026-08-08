import type { Locale, PaperType, PublishStatus, SortDirection } from '@stc/types';

export type PaperFileRecord = {
  id: string;
  fileRole: string;
  locale: Locale;
  version: number;
  publishedAt: Date | null;
  media: {
    id: string;
    secureUrl: string;
    bytes: bigint | null;
    pageCount: number | null;
    mimeType: string;
  };
};

export type PaperListRecord = {
  id: string;
  slug: string;
  title: string;
  paperType: PaperType;
  year: number;
  shift: string | null;
  setCode: string | null;
  locale: Locale;
  hasSolution: boolean;
  downloadCount: number;
  status: PublishStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  exam: { id: string; slug: string; shortName: string } | null;
  subject: { id: string; slug: string; name: string } | null;
};

export type PaperRecord = PaperListRecord & {
  dedupeKey: string;
  examId: string | null;
  boardId: string | null;
  boardClassId: string | null;
  subjectId: string | null;
  totalQuestions: number | null;
  totalMarks: number | null;
  durationMin: number | null;
  createdAt: Date;
  deletedAt: Date | null;
  board: { id: string; slug: string; shortName: string } | null;
  boardClass: { id: string; slug: string } | null;
  files: PaperFileRecord[];
};

/** Fields that can be faceted. Each maps to a real, indexed column. */
export const PAPER_FACET_FIELDS = [
  'year',
  'paperType',
  'examId',
  'boardId',
  'subjectId',
  'shift',
  'locale',
] as const;

export type PaperFacetField = (typeof PAPER_FACET_FIELDS)[number];

export type PaperFilters = {
  year?: number[] | undefined;
  yearFrom?: number | undefined;
  yearTo?: number | undefined;
  paperType?: PaperType[] | undefined;
  examId?: string[] | undefined;
  boardId?: string[] | undefined;
  boardClassId?: string[] | undefined;
  subjectId?: string[] | undefined;
  shift?: string[] | undefined;
  locale?: Locale[] | undefined;
  hasSolution?: boolean | undefined;
  search?: string | undefined;
  status?: PublishStatus | undefined;
  includeDeleted?: boolean;
  publicOnly?: boolean;
};

export type PaperListParams = PaperFilters & {
  page: number;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type PaperCursorParams = PaperFilters & {
  cursor?: string | undefined;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type PaperWriteData = {
  title: string;
  paperType: PaperType;
  year: number;
  shift: string | null;
  setCode: string | null;
  locale: Locale;
  examId: string | null;
  boardId: string | null;
  boardClassId: string | null;
  subjectId: string | null;
  totalQuestions: number | null;
  totalMarks: number | null;
  durationMin: number | null;
  status: PublishStatus;
};