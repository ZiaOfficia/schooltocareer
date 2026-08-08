import { ROUTES } from '@stc/constants';
import type { OwnerType } from '@stc/types';
import { contentHash } from '@stc/utils';

import type { ISearchDocumentSource } from '../../core/search/search-source.js';
import type { SearchDocumentInput } from '../../providers/search/search.provider.js';

import type { ResultRepository } from './result.repository.js';

export class ResultSearchSource implements ISearchDocumentSource {
  readonly ownerType: OwnerType = 'RESULT';
  readonly entityLabel = 'Result';
  readonly defaultBoost = 1;

  constructor(
    private readonly repository: Pick<ResultRepository, 'findById' | 'listIndexableIds'>,
    private readonly siteId: string,
  ) {}

  async build(ownerId: string): Promise<SearchDocumentInput | null> {
    const result = await this.repository.findById(ownerId);
    if (!result || result.status !== 'PUBLISHED' || result.deletedAt) return null;

    const entity = result.exam?.shortName ?? result.board?.shortName ?? '';

    return {
      siteId: this.siteId,
      ownerType: 'RESULT',
      ownerId: result.id,
      locale: 'EN',
      path: ROUTES.result(result.slug),
      title: result.title,
      summary: result.isDeclared
        ? `${entity} ${result.year} result declared. Direct link and scorecard details.`
        : `${entity} ${result.year} result date, time and direct link.`,
      body: [entity, result.year, result.resultType, result.isDeclared ? 'declared' : 'awaited']
        .filter(Boolean)
        .join(' '),
      keywords: [
        entity,
        String(result.year),
        'result',
        'scorecard',
        result.isDeclared ? 'declared' : 'result date',
      ].filter((value): value is string => Boolean(value)),
      entityLabel: this.entityLabel,
      imageUrl: null,
      facets: {
        year: result.year,
        resultType: result.resultType,
        examId: result.examId,
        boardId: result.boardId,
        isDeclared: result.isDeclared,
      },
      // A declared result is what students are searching for right now, so it
      // outranks the same page in its awaiting state.
      popularity: result.isDeclared ? 1000 : 100,
      boost: result.isDeclared ? 1.5 : 1,
      publishedAt: result.publishedAt,
      sourceHash: contentHash([
        result.slug,
        result.title,
        result.isDeclared,
        result.declaredAt?.toISOString(),
        result.expectedAt?.toISOString(),
        result.status,
      ]),
    };
  }
}