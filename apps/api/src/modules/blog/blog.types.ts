import type { ContentType, Locale, PublishStatus, SortDirection } from '@stc/types';

export type PostListRecord = {
  id: string;
  siteId: string;
  slug: string;
  path: string;
  type: ContentType;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  locale: Locale;
  status: PublishStatus;
  publishedAt: Date | null;
  readingMinutes: number | null;
  isFeatured: boolean;
  viewCount: number;
  version: number;
  updatedAt: Date;
  author: { id: string; name: string; slug: string | null } | null;
  category: { id: string; name: string; slug: string; type: string } | null;
  featuredImage: { id: string; secureUrl: string; altText: string | null; blurDataUrl: string | null } | null;
};

export type PostRecord = PostListRecord & {
  bodyHtml: string | null;
  bodyJson: Record<string, unknown> | null;
  authorId: string;
  categoryId: string | null;
  featuredImageId: string | null;
  publishedRevisionId: bigint | null;
  examId: string | null;
  boardId: string | null;
  boardClassSubjectId: string | null;
  chapterId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export const POST_FACET_FIELDS = ['type', 'categoryId', 'authorId'] as const;
export type PostFacetField = (typeof POST_FACET_FIELDS)[number];

export type PostFilters = {
  type?: ContentType[] | undefined;
  categoryId?: string[] | undefined;
  authorId?: string[] | undefined;
  examId?: string | undefined;
  boardId?: string | undefined;
  isFeatured?: boolean | undefined;
  search?: string | undefined;
  status?: PublishStatus | undefined;
  includeDeleted?: boolean;
  publicOnly?: boolean;
  siteId: string;
};

export type PostListParams = PostFilters & {
  page: number;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type PostCursorParams = PostFilters & {
  cursor?: string | undefined;
  perPage: number;
  sortBy: string;
  sortDir: SortDirection;
};

export type PostWriteData = {
  type: ContentType;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  bodyHtml: string | null;
  bodyJson: Record<string, unknown> | null;
  readingMinutes: number | null;
  locale: Locale;
  categoryId: string | null;
  featuredImageId: string | null;
  isFeatured: boolean;
  examId: string | null;
  boardId: string | null;
  boardClassSubjectId: string | null;
  chapterId: string | null;
};