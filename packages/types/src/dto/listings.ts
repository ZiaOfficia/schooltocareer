import type {
  BoardType,
  ContentType,
  Locale,
  PaperType,
  PublishStatus,
  ResultType,
} from '../enums.js';

/**
 * Derived from the data, never stored — one less column that can disagree with
 * `isDeclared` and `expectedAt`. It lives here rather than in the API because
 * it crosses the wire inside ResultListItemDto, which makes it part of the
 * public contract regardless of where it is computed.
 */
export type ResultPhase = 'AWAITED' | 'EXPECTED' | 'DECLARED';

/**
 * LIST SHAPES for the browse pages — one definition, two consumers.
 *
 * Same reasoning as dto/exam.ts: apps/web must not restate what apps/api
 * returns, because a duplicated contract drifts the first time a field is
 * added and the drift shows up as a runtime `undefined` in a Server Component
 * rather than a compile error.
 *
 * Only the LIST items are here. Each entity's detail DTO stays in the API
 * until the page that consumes it exists — hoisting a type nobody imports is
 * how a shared package turns into a junk drawer.
 */

export type BoardListItemDto = {
  id: string;
  slug: string;
  path: string;
  name: string;
  shortName: string;
  type: BoardType;
  popularityScore: number;
  status: PublishStatus;
  publishedAt: string | null;
  updatedAt: string;
  state: { id: string; name: string; slug: string; code: string } | null;
  logo: { url: string; alt: string | null; blurDataUrl: string | null } | null;
};

export type PaperListItemDto = {
  id: string;
  slug: string;
  path: string;
  title: string;
  paperType: PaperType;
  year: number;
  shift: string | null;
  setCode: string | null;
  locale: Locale;
  hasSolution: boolean;
  downloadCount: number;
  status: PublishStatus;
  publishedAt: string | null;
  exam: { id: string; slug: string; shortName: string; path: string } | null;
  subject: { id: string; slug: string; name: string } | null;
};

export type ResultListItemDto = {
  id: string;
  slug: string;
  path: string;
  title: string;
  resultType: ResultType;
  year: number;
  phase: ResultPhase;
  isDeclared: boolean;
  declaredAt: string | null;
  expectedAt: string | null;
  daysUntilExpected: number | null;
  status: PublishStatus;
  exam: { id: string; slug: string; shortName: string; path: string } | null;
  board: { id: string; slug: string; shortName: string; path: string } | null;
};

export type PostListItemDto = {
  id: string;
  slug: string;
  path: string;
  type: ContentType;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  locale: Locale;
  status: PublishStatus;
  publishedAt: string | null;
  /** True while status is DRAFT and publishedAt is still in the future. */
  isScheduled: boolean;
  readingMinutes: number | null;
  isFeatured: boolean;
  viewCount: number;
  version: number;
  author: { id: string; name: string; slug: string | null; path: string | null } | null;
  category: { id: string; name: string; slug: string } | null;
  featuredImage: { url: string; alt: string | null; blurDataUrl: string | null } | null;
};
