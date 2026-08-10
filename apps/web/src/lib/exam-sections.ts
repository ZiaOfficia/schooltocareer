import { ROUTES } from '@stc/constants';

/**
 * THE EXAM CLUSTER — which sub-pages exist, and what each one is made of.
 *
 * This is the single source of truth for two consumers that must never
 * disagree: the route that renders a section, and the sitemap that advertises
 * it. When they disagreed before, the sitemap listed 140 URLs that 404'd.
 *
 * WHAT IS AND IS NOT HERE, and why it matters more than the count:
 *
 * Four sections are backed by data we actually hold —
 *   previous-year-papers  QuestionPaper rows filtered by exam
 *   result                Result rows + the RESULT event
 *   admit-card            the ADMIT_CARD event + official link
 *   answer-key            the ANSWER_KEY event + official link
 *
 * Three are NOT, and are deliberately absent —
 *   syllabus · exam-pattern · eligibility
 * They need editorial content that does not exist: ContentEntry holds 300
 * rows, all ARTICLE or NEWS, none of them a syllabus for any exam. Shipping
 * them as headings over an empty state would be 60 thin pages, which is the
 * exact failure PRINCIPLES.md #6 exists to prevent — and it would earn the
 * same 404-in-a-sitemap problem in a worse form, because the page would return
 * 200 while saying nothing.
 *
 * Add a section here on the same commit that adds the content behind it, and
 * the sitemap picks it up automatically.
 */

export const EXAM_SECTIONS = {
  'previous-year-papers': {
    label: 'Previous year papers',
    /** Used as the H1 and in the title template. */
    heading: (name: string) => `${name} Previous Year Question Papers`,
    blurb:
      'Year-wise and shift-wise PDFs. Free, no registration, with solutions where the conducting body published an official answer key.',
    path: ROUTES.examPapers,
  },
  result: {
    label: 'Result',
    heading: (name: string, year: number) => `${name} Result ${year}`,
    blurb:
      'Declaration date, direct link to the official scorecard, and what is known so far. Where a result is not announced, this says so rather than estimating.',
    path: ROUTES.examResult,
  },
  'admit-card': {
    label: 'Admit card',
    heading: (name: string, year: number) => `${name} Admit Card ${year}`,
    blurb:
      'Release date and the official download page. Admit cards are issued by the conducting body only — never by us, and never by anyone charging for it.',
    path: ROUTES.examAdmitCard,
  },
  'answer-key': {
    label: 'Answer key',
    heading: (name: string, year: number) => `${name} Answer Key ${year}`,
    blurb:
      'Release date and the official answer key link, including the objection window where one is published.',
    path: ROUTES.examAnswerKey,
  },
} as const;

export type ExamSection = keyof typeof EXAM_SECTIONS;

export const EXAM_SECTION_SLUGS = Object.keys(EXAM_SECTIONS) as ExamSection[];

export function isExamSection(value: string): value is ExamSection {
  return Object.prototype.hasOwnProperty.call(EXAM_SECTIONS, value);
}

/** The event type each section reports on, where it has one. */
export const SECTION_EVENT: Partial<Record<ExamSection, string>> = {
  result: 'RESULT',
  'admit-card': 'ADMIT_CARD',
  'answer-key': 'ANSWER_KEY',
};
