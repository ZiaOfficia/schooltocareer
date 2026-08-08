import type { BoardType, PublishStatus, SchoolStage, SortDirection, StreamType } from '@stc/types';

/**
 * Repository output shapes - Prisma-free, exactly as in exam.types.ts.
 * The repository`s `select` produces these structurally.
 */

export type BoardRecord = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  type: BoardType;
  stateId: string | null;
  establishedYear: number | null;
  headquarters: string | null;
  officialWebsite: string | null;
  logoId: string | null;
  description: string | null;
  popularityScore: number;
  status: PublishStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  state: { id: string; name: string; slug: string; code: string } | null;
  logo: { id: string; secureUrl: string; altText: string | null; blurDataUrl: string | null } | null;
};

export type BoardListRecord = Pick<
  BoardRecord,
  | 'id' | 'slug' | 'name' | 'shortName' | 'type' | 'popularityScore'
  | 'status' | 'publishedAt' | 'updatedAt' | 'state' | 'logo'
>;

export type BoardClassRecord = {
  id: string;
  slug: string;
  stream: StreamType | null;
  status: PublishStatus;
  classLevel: { id: string; name: string; slug: string; order: number; stage: SchoolStage };
  subjectCount: number;
};

/** Board plus its class tree - the hub page read, in one query. */
export type BoardDetailRecord = BoardRecord & {
  classes: BoardClassRecord[];
};

export type BoardFilters = {
  type?: BoardType | undefined;
  stateId?: string | undefined;
  stateSlug?: string | undefined;
  status?: PublishStatus | undefined;
  search?: string | undefined;
  includeDeleted?: boolean;
  publicOnly?: boolean;
};

export type BoardListParams = BoardFilters & {
  page: number;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type BoardCursorParams = BoardFilters & {
  cursor?: string | undefined;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type BoardWriteData = {
  name: string;
  shortName: string;
  type: BoardType;
  stateId: string | null;
  establishedYear: number | null;
  headquarters: string | null;
  officialWebsite: string | null;
  logoId: string | null;
  description: string | null;
  status: PublishStatus;
};