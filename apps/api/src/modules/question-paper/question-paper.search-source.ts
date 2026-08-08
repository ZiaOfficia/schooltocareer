import { ROUTES } from '@stc/constants';
import type { OwnerType } from '@stc/types';
import { contentHash } from '@stc/utils';

import type { ISearchDocumentSource } from '../../core/search/search-source.js';
import type { SearchDocumentInput } from '../../providers/search/search.provider.js';

import type { QuestionPaperRepository } from './question-paper.repository.js';

/**
 * Paper search document.
 *
 * A paper has no prose, so the searchable text is built from its identity -
 * "JEE Main 2024 Physics Shift 1" is exactly what a student types. Facets carry
 * the structured fields so search results can be filtered the same way the
 * browse page filters them.
 */
export class QuestionPaperSearchSource implements ISearchDocumentSource {
  readonly ownerType: OwnerType = 'QUESTION_PAPER';
  readonly entityLabel = 'Previous Year Paper';
  readonly defaultBoost = 1;

  constructor(
    private readonly repository: Pick<QuestionPaperRepository, 'findById' | 'listIndexableIds'>,
    private readonly siteId: string,
  ) {}

  async build(ownerId: string): Promise<SearchDocumentInput | null> {
    const paper = await this.repository.findById(ownerId);
    if (!paper || paper.status !== 'PUBLISHED' || paper.deletedAt) return null;

    const descriptor = [
      paper.exam?.shortName ?? paper.board?.shortName,
      paper.year,
      paper.subject?.name,
      paper.shift ? `Shift ${paper.shift}` : null,
      paper.setCode ? `Set ${paper.setCode}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      siteId: this.siteId,
      ownerType: 'QUESTION_PAPER',
      ownerId: paper.id,
      locale: paper.locale,
      path: ROUTES.paper(paper.slug),
      title: paper.title,
      summary: descriptor,
      body: descriptor,
      keywords: [
        String(paper.year),
        paper.paperType,
        paper.exam?.shortName,
        paper.board?.shortName,
        paper.subject?.name,
        paper.hasSolution ? 'with solutions' : null,
        'pdf download',
      ].filter((value): value is string => Boolean(value)),
      entityLabel: this.entityLabel,
      imageUrl: null,
      facets: {
        year: paper.year,
        paperType: paper.paperType,
        examId: paper.examId,
        boardId: paper.boardId,
        subjectId: paper.subjectId,
        hasSolution: paper.hasSolution,
      },
      // Downloads are the honest popularity signal for a paper - nobody
      // bookmarks one, they grab the PDF.
      popularity: paper.downloadCount,
      boost: 1,
      publishedAt: paper.publishedAt,
      sourceHash: contentHash([
        paper.slug,
        paper.title,
        paper.year,
        paper.status,
        paper.hasSolution,
        paper.files.length,
      ]),
    };
  }
}