import type { OwnerType } from '@stc/types';
import { buildExcerpt, contentHash, stripHtml } from '@stc/utils';

import type { ISearchDocumentSource } from '../../core/search/search-source.js';
import type { SearchDocumentInput } from '../../providers/search/search.provider.js';

import type { BlogRepository } from './blog.repository.js';

export class BlogSearchSource implements ISearchDocumentSource {
  readonly ownerType: OwnerType = 'CONTENT_ENTRY';
  // ContentEntry spans ARTICLE and NEWS. The static label is the primary one;
  // build() narrows per row, which the registry tolerates by design.
  readonly entityLabel = 'Article';
  readonly defaultBoost = 1;

  constructor(
    private readonly repository: Pick<BlogRepository, 'findById' | 'listIndexableIds'>,
    private readonly siteId: string,
  ) {}

  async build(ownerId: string): Promise<SearchDocumentInput | null> {
    const post = await this.repository.findById(ownerId);
    if (!post || post.deletedAt) return null;

    // A scheduled post is DRAFT with a future publishedAt. Indexing it would
    // surface an article nobody can read yet.
    if (post.status !== 'PUBLISHED') return null;
    if (post.publishedAt && post.publishedAt > new Date()) return null;

    const body = post.bodyHtml ? stripHtml(post.bodyHtml) : '';

    return {
      siteId: this.siteId,
      ownerType: 'CONTENT_ENTRY',
      ownerId: post.id,
      locale: post.locale,
      path: post.path,
      title: post.title,
      summary: post.excerpt ?? buildExcerpt(body, 200),
      body,
      keywords: [post.type, post.category?.name, post.author?.name, post.subtitle].filter(
        (value): value is string => Boolean(value),
      ),
      entityLabel: post.type === 'NEWS' ? 'News' : 'Article',
      imageUrl: post.featuredImage?.secureUrl ?? null,
      facets: {
        type: post.type,
        categoryId: post.categoryId,
        authorId: post.authorId,
        examId: post.examId,
        boardId: post.boardId,
      },
      popularity: post.viewCount,
      boost: post.isFeatured ? 1.3 : 1,
      publishedAt: post.publishedAt,
      sourceHash: contentHash([
        post.slug,
        post.title,
        post.excerpt,
        post.bodyHtml?.length,
        post.status,
        post.categoryId,
      ]),
    };
  }
}