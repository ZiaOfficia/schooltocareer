import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../../core/errors/app-error.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';

import { plainPreview } from './question.dto.js';
import type {
  ChapterPageRecord,
  QuestionDetailRecord,
  QuestionRowRecord,
} from './question.repository.js';
import { QuestionService, type QuestionRepositoryPort } from './question.service.js';

const paper = (slug: string, year: number) => ({ slug, title: `Paper ${slug}`, year, shift: null });

const row = (publicId: string, number: number, year = 2026): QuestionRowRecord => ({
  publicId,
  slug: `q-${publicId}`,
  number,
  type: 'MCQ_SINGLE',
  stem: `Question ${number} with $x^2$ maths`,
  questionPaper: paper(`p${year}`, year),
  answer: { provenance: 'OFFICIAL_FINAL' },
});

const detail = (publicId: string, overrides: Partial<QuestionDetailRecord> = {}): QuestionDetailRecord =>
  ({
    id: `id_${publicId}`,
    publicId,
    slug: 'percentage-error-in-volume',
    number: 3,
    type: 'MCQ_SINGLE',
    marksRight: 4,
    marksWrong: -1,
    stem: 'The error is:',
    stemHi: null,
    difficulty: null,
    updatedAt: new Date('2026-10-10T00:00:00Z'),
    questionPaper: { ...paper('jee-main-8-apr-2026-shift-2-btech', 2026), exam: { slug: 'jee-main', shortName: 'JEE Main' } },
    chapter: {
      id: 'ch_units',
      slug: 'units-and-measurements',
      name: 'Units and Measurements',
      syllabusStatus: 'IN_SYLLABUS',
      examSubject: { subject: { slug: 'physics', name: 'Physics' } },
    },
    options: [
      { label: 'A', body: '1', bodyHi: null, isCorrect: false },
      { label: 'B', body: '6', bodyHi: null, isCorrect: true },
    ],
    answer: {
      provenance: 'OFFICIAL_FINAL',
      answerKeySourceUrl: 'https://jeemain.nta.nic.in/',
      numericValue: null,
      numericTolerance: null,
      solution: 'Three times the diameter error.',
      solutionHi: null,
      reviewedAt: new Date('2026-10-10T00:00:00Z'),
    },
    ...overrides,
  }) as QuestionDetailRecord;

function service(port: Partial<QuestionRepositoryPort>) {
  const repository: QuestionRepositoryPort = {
    findPublicByPublicId: async () => null,
    listPublicInChapter: async () => [],
    findPublicChapter: async () => null,
    listPublicInPaper: async () => null,
    listPracticePapers: async () => [],
    listPracticeChapters: async () => [],
    findMockTestPaper: async () => null,
    ...port,
  };
  return new QuestionService({ repository, cache: new MemoryCacheProvider() });
}

