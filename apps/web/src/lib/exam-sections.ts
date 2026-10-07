import { ROUTES } from '@stc/constants';

import { EDITORIAL_SECTIONS, examContent, type EditorialSection } from '@/lib/exam-content';

/**
 * THE EXAM CLUSTER — which sub-pages exist, and what each one is made of.
 *
 * This is the single source of truth for two consumers that must never
 * disagree: the route that renders a section, and the sitemap that advertises
 * it. When they disagreed before, the sitemap listed 140 URLs that 404'd.
 *
 * TWO KINDS OF SECTION.
 *
 * Four are backed by data we hold for every exam, so every exam has them —
 *   previous-year-papers  QuestionPaper rows filtered by exam
 *   result                Result rows + the RESULT event
 *   admit-card            the ADMIT_CARD event + official link
 *   answer-key            the ANSWER_KEY event + official link
 *
 * Two are backed by WRITTEN content, so an exam has them only once that
 * content exists in lib/exam-content —
 *   exam-pattern · syllabus
 *
 * These were absent entirely until content was written for the first exam,
 * and for every other exam they still are: /exam/<slug>/syllabus is a 404
 * until someone writes that exam's syllabus from its official document.
 * Shipping the heading over an empty state would be the thin page
 * PRINCIPLES.md #6 exists to prevent, returning 200 while saying nothing.
 *
 * So "does this section exist" is a question about an EXAM, not about the
 * registry. Ask `sectionsFor(slug)` or `hasSection(slug, section)`; do not
 * iterate EXAM_SECTIONS to build links.
 *
 * eligibility is still deliberately absent: no content exists for it.
 */

export const EXAM_SECTIONS = {
  'exam-pattern': {
    label: 'Exam pattern',
    /** Used as the H1 and in the title template. */
    heading: (name: string) => `${name} Exam Pattern`,
    blurb: 'Papers, questions, marks, time and the marking scheme, from the official bulletin.',
    path: ROUTES.examPattern,
  },
  syllabus: {
    label: 'Syllabus',
    heading: (name: string) => `${name} Syllabus`,
    blurb: 'Every unit in the official syllabus, subject by subject, with what each one covers.',
    path: ROUTES.examSyllabus,
  },
  'previous-year-papers': {
    label: 'Previous year papers',
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

export function isEditorialSection(section: ExamSection): section is EditorialSection {
  return (EDITORIAL_SECTIONS as readonly string[]).includes(section);
}

/** True when this exam actually has this section — the route's 404 test. */
export function hasSection(examSlug: string, section: ExamSection): boolean {
  return !isEditorialSection(section) || examContent(examSlug, section) !== undefined;
}

/** The sections to link to and to list in the sitemap for one exam. */
export function sectionsFor(examSlug: string): ExamSection[] {
  return EXAM_SECTION_SLUGS.filter((section) => hasSection(examSlug, section));
}

/** The event type each section reports on, where it has one. */
export const SECTION_EVENT: Partial<Record<ExamSection, string>> = {
  result: 'RESULT',
  'admit-card': 'ADMIT_CARD',
  'answer-key': 'ANSWER_KEY',
};
