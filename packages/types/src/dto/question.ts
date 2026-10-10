import type {
  AnswerProvenance,
  QuestionDifficulty,
  QuestionType,
  SyllabusStatus,
} from '../enums.js';

/**
 * THE PUBLIC SHAPE OF THE QUESTION BANK — what the question page and the
 * chapter page read. Hoisted here on the commit that added those pages.
 *
 * Text fields (`stem`, `body`, `solution`) are Markdown with $…$ / $$…$$
 * LaTeX, exactly as stored. Rendering is the web app's job, done on the
 * server, so the API stays a data API and both languages render the same way.
 */

/** A link to another question: enough for a list row or a prev/next control. */
export type QuestionLinkDto = {
  publicId: string;
  path: string;
  number: number;
  /** The stem's first line as plain text, for a list row. */
  preview: string;
  type: QuestionType;
};

export type QuestionOptionDto = {
  label: string;
  body: string;
  bodyHi: string | null;
  isCorrect: boolean;
};

export type QuestionAnswerDto = {
  provenance: AnswerProvenance;
  /** The official key this answer was checked against. Null for EDITORIAL. */
  answerKeySourceUrl: string | null;
  /** For NUMERICAL questions; a string so no precision is lost in JSON. */
  numericValue: string | null;
  numericTolerance: string | null;
  solution: string;
  solutionHi: string | null;
  reviewedAt: string | null;
};

export type QuestionPaperRefDto = {
  slug: string;
  title: string;
  year: number;
  shift: string | null;
  path: string;
};

export type ChapterRefDto = {
  slug: string;
  name: string;
  subject: { slug: string; name: string };
  syllabusStatus: SyllabusStatus;
  path: string;
};

export type QuestionDetailDto = {
  publicId: string;
  slug: string;
  path: string;
  number: number;
  /** The stem's opening as plain text: titles, descriptions, link labels. */
  preview: string;
  type: QuestionType;
  marksRight: number;
  marksWrong: number;
  stem: string;
  stemHi: string | null;
  difficulty: QuestionDifficulty | null;
  exam: { slug: string; shortName: string; path: string };
  paper: QuestionPaperRefDto;
  /** Null while a question is untagged; published questions always have one. */
  chapter: ChapterRefDto | null;
  options: QuestionOptionDto[];
  answer: QuestionAnswerDto;
  /** Neighbours within the same chapter, newest paper first. */
  previous: QuestionLinkDto | null;
  next: QuestionLinkDto | null;
  updatedAt: string;
};

/** One year of a chapter's record, raw counts included so it can be checked. */
export type ChapterYearStatDto = {
  year: number;
  questions: number;
  subjectQuestions: number;
  papersInYear: number;
  weightagePct: number;
  changePct: number | null;
};

export type ChapterQuestionRowDto = QuestionLinkDto & {
  paper: QuestionPaperRefDto;
  provenance: AnswerProvenance;
};

export type ChapterPageDto = ChapterRefDto & {
  description: string | null;
  exam: { slug: string; shortName: string; path: string };
  unit: { slug: string; name: string } | null;
  syllabusSourceUrl: string | null;
  /** Newest year first. */
  stats: ChapterYearStatDto[];
  totalQuestions: number;
  questions: ChapterQuestionRowDto[];
  updatedAt: string;
};

/** A paper's questions in paper order, grouped by the subject they test. */
export type PaperQuestionsDto = {
  paper: QuestionPaperRefDto;
  subjects: Array<{
    subject: { slug: string; name: string };
    questions: QuestionLinkDto[];
  }>;
};

// ── Practice and mock tests ────────────────────────────────────────────────

/** A digitised paper offered as a timed test. */
export type MockTestRefDto = {
  paper: QuestionPaperRefDto;
  questionCount: number;
  path: string;
};

/** One exam's practice material, for the homepage, the menu and /mock-tests. */
export type PracticeExamDto = {
  exam: { slug: string; shortName: string; name: string; path: string };
  /** The chapter-wise hub, /exam/<exam>/questions. */
  practicePath: string;
  totalQuestions: number;
  /** Newest paper first. */
  mockTests: MockTestRefDto[];
};

export type PracticeChapterDto = {
  slug: string;
  name: string;
  path: string;
  questionCount: number;
  unit: { slug: string; name: string } | null;
};

/** The chapter-wise hub of one exam. */
export type ExamPracticeDto = PracticeExamDto & {
  subjects: Array<{
    subject: { slug: string; name: string };
    questionCount: number;
    /** Syllabus order. Only chapters with at least one published question. */
    chapters: PracticeChapterDto[];
  }>;
};

/**
 * One question as a test needs it: the answer travels with it, because the
 * test is scored in the browser. Nothing here is secret: every answer is
 * already public on the question's own page.
 */
export type MockQuestionDto = {
  publicId: string;
  path: string;
  number: number;
  type: QuestionType;
  marksRight: number;
  marksWrong: number;
  stem: string;
  options: Array<{ label: string; body: string }>;
  correct: string[];
  numericValue: string | null;
  numericTolerance: string | null;
  /** Dropped by the conducting body: every candidate gets the marks. */
  dropped: boolean;
};

export type MockTestDto = {
  exam: { slug: string; shortName: string; path: string };
  paper: QuestionPaperRefDto;
  /** From the paper record; null when it does not say, and the test then runs untimed. */
  durationMin: number | null;
  totalMarks: number;
  sections: Array<{
    subject: { slug: string; name: string };
    questions: MockQuestionDto[];
  }>;
};
