import data from './board-prep.json';

/**
 * BOARD EXAM PREP — important chapters, answer tips, official papers, for
 * CBSE 10/12, UP Board 10/12, ICSE 10 and ISC 12. One guide per page.
 *
 * ONE SOURCE OF TRUTH: board-prep.json. The two pages render from it, and
 * tooling/scripts/build-board-prep-sheet.py builds the downloadable .xlsx and
 * .csv files from the same file, so the page and the download cannot disagree.
 * Edit the JSON, then re-run the script.
 *
 * Unit marks are each board's own (CBSE 2026-27 curriculum; UPMSP 2026-27
 * syllabus; CISCE ISC 2027 syllabus). Every subject's units sum to its paper's
 * theory total — check that after any edit. CISCE publishes no chapter marks
 * for ICSE, so ICSE units carry marks: null and the page says so instead of
 * inventing a split. Each guide's `source` names where its figures came from.
 * The answer and revision tips are our own writing.
 */

export type BoardPrepUnit = {
  unit: string;
  chapters: string;
  /** Theory marks CBSE gives this unit. null where CBSE gives no unit split. */
  marks: number | null;
  answer: string;
  prep: string;
};

export type BoardPrepSubject = {
  name: string;
  code: string;
  /** Theory marks of the paper. Falls back to the class's theoryOutOf. */
  outOf?: number | null;
  units: BoardPrepUnit[];
};

export type BoardPrepPaperRow = {
  subject: string;
  links: Array<{ label: string; url: string }>;
};

export const BOARD_GUIDE_SLUGS = [
  'cbse-class-10',
  'cbse-class-12',
  'up-board-class-10',
  'up-board-class-12',
  'icse-class-10',
  'isc-class-12',
] as const;
export type BoardGuideSlug = (typeof BOARD_GUIDE_SLUGS)[number];

export type BoardGuide = {
  slug: BoardGuideSlug;
  board: string;
  boardName: string;
  classLabel: string;
  /** "CBSE Class 10" */
  label: string;
  theoryOutOf: number | null;
  title: string;
  h1: string;
  description: string;
  intro: string[];
  /** How the paper is set: shown on the page and true for the whole board/class. */
  notes: string[];
  subjects: BoardPrepSubject[];
  papers: BoardPrepPaperRow[];
  papersNote: string;
  source: { name: string; url: string; papersUrl: string };
  faqs: Array<{ question: string; answer: string }>;
};

export const BOARD_PREP = data as unknown as {
  checkedOn: string;
  session: string;
  exam: string;
  order: BoardGuideSlug[];
  download: { xlsx: string; googleSheet: string; csv: Record<BoardGuideSlug, string> };
  guides: Record<BoardGuideSlug, BoardGuide>;
  tips: Array<[string, string, string]>;
};

export function isBoardGuideSlug(value: string): value is BoardGuideSlug {
  return (BOARD_GUIDE_SLUGS as readonly string[]).includes(value);
}

export type Priority = 'High' | 'Medium' | 'Low';

export function paperOutOf(guide: BoardGuide, subject: BoardPrepSubject): number | null {
  return subject.outOf ?? guide.theoryOutOf;
}

/**
 * Priority by SHARE OF THE PAPER, not raw marks, so a 7-mark unit in a
 * 70-mark paper and in an 80-mark paper are judged the same way. The same
 * thresholds are in build-board-prep-sheet.py.
 */
export function priorityOf(marks: number | null, outOf: number | null): Priority | null {
  if (marks === null || !outOf) return null;
  const share = marks / outOf;
  if (share >= 0.18) return 'High';
  if (share >= 0.1) return 'Medium';
  return 'Low';
}
