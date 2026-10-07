import type { Locale, PaperFileRole } from '../enums.js';

import type { PaperListItemDto } from './listings.js';

/**
 * THE PUBLIC SHAPE OF ONE PAPER — hoisted here on the commit that added the
 * page which reads it, per the rule in dto/listings.ts.
 *
 * `files` is the CURRENT version of each role. The client never sees media ids
 * or superseded versions — it sees a download link.
 */

export type PaperFileDto = {
  role: PaperFileRole;
  locale: Locale;
  url: string;
  /** Human-readable, e.g. "2.1 MB". Null when the provider reported no size. */
  sizeLabel: string | null;
  pageCount: number | null;
  version: number;
};

export type PaperDetailDto = PaperListItemDto & {
  totalQuestions: number | null;
  totalMarks: number | null;
  durationMin: number | null;
  board: { id: string; slug: string; shortName: string; path: string } | null;
  files: PaperFileDto[];
  createdAt: string;
  updatedAt: string;
};
