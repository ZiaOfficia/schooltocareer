/**
 * WRITTEN CONTENT FOR AN EXAM SECTION — pattern, syllabus and the like.
 *
 * These are the sections exam-sections.ts used to leave out because nothing
 * stood behind them. Content here is what stands behind them, so the rule is
 * strict: every page names the official document it was written from, and a
 * figure that document does not give is not on the page.
 *
 * Blocks rather than markdown or raw JSX, so a table is always the same table
 * and a page cannot invent its own layout.
 */

export type ContentBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | {
      kind: 'table';
      /** Read out to screen readers and shown above the table. */
      caption: string;
      head: readonly string[];
      rows: ReadonlyArray<readonly string[]>;
      /** A last row to set apart, usually a total. */
      foot?: readonly string[];
      note?: string;
    };

export type ExamContent = {
  /** One or two sentences under the heading. */
  lede: string;
  /**
   * The official document this page was written from. Required — it is what
   * lets the page wear the "Official" badge, which cannot render without a URL.
   */
  source: { name: string; url: string; publishedBy: string };
  /** ISO date the page was last checked against that document. */
  checkedOn: string;
  /** Said plainly when the document is for an earlier cycle than the current one. */
  cycleNote?: string;
  parts: ReadonlyArray<{ title: string; blocks: readonly ContentBlock[] }>;
  faqs: ReadonlyArray<{ question: string; answer: string }>;
};

/** The sections that exist only where content has been written. */
export const EDITORIAL_SECTIONS = ['exam-pattern', 'syllabus'] as const;
export type EditorialSection = (typeof EDITORIAL_SECTIONS)[number];

export type ExamContentSet = Partial<Record<EditorialSection, ExamContent>>;
