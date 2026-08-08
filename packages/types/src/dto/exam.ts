import type { EducationLevel, ExamFrequency, ExamLevel, ExamMode, PublishStatus } from '../enums.js';

/**
 * THE PUBLIC SHAPE OF AN EXAM — one definition, two consumers.
 *
 * These types live here rather than in apps/api because the web app must not
 * restate them. A duplicated contract drifts the first time a field is added,
 * and the drift surfaces as a runtime `undefined` in a Server Component rather
 * than as a compile error.
 *
 * apps/api maps database rows to these; apps/web consumes them. Neither owns
 * the shape, which is the point.
 */

export type ExamListItemDto = {
  id: string;
  slug: string;
  /** Computed from ROUTES, never stored. Every consumer gets the same URL. */
  path: string;
  name: string;
  shortName: string;
  level: ExamLevel;
  mode: ExamMode;
  educationLevel: EducationLevel;
  popularityScore: number;
  isActive: boolean;
  status: PublishStatus;
  publishedAt: string | null;
  updatedAt: string;
  category: { id: string; name: string; slug: string } | null;
  logo: { url: string; alt: string | null; blurDataUrl: string | null } | null;
};

export type ExamDto = ExamListItemDto & {
  fullName: string | null;
  conductingBody: string;
  frequency: ExamFrequency;
  officialWebsite: string | null;
  overview: string | null;
  board: { id: string; name: string; shortName: string; slug: string; path: string } | null;
  createdAt: string;
};

export type ExamEventDto = {
  id: string;
  type: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  /**
   * The agency announced it but has not finalised it. Surfaced to the reader
   * as an explicit "Tentative" label — presenting a provisional date as firm is
   * how a student misses a real deadline.
   */
  isTentative: boolean;
  officialUrl: string | null;
};

export type ExamYearDto = {
  id: string;
  year: number;
  sessionName: string | null;
  slug: string;
  isCurrent: boolean;
  events: ExamEventDto[];
};

export type ExamDetailDto = ExamDto & {
  years: ExamYearDto[];
};
