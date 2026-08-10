import { ROUTES } from '@stc/constants';
import type {
  BoardListItemDto,
  BoardType,
  PublishStatus,
  SchoolStage,
  StreamType,
} from '@stc/types';
import { toIsoDate } from '@stc/utils';

import type {
  BoardClassRecord,
  BoardDetailRecord,
  BoardListRecord,
  BoardRecord,
} from './board.types.js';

/**
 * Board DTOs. Same two rules as exam.dto.ts: no database row reaches a
 * controller, and dates cross the boundary as ISO strings.
 *
 * The hierarchy detail: a class's `path` is built from BOTH slugs here. The
 * frontend never concatenates `/board/${board}/${cls}` itself, which is what
 * makes a board rename a server-side concern rather than 40 template edits.
 */

/** Shape lives in @stc/types so apps/web consumes the same definition.
 *  The MAPPERS stay here — turning a row into the public shape is API work. */
export type { BoardListItemDto } from '@stc/types';

export type BoardDto = BoardListItemDto & {
  establishedYear: number | null;
  headquarters: string | null;
  officialWebsite: string | null;
  description: string | null;
  createdAt: string;
};

export type BoardClassDto = {
  id: string;
  slug: string;
  path: string;
  name: string;
  order: number;
  stage: SchoolStage;
  stream: StreamType | null;
  subjectCount: number;
  status: PublishStatus;
};

export type BoardDetailDto = BoardDto & {
  classes: BoardClassDto[];
  /** Classes grouped by stage — how the hub page actually renders them. */
  classesByStage: Array<{ stage: SchoolStage; classes: BoardClassDto[] }>;
};

const STAGE_ORDER: SchoolStage[] = ['PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'];

export function toBoardListItemDto(record: BoardListRecord): BoardListItemDto {
  return {
    id: record.id,
    slug: record.slug,
    path: ROUTES.board(record.slug),
    name: record.name,
    shortName: record.shortName,
    type: record.type,
    popularityScore: record.popularityScore,
    status: record.status,
    publishedAt: toIsoDate(record.publishedAt),
    updatedAt: toIsoDate(record.updatedAt) ?? '',
    state: record.state,
    logo: record.logo
      ? { url: record.logo.secureUrl, alt: record.logo.altText, blurDataUrl: record.logo.blurDataUrl }
      : null,
  };
}

export function toBoardDto(record: BoardRecord): BoardDto {
  return {
    ...toBoardListItemDto(record),
    establishedYear: record.establishedYear,
    headquarters: record.headquarters,
    officialWebsite: record.officialWebsite,
    description: record.description,
    createdAt: toIsoDate(record.createdAt) ?? '',
  };
}

export function toBoardClassDto(boardSlug: string, record: BoardClassRecord): BoardClassDto {
  return {
    id: record.id,
    slug: record.slug,
    path: ROUTES.boardClass(boardSlug, record.slug),
    name: record.classLevel.name,
    order: record.classLevel.order,
    stage: record.classLevel.stage,
    stream: record.stream,
    subjectCount: record.subjectCount,
    status: record.status,
  };
}

export function toBoardDetailDto(record: BoardDetailRecord): BoardDetailDto {
  const classes = record.classes
    .map((cls) => toBoardClassDto(record.slug, cls))
    .sort((a, b) => a.order - b.order || (a.stream ?? '').localeCompare(b.stream ?? ''));

  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    classes: classes.filter((cls) => cls.stage === stage),
  })).filter((group) => group.classes.length > 0);

  return { ...toBoardDto(record), classes, classesByStage: byStage };
}

export function toBoardSnapshot(record: BoardRecord): Record<string, unknown> {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    shortName: record.shortName,
    type: record.type,
    stateId: record.stateId,
    establishedYear: record.establishedYear,
    headquarters: record.headquarters,
    officialWebsite: record.officialWebsite,
    logoId: record.logoId,
    description: record.description,
    status: record.status,
    publishedAt: toIsoDate(record.publishedAt),
  };
}
