import { ROUTES } from '@stc/constants';
import type { OwnerType } from '@stc/types';
import { buildExcerpt, contentHash, stripHtml } from '@stc/utils';

import type { ISearchDocumentSource } from '../../core/search/search-source.js';
import type { SearchDocumentInput } from '../../providers/search/search.provider.js';

import type { ExamRepository } from './exam.repository.js';

/**
 * Turns an Exam row into a search document.
 *
 * This is the whole per-module cost of being searchable — roughly 40 lines, no
 * new infrastructure. Phase 5 modules implement the same interface.
 *
 * Note it re-reads the row rather than trusting the event payload: by the time
 * the worker runs, the exam may have been edited twice or unpublished.
 */
export class ExamSearchSource implements ISearchDocumentSource {
  readonly ownerType: OwnerType = 'EXAM';
  readonly entityLabel = 'Exam';
  readonly defaultBoost = 1;

  constructor(
    private readonly repository: Pick<ExamRepository, 'findById' | 'listIndexableIds'>,
    private readonly siteId: string,
  ) {}

  async build(ownerId: string): Promise<SearchDocumentInput | null> {
    const exam = await this.repository.findById(ownerId);

    // Null means "remove from the index". Unpublished and soft-deleted rows
    // must not be searchable — on this site a draft exam page can contain
    // dates the conducting body has not announced.
    if (!exam || exam.status !== 'PUBLISHED' || exam.deletedAt) return null;

    const body = exam.overview ? stripHtml(exam.overview) : '';

    return {
      siteId: this.siteId,
      ownerType: 'EXAM',
      ownerId: exam.id,
      locale: 'EN',
      path: ROUTES.exam(exam.slug),
      title: exam.name,
      summary: buildExcerpt(exam.overview ?? exam.conductingBody, 200),
      body,
      // Keywords carry weight B in the tsvector — the abbreviations people
      // actually type ("NTA", "JEE") rarely appear in the prose body.
      keywords: [
        exam.shortName,
        exam.conductingBody,
        exam.level,
        exam.mode,
        exam.category?.name,
        exam.board?.shortName,
      ].filter((value): value is string => Boolean(value)),
      entityLabel: this.entityLabel,
      imageUrl: exam.logo?.secureUrl ?? null,
      facets: {
        categoryId: exam.categoryId,
        categorySlug: exam.category?.slug ?? null,
        boardId: exam.boardId,
        level: exam.level,
        mode: exam.mode,
        educationLevel: exam.educationLevel,
      },
      popularity: exam.popularityScore,
      boost: 1,
      publishedAt: exam.publishedAt,
      // Lets the provider skip a write when nothing indexable changed. Most
      // reindex events fire on edits to fields the index does not carry.
      sourceHash: contentHash([
        exam.slug,
        exam.name,
        exam.shortName,
        exam.conductingBody,
        exam.overview,
        exam.status,
        exam.popularityScore,
      ]),
    };
  }
  /** Enumerates published rows for a full reindex. See ISearchDocumentSource. */
  async listIndexableIds(
    cursor: string | undefined,
    limit: number,
  ): Promise<{ ids: string[]; nextCursor: string | null }> {
    const ids = await this.repository.listIndexableIds(cursor, limit);
    // A short page means the walk is finished; a full page means there may be
    // more, so hand back the last id as the next seek position.
    return { ids, nextCursor: ids.length === limit ? (ids.at(-1) ?? null) : null };
  }
}