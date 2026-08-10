import { ROUTES } from '@stc/constants';
import type { Locale, PaperListItemDto, PaperType, PublishStatus } from '@stc/types';
import { formatBytes, toIsoDate } from '@stc/utils';

import type { PaperListRecord, PaperRecord } from './question-paper.types.js';

/**
 * Paper DTOs.
 *
 * `files` is flattened to the CURRENT version of each role, with a
 * human-readable size. The client never sees version numbers or media ids -
 * it sees a download link.
 */

export type PaperFileDto = {
  role: string;
  locale: Locale;
  url: string;
  sizeLabel: string | null;
  pageCount: number | null;
  version: number;
};

/** Shape lives in @stc/types so apps/web consumes the same definition.
 *  The MAPPERS stay here — turning a row into the public shape is API work. */
export type { PaperListItemDto } from '@stc/types';

export type PaperDto = PaperListItemDto & {
  totalQuestions: number | null;
  totalMarks: number | null;
  durationMin: number | null;
  board: { id: string; slug: string; shortName: string; path: string } | null;
  files: PaperFileDto[];
  createdAt: string;
  updatedAt: string;
};

export function toPaperListItemDto(record: PaperListRecord): PaperListItemDto {
  return {
    id: record.id,
    slug: record.slug,
    path: ROUTES.paper(record.slug),
    title: record.title,
    paperType: record.paperType,
    year: record.year,
    shift: record.shift,
    setCode: record.setCode,
    locale: record.locale,
    hasSolution: record.hasSolution,
    downloadCount: record.downloadCount,
    status: record.status,
    publishedAt: toIsoDate(record.publishedAt),
    exam: record.exam ? { ...record.exam, path: ROUTES.exam(record.exam.slug) } : null,
    subject: record.subject,
  };
}

export function toPaperDto(record: PaperRecord): PaperDto {
  return {
    ...toPaperListItemDto(record),
    totalQuestions: record.totalQuestions,
    totalMarks: record.totalMarks,
    durationMin: record.durationMin,
    board: record.board ? { ...record.board, path: ROUTES.board(record.board.slug) } : null,
    files: record.files.map((file) => ({
      role: file.fileRole,
      locale: file.locale,
      url: file.media.secureUrl,
      sizeLabel: file.media.bytes === null ? null : formatBytes(file.media.bytes),
      pageCount: file.media.pageCount,
      version: file.version,
    })),
    createdAt: toIsoDate(record.createdAt) ?? '',
    updatedAt: toIsoDate(record.updatedAt) ?? '',
  };
}

export function toPaperSnapshot(record: PaperRecord): Record<string, unknown> {
  return {
    id: record.id,
    slug: record.slug,
    dedupeKey: record.dedupeKey,
    title: record.title,
    paperType: record.paperType,
    year: record.year,
    shift: record.shift,
    setCode: record.setCode,
    locale: record.locale,
    examId: record.examId,
    boardId: record.boardId,
    boardClassId: record.boardClassId,
    subjectId: record.subjectId,
    status: record.status,
  };
}