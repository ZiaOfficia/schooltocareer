import type {
  EducationLevel,
  ExamFrequency,
  ExamLevel,
  ExamMode,
  PublishStatus,
  SortDirection,
} from '@stc/types';

/**
 * Repository output shapes — deliberately Prisma-free.
 *
 * The repository's `select` produces exactly these structures, and TypeScript
 * checks that structurally. That is what lets the mapper, service and
 * controller stay free of any Prisma import while still being fully typed,
 * without the runtime cost of an extra mapping layer inside the repository.
 */

export type ExamRecord = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  fullName: string | null;
  conductingBody: string;
  categoryId: string | null;
  boardId: string | null;
  level: ExamLevel;
  mode: ExamMode;
  frequency: ExamFrequency;
  educationLevel: EducationLevel;
  officialWebsite: string | null;
  logoId: string | null;
  overview: string | null;
  popularityScore: number;
  isActive: boolean;
  status: PublishStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  category: { id: string; name: string; slug: string } | null;
  board: { id: string; name: string; shortName: string; slug: string } | null;
  logo: { id: string; secureUrl: string; altText: string | null; blurDataUrl: string | null } | null;
};

/** Trimmed projection for list endpoints — `overview` alone is ~20KB per row. */
export type ExamListRecord = Pick<
  ExamRecord,
  | 'id'
  | 'slug'
  | 'name'
  | 'shortName'
  | 'level'
  | 'mode'
  | 'educationLevel'
  | 'popularityScore'
  | 'isActive'
  | 'status'
  | 'publishedAt'
  | 'updatedAt'
  | 'category'
  | 'logo'
>;

export type ExamDetailRecord = ExamRecord & {
  years: Array<{
    id: string;
    year: number;
    sessionName: string | null;
    slug: string;
    isCurrent: boolean;
    events: Array<{
      id: string;
      type: string;
      title: string;
      startDate: Date | null;
      endDate: Date | null;
      isTentative: boolean;
      officialUrl: string | null;
      order: number;
    }>;
  }>;
};

export type ExamFilters = {
  categoryId?: string | undefined;
  categorySlug?: string | undefined;
  boardId?: string | undefined;
  level?: ExamLevel | undefined;
  mode?: ExamMode | undefined;
  educationLevel?: EducationLevel | undefined;
  status?: PublishStatus | undefined;
  isActive?: boolean | undefined;
  search?: string | undefined;
  includeDeleted?: boolean;
  /** Public callers only ever see PUBLISHED rows; set by the service, not the client. */
  publicOnly?: boolean;
};

export type ExamListParams = ExamFilters & {
  page: number;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type ExamCursorParams = ExamFilters & {
  cursor?: string | undefined;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

/** Fields written on create/update. Dates and ids only — no nested relations. */
export type ExamWriteData = {
  name: string;
  shortName: string;
  fullName: string | null;
  conductingBody: string;
  categoryId: string | null;
  boardId: string | null;
  level: ExamLevel;
  mode: ExamMode;
  frequency: ExamFrequency;
  educationLevel: EducationLevel;
  officialWebsite: string | null;
  logoId: string | null;
  overview: string | null;
  isActive: boolean;
  status: PublishStatus;
};
