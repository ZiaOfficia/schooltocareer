import type { ReactElement } from 'react';

/**
 * ENTITY IDENTITY — the load-bearing component of the design system.
 *
 * Three signals, always together: an accent spine, a mark, and the word. Colour
 * is never the only one. For the ~1 in 12 men in India with a red–green
 * deficiency, `exam` (vermilion) and `result` (jade) are the risky pair — and
 * they carry the two most distinct marks, a target and a bar chart.
 *
 * The badge is OUTLINED with a spine. Workflow state (`StatusStamp`) is FILLED
 * and tinted. That difference in shape is what lets both sit on one row when
 * they land on the same hue, which they do: "Exam" and "Closing 12 Aug" are
 * both vermilion.
 *
 * Keyed on OwnerType, so nothing here is assigned per page.
 */
export type EntityKind = 'exam' | 'result' | 'paper' | 'article' | 'syllabus' | 'board';

const TONE: Record<EntityKind, string> = {
  exam: 'var(--color-t-exam)',
  result: 'var(--color-t-result)',
  paper: 'var(--color-t-paper)',
  article: 'var(--color-t-article)',
  syllabus: 'var(--color-t-syllabus)',
  board: 'var(--color-t-board)',
};

/** UI wording. `article` is the only word shown to humans — never "blog" or
 *  "post", which are the URL segment and the schema enum respectively. */
const LABEL: Record<EntityKind, string> = {
  exam: 'Exam',
  result: 'Result',
  paper: 'Paper',
  article: 'Article',
  syllabus: 'Syllabus',
  board: 'Board',
};

const MARK: Record<EntityKind, ReactElement> = {
  exam: (
    <>
      <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="6" r="1.7" />
    </>
  ),
  result: <path d="M1 7h2.4v4H1zM4.8 4h2.4v7H4.8zM8.6 1H11v10H8.6z" />,
  paper: (
    <>
      <path d="M2.2 1.1h4.6l3 3v6.8H2.2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.8 1.2v3h3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  article: <path d="M1 2h10v1.7H1zM1 5.2h10v1.7H1zM1 8.4h6v1.7H1z" />,
  syllabus: (
    <path d="M1 1.6h2.2v2.2H1zM4.8 2h6.2v1.5H4.8zM1 5.2h2.2v2.2H1zM4.8 5.6h6.2v1.5H4.8zM1 8.8h2.2v2.2H1zM4.8 9.2h6.2v1.5H4.8z" />
  ),
  board: (
    <>
      <path d="M1 4.8L6 1.4l5 3.4v6.2H1z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.6 6.9h2.8v4.1H4.6z" />
    </>
  ),
};

export function EntityBadge({
  kind,
  label,
  className = '',
}: {
  kind: EntityKind;
  /** Overrides the default word. Use for "Previous year paper" over "Paper". */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] border border-rule bg-surface px-2 py-px font-data text-[9.5px] font-semibold uppercase tracking-[0.09em] whitespace-nowrap ${className}`}
      style={{ color: TONE[kind], borderLeft: `4px solid ${TONE[kind]}` }}
    >
      <svg viewBox="0 0 12 12" width="11" height="11" fill="currentColor" aria-hidden="true">
        {MARK[kind]}
      </svg>
      {label ?? LABEL[kind]}
    </span>
  );
}
