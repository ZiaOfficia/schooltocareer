import { ROUTES } from '@stc/constants';
import type {
  ExamDetailDto,
  ExamDto,
  ExamEventDto,
  ExamListItemDto,
  ExamYearDto,
} from '@stc/types';
import { evaluateIndexability, toIsoDate } from '@stc/utils';

import type { ExamDetailRecord, ExamListRecord, ExamRecord } from './exam.types.js';

/**
 * DTOs — the public shape of an exam.
 *
 * Two rules this file enforces:
 *
 *  1. NO DATABASE ROW EVER REACHES A CONTROLLER. Everything crossing the API
 *     boundary goes through a mapper, so adding an internal column cannot
 *     accidentally publish it.
 *  2. Dates are ISO strings, not Date objects. `JSON.stringify(new Date())`
 *     happens to produce ISO, but relying on that means the day someone returns
 *     a raw Date from a raw query, the contract silently changes.
 *
 * `path` is computed here rather than stored, so every consumer — frontend,
 * sitemap, search indexer — gets the same URL from one definition.
 */

/**
 * The DTO SHAPES now live in @stc/types so apps/web consumes the same
 * definition instead of restating it. This file keeps the MAPPERS — turning a
 * database row into the public shape is API-side work and stays here.
 *
 * Re-exported so existing imports from this module keep working.
 */
export type {
  ExamDetailDto,
  ExamDto,
  ExamEventDto,
  ExamListItemDto,
  ExamYearDto,
} from '@stc/types';

export function toExamListItemDto(record: ExamListRecord): ExamListItemDto {
  return {
    id: record.id,
    slug: record.slug,
    path: ROUTES.exam(record.slug),
    name: record.name,
    shortName: record.shortName,
    level: record.level,
    mode: record.mode,
    educationLevel: record.educationLevel,
    popularityScore: record.popularityScore,
    isActive: record.isActive,
    status: record.status,
    publishedAt: toIsoDate(record.publishedAt),
    updatedAt: toIsoDate(record.updatedAt) ?? '',
    category: record.category,
    logo: record.logo
      ? { url: record.logo.secureUrl, alt: record.logo.altText, blurDataUrl: record.logo.blurDataUrl }
      : null,
    isIndexable: isExamHubIndexable(record),
  };
}

/**
 * Computed HERE, not on the page, because two consumers need the same answer:
 * `generateMetadata` decides between index and noindex, and the sitemap decides
 * whether to advertise the URL at all. When those disagree the sitemap submits
 * URLs that serve `noindex` — which is what happened, for 100 exam URLs built
 * entirely from placeholder seed data.
 *
 * Reuses `evaluateIndexability` and `REQUIRED_FIELDS.EXAM_HUB` rather than
 * restating the rules. The body is the overview because that is the only prose
 * unique to an exam hub; the rest of the page is the same tables and headings
 * on every exam, which is exactly what the UNIQUENESS signal exists to discount.
 */
function isExamHubIndexable(record: {
  name: string;
  conductingBody: string | null;
  overview?: string | null;
  level: string;
  mode: string;
}): boolean {
  return evaluateIndexability({
    kind: 'EXAM_HUB',
    body: record.overview ?? '',
    fields: {
      name: record.name,
      conductingBody: record.conductingBody,
      overview: record.overview ?? null,
      level: record.level,
      mode: record.mode,
    },
    // The exam hub template always emits these three. Constant, not measured.
    structuredDataTypes: ['BreadcrumbList', 'FAQPage', 'EducationalOccupationalProgram'],
  }).indexable;
}

export function toExamDto(record: ExamRecord): ExamDto {
  return {
    ...toExamListItemDto(record),
    fullName: record.fullName,
    conductingBody: record.conductingBody,
    frequency: record.frequency,
    officialWebsite: record.officialWebsite,
    overview: record.overview,
    board: record.board ? { ...record.board, path: ROUTES.board(record.board.slug) } : null,
    createdAt: toIsoDate(record.createdAt) ?? '',
  };
}

export function toExamDetailDto(record: ExamDetailRecord): ExamDetailDto {
  return {
    ...toExamDto(record),
    years: record.years.map((year) => ({
      id: year.id,
      year: year.year,
      sessionName: year.sessionName,
      slug: year.slug,
      isCurrent: year.isCurrent,
      events: year.events
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((event) => ({
          id: event.id,
          type: event.type,
          title: event.title,
          startDate: toIsoDate(event.startDate),
          endDate: toIsoDate(event.endDate),
          isTentative: event.isTentative,
          officialUrl: event.officialUrl,
        })),
    })),
  };
}

/**
 * Snapshot for revisions and domain events. Relations are flattened to ids —
 * a revision must be replayable even if the related category was since renamed.
 */
export function toExamSnapshot(record: ExamRecord): Record<string, unknown> {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    shortName: record.shortName,
    fullName: record.fullName,
    conductingBody: record.conductingBody,
    categoryId: record.categoryId,
    boardId: record.boardId,
    level: record.level,
    mode: record.mode,
    frequency: record.frequency,
    educationLevel: record.educationLevel,
    officialWebsite: record.officialWebsite,
    logoId: record.logoId,
    overview: record.overview,
    isActive: record.isActive,
    status: record.status,
    publishedAt: toIsoDate(record.publishedAt),
  };
}
