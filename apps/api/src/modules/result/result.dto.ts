import { ROUTES } from '@stc/constants';
import type { PublishStatus, ResultListItemDto, ResultType } from '@stc/types';
import { daysUntil, toIsoDate } from '@stc/utils';

import { phaseOf, type ResultPhase } from './result.service.js';
import type { ResultLink, ResultListRecord, ResultRecord, ResultStatistics } from './result.types.js';

/**
 * Result DTOs.
 *
 * `phase` and `daysUntilExpected` are computed server-side. The frontend must
 * not derive "is this declared yet" from three nullable fields - that logic
 * would end up duplicated in the page, the card and the homepage widget, and
 * the three would disagree.
 */

/** Shape lives in @stc/types so apps/web consumes the same definition.
 *  The MAPPERS stay here — turning a row into the public shape is API work. */
export type { ResultListItemDto } from '@stc/types';

export type ResultDto = ResultListItemDto & {
  officialUrl: string | null;
  links: ResultLink[];
  statistics: ResultStatistics | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toResultListItemDto(record: ResultListRecord): ResultListItemDto {
  return {
    id: record.id,
    slug: record.slug,
    path: ROUTES.result(record.slug),
    title: record.title,
    resultType: record.resultType,
    year: record.year,
    phase: phaseOf(record),
    isDeclared: record.isDeclared,
    declaredAt: toIsoDate(record.declaredAt),
    expectedAt: toIsoDate(record.expectedAt),
    // Negative means overdue - the page should say "expected earlier today",
    // not hide the fact that the board is late.
    daysUntilExpected:
      record.expectedAt && !record.isDeclared ? daysUntil(record.expectedAt) : null,
    status: record.status,
    exam: record.exam ? { ...record.exam, path: ROUTES.exam(record.exam.slug) } : null,
    board: record.board ? { ...record.board, path: ROUTES.board(record.board.slug) } : null,
  };
}

export function toResultDto(record: ResultRecord): ResultDto {
  return {
    ...toResultListItemDto(record),
    officialUrl: record.officialUrl,
    links: record.links ?? [],
    statistics: record.statistics,
    publishedAt: toIsoDate(record.publishedAt),
    createdAt: toIsoDate(record.createdAt) ?? '',
    updatedAt: toIsoDate(record.updatedAt) ?? '',
  };
}

export function toResultSnapshot(record: ResultRecord): Record<string, unknown> {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    resultType: record.resultType,
    year: record.year,
    examId: record.examId,
    boardId: record.boardId,
    isDeclared: record.isDeclared,
    declaredAt: toIsoDate(record.declaredAt),
    expectedAt: toIsoDate(record.expectedAt),
    officialUrl: record.officialUrl,
    status: record.status,
  };
}