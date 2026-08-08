import { ROUTES } from '@stc/constants';
import type { OwnerType } from '@stc/types';
import { buildExcerpt, contentHash, stripHtml } from '@stc/utils';

import type { ISearchDocumentSource } from '../../core/search/search-source.js';
import type { SearchDocumentInput } from '../../providers/search/search.provider.js';

import type { BoardRepository } from './board.repository.js';

/**
 * Board search document. ~45 lines, same as the exam source - no new
 * infrastructure, which is the point of the registry.
 */
export class BoardSearchSource implements ISearchDocumentSource {
  readonly ownerType: OwnerType = 'BOARD';
  readonly entityLabel = 'Board';
  readonly defaultBoost = 1;

  constructor(
    private readonly repository: Pick<BoardRepository, 'findById' | 'listIndexableIds'>,
    private readonly siteId: string,
  ) {}

  async build(ownerId: string): Promise<SearchDocumentInput | null> {
    const board = await this.repository.findById(ownerId);
    if (!board || board.status !== 'PUBLISHED' || board.deletedAt) return null;

    return {
      siteId: this.siteId,
      ownerType: 'BOARD',
      ownerId: board.id,
      locale: 'EN',
      path: ROUTES.board(board.slug),
      title: board.name,
      summary: buildExcerpt(board.description ?? board.name, 200),
      body: board.description ? stripHtml(board.description) : '',
      // People search "UP Board" and "UPMSP", never the full legal name.
      keywords: [board.shortName, board.type, board.state?.name, board.state?.code, board.headquarters]
        .filter((value): value is string => Boolean(value)),
      entityLabel: this.entityLabel,
      imageUrl: board.logo?.secureUrl ?? null,
      facets: {
        type: board.type,
        stateId: board.stateId,
        stateSlug: board.state?.slug ?? null,
      },
      popularity: board.popularityScore,
      boost: 1,
      publishedAt: board.publishedAt,
      sourceHash: contentHash([
        board.slug,
        board.name,
        board.shortName,
        board.description,
        board.status,
        board.popularityScore,
      ]),
    };
  }
}