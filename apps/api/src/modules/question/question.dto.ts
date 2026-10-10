import { ROUTES } from '@stc/constants';
import type {
  ExamPracticeDto,
  MockQuestionDto,
  MockTestDto,
  MockTestRefDto,
  PracticeExamDto,
  ChapterPageDto,
  ChapterQuestionRowDto,
  ChapterRefDto,
  QuestionDetailDto,
  QuestionLinkDto,
  QuestionPaperRefDto,
} from '@stc/types';

import type {
  ChapterPageRecord,
  MockQuestionRecord,
  MockTestPaperRecord,
  PracticeChapterRecord,
  PracticePaperRecord,
  QuestionDetailRecord,
  QuestionRowRecord,
} from './question.repository.js';

/** Longest preview shown in a list row, in characters. */
const PREVIEW_MAX = 160;

/**
 * The stem's opening as plain text, for list rows and link titles.
 *
 * Maths is replaced by an ellipsis rather than shown as LaTeX source: a row
 * reading "Find \frac{dy}{dx} if…" is worse than "Find … if…", and the row
 * links to the rendered question anyway. Markdown markers are dropped.
 */
export function plainPreview(markdown: string): string {
  const text = markdown
    .replace(/\$\$[\s\S]*?\$\$/g, ' … ')
    .replace(/\$[^$\n]+\$/g, ' … ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*…\s*)+/g, ' … ')
    .trim();
  if (text.length <= PREVIEW_MAX) return text;
  const cut = text.slice(0, PREVIEW_MAX);
  // Strip a trailing maths ellipsis or comma first, so the cut never reads "… …".
  const head = cut.slice(0, Math.max(cut.lastIndexOf(' '), PREVIEW_MAX - 20)).replace(/[\s…,;:]+$/, '');
  return `${head}…`;
}

function paperRef(paper: {
  slug: string;
  title: string;
  year: number;
  shift: string | null;
}): QuestionPaperRefDto {
  return {
    slug: paper.slug,
    title: paper.title,
    year: paper.year,
    shift: paper.shift,
    path: ROUTES.paper(paper.slug),
  };
}

export function toQuestionLink(exam: string, row: QuestionRowRecord): QuestionLinkDto {
  return {
    publicId: row.publicId,
    path: ROUTES.examQuestion(exam, row.slug, row.publicId),
    number: row.number,
    preview: plainPreview(row.stem),
    type: row.type,
  };
}

export function toChapterQuestionRow(exam: string, row: QuestionRowRecord): ChapterQuestionRowDto {
  return {
    ...toQuestionLink(exam, row),
    paper: paperRef(row.questionPaper),
    // The repository only returns questions WITH an answer (publicQuestion()).
    provenance: row.answer!.provenance,
  };
}

function chapterRef(
  exam: string,
  chapter: {
    slug: string;
    name: string;
    syllabusStatus: ChapterRefDto['syllabusStatus'];
    examSubject: { subject: { slug: string; name: string } };
  },
): ChapterRefDto {
  const subject = chapter.examSubject.subject;
  return {
    slug: chapter.slug,
    name: chapter.name,
    subject: { slug: subject.slug, name: subject.name },
    syllabusStatus: chapter.syllabusStatus,
    path: ROUTES.examChapter(exam, subject.slug, chapter.slug),
  };
}

export function toQuestionDetail(
  record: QuestionDetailRecord,
  neighbours: { previous: QuestionLinkDto | null; next: QuestionLinkDto | null },
): QuestionDetailDto {
  const exam = record.questionPaper.exam;
  // The service refuses a question whose paper has no exam before mapping,
  // and publicQuestion() only returns questions that have an answer.
  const examSlug = exam!.slug;
  const answer = record.answer!;
  return {
    publicId: record.publicId,
    slug: record.slug,
    path: ROUTES.examQuestion(examSlug, record.slug, record.publicId),
    number: record.number,
    preview: plainPreview(record.stem),
    type: record.type,
    marksRight: record.marksRight,
    marksWrong: record.marksWrong,
    stem: record.stem,
    stemHi: record.stemHi,
    difficulty: record.difficulty,
    exam: { slug: examSlug, shortName: exam!.shortName, path: ROUTES.exam(examSlug) },
    paper: paperRef(record.questionPaper),
    chapter: record.chapter ? chapterRef(examSlug, record.chapter) : null,
    options: record.options.map((option) => ({ ...option })),
    answer: {
      provenance: answer.provenance,
      answerKeySourceUrl: answer.answerKeySourceUrl,
      numericValue: answer.numericValue?.toString() ?? null,
      numericTolerance: answer.numericTolerance?.toString() ?? null,
      solution: answer.solution ?? '',
      solutionHi: answer.solutionHi,
      reviewedAt: answer.reviewedAt?.toISOString() ?? null,
    },
    previous: neighbours.previous,
    next: neighbours.next,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toChapterPage(
  record: ChapterPageRecord,
  rows: QuestionRowRecord[],
): ChapterPageDto {
  const exam = record.examSubject.exam;
  return {
    ...chapterRef(exam.slug, record),
    description: record.description,
    exam: { slug: exam.slug, shortName: exam.shortName, path: ROUTES.exam(exam.slug) },
    unit: record.unit,
    syllabusSourceUrl: record.syllabusSourceUrl,
    stats: record.yearStats.map((stat) => ({ ...stat })),
    totalQuestions: rows.length,
    questions: rows.map((row) => toChapterQuestionRow(exam.slug, row)),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ── Practice and mock tests ────────────────────────────────────────────────

/** Groups digitised papers by exam, keeping the repository's newest-first order. */
export function toPracticeExams(papers: PracticePaperRecord[]): PracticeExamDto[] {
  const byExam = new Map<string, PracticeExamDto>();
  for (const paper of papers) {
    if (!paper.exam) continue;
    const { slug, shortName, name } = paper.exam;
    const entry =
      byExam.get(slug) ??
      ({
        exam: { slug, shortName, name, path: ROUTES.exam(slug) },
        practicePath: ROUTES.examPractice(slug),
        totalQuestions: 0,
        mockTests: [],
      } satisfies PracticeExamDto);
    const mock: MockTestRefDto = {
      paper: paperRef(paper),
      questionCount: paper._count.questions,
      path: ROUTES.mockTest(slug, paper.slug),
    };
    entry.mockTests.push(mock);
    entry.totalQuestions += mock.questionCount;
    byExam.set(slug, entry);
  }
  return [...byExam.values()];
}

export function toExamPractice(practice: PracticeExamDto, chapters: PracticeChapterRecord[]): ExamPracticeDto {
  const exam = practice.exam.slug;
  const subjects = new Map<string, ExamPracticeDto['subjects'][number]>();
  for (const chapter of chapters) {
    const subject = chapter.examSubject.subject;
    const group = subjects.get(subject.slug) ?? { subject: { ...subject }, questionCount: 0, chapters: [] };
    group.chapters.push({
      slug: chapter.slug,
      name: chapter.name,
      path: ROUTES.examChapter(exam, subject.slug, chapter.slug),
      questionCount: chapter._count.questions,
      unit: chapter.unit,
    });
    group.questionCount += chapter._count.questions;
    subjects.set(subject.slug, group);
  }
  return { ...practice, subjects: [...subjects.values()] };
}

function toMockQuestion(exam: string, row: MockQuestionRecord): MockQuestionDto {
  // publicQuestion() guarantees the answer row.
  const answer = row.answer!;
  return {
    publicId: row.publicId,
    path: ROUTES.examQuestion(exam, row.slug, row.publicId),
    number: row.number,
    type: row.type,
    marksRight: row.marksRight,
    marksWrong: row.marksWrong,
    stem: row.stem,
    options: row.options.map(({ label, body }) => ({ label, body })),
    correct: row.options.filter((option) => option.isCorrect).map((option) => option.label),
    numericValue: answer.numericValue?.toString() ?? null,
    numericTolerance: answer.numericTolerance?.toString() ?? null,
    dropped: answer.provenance === 'DROPPED',
  };
}

export function toMockTest(record: MockTestPaperRecord): MockTestDto {
  // The service refuses a paper without an exam before mapping.
  const exam = record.exam!;
  const sections = new Map<string, MockTestDto['sections'][number]>();
  for (const row of record.questions) {
    const subject = row.subject ?? { slug: 'other', name: 'Other' };
    const section = sections.get(subject.slug) ?? { subject: { ...subject }, questions: [] };
    section.questions.push(toMockQuestion(exam.slug, row));
    sections.set(subject.slug, section);
  }
  return {
    exam: { slug: exam.slug, shortName: exam.shortName, path: ROUTES.exam(exam.slug) },
    paper: paperRef(record),
    durationMin: record.durationMin,
    totalMarks: record.questions.reduce((sum, row) => sum + row.marksRight, 0),
    sections: [...sections.values()],
  };
}
