import type { ContentType, Locale, PostListItemDto, PublishStatus } from '@stc/types';
import { toIsoDate } from '@stc/utils';

import type { PostListRecord, PostRecord } from './blog.types.js';

/** Shape lives in @stc/types so apps/web consumes the same definition.
 *  The MAPPERS stay here — turning a row into the public shape is API work. */
export type { PostListItemDto } from '@stc/types';

export type PostDto = PostListItemDto & {
  bodyHtml: string | null;
  bodyJson: Record<string, unknown> | null;
  examId: string | null;
  boardId: string | null;
  createdAt: string;
  updatedAt: string;
};

function isScheduled(record: PostListRecord): boolean {
  return record.status === 'DRAFT' && record.publishedAt !== null && record.publishedAt > new Date();
}

export function toPostListItemDto(record: PostListRecord): PostListItemDto {
  return {
    id: record.id,
    slug: record.slug,
    path: record.path,
    type: record.type,
    title: record.title,
    subtitle: record.subtitle,
    excerpt: record.excerpt,
    locale: record.locale,
    status: record.status,
    publishedAt: toIsoDate(record.publishedAt),
    isScheduled: isScheduled(record),
    readingMinutes: record.readingMinutes,
    isFeatured: record.isFeatured,
    viewCount: record.viewCount,
    version: record.version,
    author: record.author
      ? { ...record.author, path: record.author.slug ? `/author/${record.author.slug}` : null }
      : null,
    category: record.category
      ? { id: record.category.id, name: record.category.name, slug: record.category.slug }
      : null,
    featuredImage: record.featuredImage
      ? {
          url: record.featuredImage.secureUrl,
          alt: record.featuredImage.altText,
          blurDataUrl: record.featuredImage.blurDataUrl,
        }
      : null,
  };
}

export function toPostDto(record: PostRecord): PostDto {
  return {
    ...toPostListItemDto(record),
    bodyHtml: record.bodyHtml,
    bodyJson: record.bodyJson,
    examId: record.examId,
    boardId: record.boardId,
    createdAt: toIsoDate(record.createdAt) ?? '',
    updatedAt: toIsoDate(record.updatedAt) ?? '',
  };
}

export function toPostSnapshot(record: PostRecord): Record<string, unknown> {
  return {
    id: record.id,
    slug: record.slug,
    path: record.path,
    type: record.type,
    title: record.title,
    subtitle: record.subtitle,
    excerpt: record.excerpt,
    bodyHtml: record.bodyHtml,
    bodyJson: record.bodyJson,
    readingMinutes: record.readingMinutes,
    categoryId: record.categoryId,
    featuredImageId: record.featuredImageId,
    isFeatured: record.isFeatured,
    locale: record.locale,
    status: record.status,
    version: record.version,
  };
}