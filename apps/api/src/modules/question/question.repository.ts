import { type Prisma, type PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';

/**
 * Question bank reads. Public and read-only: questions arrive through the
 * reviewed import (tooling/scripts/import-questions.ts), never through the API.
 *
 * "Public" means the whole chain is live: the question PUBLISHED and not
 * deleted, its paper PUBLISHED, its chapter PUBLISHED, and an answer row
 * present. A question that slips through any one of those is not shown — a
 * half-published question is worse than a missing one (PRINCIPLES.md #2).
 */

const PAPER_REF = {
  slug: true,
  title: true,
  year: true,
  shift: true,
} satisfies Prisma.QuestionPaperSelect;

const CHAPTER_REF = {
  id: true,
  slug: true,
  name: true,
  syllabusStatus: true,
  examSubject: { select: { subject: { select: { slug: true, name: true } } } },
} satisfies Prisma.ExamChapterSelect;

const QUESTION_DETAIL = {
  id: true,
  publicId: true,
  slug: true,
  number: true,
  type: true,
  marksRight: true,
  marksWrong: true,
  stem: true,
  stemHi: true,
  difficulty: true,
  updatedAt: true,
  questionPaper: {
    select: { ...PAPER_REF, exam: { select: { slug: true, shortName: true } } },
  },
  chapter: { select: CHAPTER_REF },
  options: {
    select: { label: true, body: true, bodyHi: true, isCorrect: true },
    orderBy: { order: 'asc' },
  },
  answer: {
    select: {
      provenance: true,
      answerKeySourceUrl: true,
      numericValue: true,
      numericTolerance: true,
      solution: true,
      solutionHi: true,
      reviewedAt: true,
    },
  },
} satisfies Prisma.QuestionSelect;

const QUESTION_ROW = {
  publicId: true,
  slug: true,
  number: true,
  type: true,
  stem: true,
  questionPaper: { select: PAPER_REF },
  answer: { select: { provenance: true } },
} satisfies Prisma.QuestionSelect;

export type QuestionDetailRecord = Prisma.QuestionGetPayload<{ select: typeof QUESTION_DETAIL }>;
export type QuestionRowRecord = Prisma.QuestionGetPayload<{ select: typeof QUESTION_ROW }>;

const CHAPTER_PAGE = {
  id: true,
  slug: true,
  name: true,
  description: true,
  syllabusStatus: true,
  syllabusSourceUrl: true,
  updatedAt: true,
  unit: { select: { slug: true, name: true } },
  examSubject: {
    select: {
      subject: { select: { slug: true, name: true } },
      exam: { select: { slug: true, shortName: true } },
    },
  },
  yearStats: {
    select: {
      year: true,
      questions: true,
      subjectQuestions: true,
      papersInYear: true,
      weightagePct: true,
      changePct: true,
    },
    orderBy: { year: 'desc' },
  },
} satisfies Prisma.ExamChapterSelect;

export type ChapterPageRecord = Prisma.ExamChapterGetPayload<{ select: typeof CHAPTER_PAGE }>;

/** The most rows a chapter page lists. JEE Main's busiest chapter is ~400. */
export const CHAPTER_QUESTION_LIMIT = 600;

/** Where-clause for "a reader may see this question". */
function publicQuestion(): Prisma.QuestionWhereInput {
  return {
    status: 'PUBLISHED',
    deletedAt: null,
    answer: { isNot: null },
    questionPaper: { status: 'PUBLISHED', deletedAt: null },
    chapter: { status: 'PUBLISHED', deletedAt: null },
  };
}

/**
 * Chapter order for questions: newest paper first, then the paper's own
 * order. Year is the only paper date the schema holds, so shifts within a
 * year fall back to the paper slug, which is stable.
 */
const CHAPTER_ORDER: Prisma.QuestionOrderByWithRelationInput[] = [
  { questionPaper: { year: 'desc' } },
  { questionPaper: { slug: 'asc' } },
  { number: 'asc' },
];

export class QuestionRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findPublicByPublicId(publicId: string): Promise<QuestionDetailRecord | null> {
    return this.run(
      () =>
        this.prisma.question.findFirst({
          where: { publicId, ...publicQuestion() },
          select: QUESTION_DETAIL,
        }),
      { resource: 'Question', identifier: publicId },
    );
  }

  /** Every public question in a chapter, in chapter order. Rows only. */
  async listPublicInChapter(chapterId: string): Promise<QuestionRowRecord[]> {
    return this.run(
      () =>
        this.prisma.question.findMany({
          where: { examChapterId: chapterId, ...publicQuestion() },
          select: QUESTION_ROW,
          orderBy: CHAPTER_ORDER,
          take: CHAPTER_QUESTION_LIMIT,
        }),
      { resource: 'Question', identifier: chapterId },
    );
  }

  async findPublicChapter(
    exam: string,
    subject: string,
    chapter: string,
  ): Promise<ChapterPageRecord | null> {
    return this.run(
      () =>
        this.prisma.examChapter.findFirst({
          where: {
            slug: chapter,
            status: 'PUBLISHED',
            deletedAt: null,
            examSubject: {
              exam: { slug: exam, status: 'PUBLISHED', deletedAt: null },
              subject: { slug: subject, deletedAt: null },
            },
          },
          select: CHAPTER_PAGE,
        }),
      { resource: 'ExamChapter', identifier: `${exam}/${subject}/${chapter}` },
    );
  }

  /** A published paper's public questions, in paper order, with their subject. */
  async listPublicInPaper(paperSlug: string): Promise<{
    examSlug: string;
    paper: { slug: string; title: string; year: number; shift: string | null };
    questions: Array<QuestionRowRecord & { subject: { slug: string; name: string } | null }>;
  } | null> {
    return this.run(
      async () => {
        const paper = await this.prisma.questionPaper.findFirst({
          where: { slug: paperSlug, status: 'PUBLISHED', deletedAt: null },
          select: { id: true, ...PAPER_REF, exam: { select: { slug: true } } },
        });
        // Questions live under /exam/<exam>/…, so a paper with no exam has none to show.
        if (!paper?.exam) return null;
        const questions = await this.prisma.question.findMany({
          where: { questionPaperId: paper.id, ...publicQuestion() },
          select: { ...QUESTION_ROW, subject: { select: { slug: true, name: true } } },
          orderBy: { number: 'asc' },
        });
        const { id: _id, exam, ...ref } = paper;
        return { examSlug: exam.slug, paper: ref, questions };
      },
      { resource: 'QuestionPaper', identifier: paperSlug },
    );
  }
}