describe('QuestionService.getPublic', () => {
  it('links the neighbours inside the chapter', async () => {
    const svc = service({
      findPublicByPublicId: async (id) => detail(id),
      listPublicInChapter: async () => [row('aaaaaaaaaa', 1), row('bbbbbbbbbb', 2), row('cccccccccc', 3)],
    });
    const dto = await svc.getPublic('bbbbbbbbbb');
    expect(dto.previous?.publicId).toBe('aaaaaaaaaa');
    expect(dto.next?.publicId).toBe('cccccccccc');
    expect(dto.path).toBe('/exam/jee-main/questions/percentage-error-in-volume-bbbbbbbbbb');
    expect(dto.chapter?.path).toBe('/exam/jee-main/chapters/physics/units-and-measurements');
  });

  it('has no previous at the start and no next at the end', async () => {
    const rows = [row('aaaaaaaaaa', 1), row('bbbbbbbbbb', 2)];
    const svc = service({ findPublicByPublicId: async (id) => detail(id), listPublicInChapter: async () => rows });
    expect((await svc.getPublic('aaaaaaaaaa')).previous).toBeNull();
    expect((await svc.getPublic('bbbbbbbbbb')).next).toBeNull();
  });

  it('is a 404 when the question is not public', async () => {
    await expect(service({}).getPublic('zzzzzzzzzz')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('is a 404 when the paper has no exam to live under', async () => {
    const orphan = detail('aaaaaaaaaa', {
      questionPaper: { ...paper('loose', 2026), exam: null },
    } as Partial<QuestionDetailRecord>);
    const svc = service({ findPublicByPublicId: async () => orphan });
    await expect(svc.getPublic('aaaaaaaaaa')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('serves the second read from cache', async () => {
    let calls = 0;
    const svc = service({
      findPublicByPublicId: async (id) => {
        calls += 1;
        return detail(id);
      },
    });
    await svc.getPublic('aaaaaaaaaa');
    await svc.getPublic('aaaaaaaaaa');
    expect(calls).toBe(1);
  });
});

describe('QuestionService.getChapter', () => {
  const chapter: ChapterPageRecord = {
    id: 'ch_units',
    slug: 'units-and-measurements',
    name: 'Units and Measurements',
    description: null,
    syllabusStatus: 'IN_SYLLABUS',
    syllabusSourceUrl: null,
    updatedAt: new Date('2026-10-10T00:00:00Z'),
    unit: null,
    examSubject: {
      subject: { slug: 'physics', name: 'Physics' },
      exam: { slug: 'jee-main', shortName: 'JEE Main' },
    },
    yearStats: [
      { year: 2026, questions: 2, subjectQuestions: 25, papersInYear: 1, weightagePct: 8, changePct: null },
    ],
  };

  it('lists the chapter questions with the year stats', async () => {
    const svc = service({
      findPublicChapter: async () => chapter,
      listPublicInChapter: async () => [row('aaaaaaaaaa', 1), row('bbbbbbbbbb', 2)],
    });
    const dto = await svc.getChapter('jee-main', 'physics', 'units-and-measurements');
    expect(dto.totalQuestions).toBe(2);
    expect(dto.stats[0]?.weightagePct).toBe(8);
    expect(dto.questions[0]?.provenance).toBe('OFFICIAL_FINAL');
  });

  it('is a 404 for an unpublished or unknown chapter', async () => {
    await expect(service({}).getChapter('jee-main', 'physics', 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('QuestionService.getPaperQuestions', () => {
  it('groups a paper by subject in paper order', async () => {
    const svc = service({
      listPublicInPaper: async () => ({
        examSlug: 'jee-main',
        paper: paper('jee-main-8-apr-2026-shift-2-btech', 2026),
        questions: [
          { ...row('aaaaaaaaaa', 1), subject: { slug: 'mathematics', name: 'Mathematics' } },
          { ...row('bbbbbbbbbb', 26), subject: { slug: 'physics', name: 'Physics' } },
          { ...row('cccccccccc', 2), subject: { slug: 'mathematics', name: 'Mathematics' } },
        ],
      }),
    });
    const dto = await svc.getPaperQuestions('jee-main-8-apr-2026-shift-2-btech');
    expect(dto.subjects.map((s) => s.subject.slug)).toEqual(['mathematics', 'physics']);
    expect(dto.subjects[0]?.questions.map((q) => q.number)).toEqual([1, 2]);
    expect(dto.paper.path).toBe('/previous-year-papers/jee-main-8-apr-2026-shift-2-btech');
  });
});

describe('plainPreview', () => {
  it('replaces maths with an ellipsis and drops markdown', () => {
    expect(plainPreview('Find **$\\frac{dy}{dx}$** if $y = x^2$.')).toBe('Find … if … .');
  });

  it('drops tables and images', () => {
    expect(plainPreview('Match the lists.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n![fig](a.png)')).toBe('Match the lists.');
  });

  it('cuts long text at a word boundary', () => {
    const out = plainPreview('word '.repeat(80));
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });

  it('never ends in a doubled ellipsis when the cut lands on maths', () => {
    const stem = `${'word '.repeat(28)}is a conic $C$, then the length of its latus rectum is equal to something long`;
    const out = plainPreview(stem);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/…\s*…$|……$/);
  });
});

const practicePaper = (slug: string, year: number, count: number, exam = { slug: 'jee-main', shortName: 'JEE Main', name: 'JEE Main' }) => ({
  ...paper(slug, year),
  exam,
  _count: { questions: count },
});

describe('QuestionService practice', () => {
  it('groups digitised papers by exam, newest first, and totals the questions', async () => {
    const svc = service({
      listPracticePapers: async () => [
        practicePaper('jee-main-8-apr-2026-shift-2-btech', 2026, 75),
        practicePaper('jee-main-2025-s1', 2025, 75),
      ],
    });
    const [jee] = await svc.listPractice();
    expect(jee!.exam.slug).toBe('jee-main');
    expect(jee!.totalQuestions).toBe(150);
    expect(jee!.practicePath).toBe('/exam/jee-main/questions');
    expect(jee!.mockTests.map((m) => m.path)).toEqual([
      '/exam/jee-main/mock-test/jee-main-8-apr-2026-shift-2-btech',
      '/exam/jee-main/mock-test/jee-main-2025-s1',
    ]);
  });

  it('builds the hub by subject in syllabus order, and 404s for an exam with nothing digitised', async () => {
    const chapter = (slug: string, subject: string, count: number) => ({
      slug,
      name: slug,
      unit: null,
      examSubject: { subject: { slug: subject, name: subject } },
      _count: { questions: count },
    });
    const svc = service({
      listPracticePapers: async () => [practicePaper('p1', 2026, 7)],
      listPracticeChapters: async () => [
        chapter('sets', 'mathematics', 1),
        chapter('vectors', 'mathematics', 2),
        chapter('optics', 'physics', 4),
      ],
    });
    const hub = await svc.getExamPractice('jee-main');
    expect(hub.subjects.map((s) => [s.subject.slug, s.questionCount, s.chapters.length])).toEqual([
      ['mathematics', 3, 2],
      ['physics', 4, 1],
    ]);
    expect(hub.subjects[1]!.chapters[0]!.path).toBe('/exam/jee-main/chapters/physics/optics');
    await expect(svc.getExamPractice('neet')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('turns a paper into sections with answers, and 404s when it has no questions', async () => {
    const q = (n: number, subject: string, extra: Record<string, unknown> = {}) => ({
      publicId: `q${String(n).padStart(9, '0')}`,
      slug: `q-${n}`,
      number: n,
      type: 'MCQ_SINGLE' as const,
      marksRight: 4,
      marksWrong: -1,
      stem: `Question ${n}`,
      subject: { slug: subject, name: subject },
      options: [
        { label: 'A', body: 'a', isCorrect: false },
        { label: 'B', body: 'b', isCorrect: true },
      ],
      answer: { provenance: 'OFFICIAL_FINAL' as const, numericValue: null, numericTolerance: null },
      ...extra,
    });
    const svc = service({
      findMockTestPaper: async (slug) =>
        slug === 'empty'
          ? { ...paper('empty', 2026), durationMin: 180, exam: { slug: 'jee-main', shortName: 'JEE Main' }, questions: [] }
          : {
              ...paper(slug, 2026),
              durationMin: 180,
              exam: { slug: 'jee-main', shortName: 'JEE Main' },
              questions: [
                q(1, 'mathematics'),
                q(2, 'physics', { answer: { provenance: 'DROPPED', numericValue: null, numericTolerance: null } }),
              ] as never,
            },
    });
    const test = await svc.getMockTest('p1');
    expect(test.totalMarks).toBe(8);
    expect(test.durationMin).toBe(180);
    expect(test.sections.map((s) => s.subject.slug)).toEqual(['mathematics', 'physics']);
    expect(test.sections[0]!.questions[0]!.correct).toEqual(['B']);
    expect(test.sections[0]!.questions[0]!.options[0]).toEqual({ label: 'A', body: 'a' });
    expect(test.sections[1]!.questions[0]!.dropped).toBe(true);
    await expect(svc.getMockTest('empty')).rejects.toBeInstanceOf(NotFoundError);
  });
});
