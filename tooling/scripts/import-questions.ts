#!/usr/bin/env tsx
/**
 * Loads one reviewed question file (tooling/scripts/data/questions/<paper>.json)
 * into the question bank: Question, QuestionOption, QuestionAnswer.
 *
 *   pnpm questions:import <file>                         load as DRAFT
 *   pnpm questions:import <file> --check                 validate the file only; no database
 *   pnpm questions:import <file> --dry-run               validate against the database; write nothing
 *   pnpm questions:import <file> --publish --reviewer <email>
 *                                                        load, publish, and record who reviewed
 *
 * WHAT A FILE IS. One paper, transcribed from the official paper and checked
 * against the official final key (docs/QUESTION-BANK.md). The file is the
 * reviewed source of truth; the database is loaded from it. Edits go into the
 * file and are re-imported, so the history of every correction is in git.
 *
 * RULES IT ENFORCES (Principles 2, 3 and 6):
 *  - Every question has a chapter from the exam's syllabus, a solution, and
 *    an answer: at least one correct option, or a numeric value.
 *  - An OFFICIAL answer must point at the official key. With no URL in the
 *    file, the paper's current ANSWER_KEY file is used; with neither, it stops.
 *  - It never creates the exam, the paper or a chapter. They must exist.
 *  - Publishing needs a named reviewer who exists as a user. Without
 *    --publish, everything stays DRAFT and nothing reaches the site.
 *  - It never deletes a question. Numbers in the database but not in the file
 *    are reported for a person to look at.
 *
 * IDEMPOTENT. Questions are matched on (paper, number); a re-run keeps each
 * question's publicId, so its URL never changes. The slug follows the stem;
 * the question page redirects an old slug to the new one.
 *
 * AFTER WRITING it recomputes ExamChapterYearStat for the exam and queues a
 * CACHE_REVALIDATE outbox event, the same mechanism every publish uses, so
 * the question, chapter and paper pages refresh within seconds. (The API's own
 * read cache for these entities expires on its TTL.)
 */
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Subpaths, not the barrels: this file is ESM and these packages are CommonJS
// (see the notes in their package.json).
import { CACHE_TAGS } from '@stc/constants/cache-tags';
import { EXAM_SYLLABI, chaptersOf } from '@stc/constants/exam-syllabi';
import { slugify } from '@stc/utils/slug';
import { Prisma, PrismaClient } from '@prisma/client';

// ── Arguments ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--reviewer');
const checkOnly = args.includes('--check');
const dryRun = args.includes('--dry-run');
const publish = args.includes('--publish');
const reviewerEmail = args.includes('--reviewer') ? args[args.indexOf('--reviewer') + 1] : undefined;

if (!file) {
  console.error('Usage: pnpm questions:import <file.json> [--check | --dry-run] [--publish --reviewer <email>]');
  process.exit(2);
}
if (publish && !reviewerEmail) {
  console.error('--publish needs --reviewer <email>: a person must have checked the answers and solutions.');
  process.exit(2);
}

// ── The file format ──────────────────────────────────────────────────────────

const PROVENANCES = ['OFFICIAL_FINAL', 'OFFICIAL_PROVISIONAL', 'EDITORIAL', 'DROPPED'] as const;
type Provenance = (typeof PROVENANCES)[number];
const TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'NUMERICAL'] as const;
type QType = (typeof TYPES)[number];

type FileOption = { label: string; body: string; bodyHi?: string };
type FileQuestion = {
  number: number;
  subject: string;
  chapter: string;
  type: QType;
  stem: string;
  stemHi?: string;
  options: FileOption[];
  correct?: string[];
  numericValue?: string;
  numericTolerance?: string;
  provenance?: Provenance;
  solution: string;
  solutionHi?: string;
};
type QuestionFile = {
  version: 1;
  examSlug: string;
  paperSlug: string;
  marks: { right: number; wrong: number };
  provenance: Provenance;
  answerKeySourceUrl?: string | null;
  questions: FileQuestion[];
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const NUMBER = /^-?\d+(\.\d+)?$/;

/** Every problem in the file, as readable lines. Empty means it is loadable. */
function fileProblems(raw: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(raw)) return ['file is not a JSON object'];
  if (raw['version'] !== 1) problems.push('version must be 1');
  for (const key of ['examSlug', 'paperSlug'] as const) if (!isText(raw[key])) problems.push(`${key} is missing`);
  const marks = raw['marks'];
  if (!isRecord(marks) || typeof marks['right'] !== 'number' || typeof marks['wrong'] !== 'number') {
    problems.push('marks must be { right: number, wrong: number }');
  } else if (!(marks['right'] > 0 && marks['wrong'] <= 0)) {
    problems.push('marks.right must be positive and marks.wrong zero or negative');
  }
  if (!PROVENANCES.includes(raw['provenance'] as Provenance)) problems.push('provenance is not a known value');
  const url = raw['answerKeySourceUrl'];
  if (url !== undefined && url !== null && !(isText(url) && /^https:\/\//.test(url))) {
    problems.push('answerKeySourceUrl must be an https URL or null');
  }

  const syllabus = EXAM_SYLLABI.find((s) => s.examSlug === raw['examSlug']);
  if (!syllabus) problems.push(`no syllabus for exam "${String(raw['examSlug'])}" in exam-syllabi.ts`);
  const chapterSlugs = new Map(
    (syllabus?.subjects ?? []).map((s) => [s.subjectSlug, new Set(chaptersOf(s).map((c) => c.slug))]),
  );

  const questions = raw['questions'];
  if (!Array.isArray(questions) || questions.length === 0) return [...problems, 'questions must be a non-empty array'];

  const seen = new Set<number>();
  for (const [index, q] of questions.entries()) {
    const at = `question ${isRecord(q) && typeof q['number'] === 'number' ? q['number'] : `#${index + 1}`}`;
    if (!isRecord(q)) {
      problems.push(`${at}: not an object`);
      continue;
    }
    const n = q['number'];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) problems.push(`${at}: number must be a positive integer`);
    else if (seen.has(n)) problems.push(`${at}: number used twice`);
    else seen.add(n);

    const subject = q['subject'];
    const chapters = typeof subject === 'string' ? chapterSlugs.get(subject) : undefined;
    if (!chapters) problems.push(`${at}: subject "${String(subject)}" is not in the ${String(raw['examSlug'])} syllabus`);
    else if (!chapters.has(q['chapter'] as string)) problems.push(`${at}: chapter "${String(q['chapter'])}" is not a ${String(subject)} chapter`);

    const type = q['type'] as QType;
    if (!TYPES.includes(type)) problems.push(`${at}: type "${String(type)}" is not known`);
    if (!isText(q['stem'])) problems.push(`${at}: stem is empty`);
    if (!isText(q['solution'])) problems.push(`${at}: solution is empty — every published answer is explained`);
    const provenance = (q['provenance'] ?? raw['provenance']) as Provenance;
    if (!PROVENANCES.includes(provenance)) problems.push(`${at}: provenance is not a known value`);

    const options = Array.isArray(q['options']) ? q['options'] : null;
    if (!options) {
      problems.push(`${at}: options must be an array (empty for a numerical)`);
      continue;
    }
    const labels = options.map((o) => (isRecord(o) ? o['label'] : undefined));
    if (options.some((o) => !isRecord(o) || !isText(o['label']) || !isText(o['body']))) {
      problems.push(`${at}: every option needs a label and a body`);
    }
    if (new Set(labels).size !== labels.length) problems.push(`${at}: option labels repeat`);

    const correct = q['correct'];
    if (type === 'NUMERICAL') {
      if (options.length > 0) problems.push(`${at}: a numerical question has no options`);
      if (provenance !== 'DROPPED' && !(typeof q['numericValue'] === 'string' && NUMBER.test(q['numericValue']))) {
        problems.push(`${at}: numericValue must be a number written as a string, e.g. "2" or "0.25"`);
      }
      const tolerance = q['numericTolerance'];
      if (tolerance !== undefined && !(typeof tolerance === 'string' && NUMBER.test(tolerance) && Number(tolerance) >= 0)) {
        problems.push(`${at}: numericTolerance must be a non-negative number as a string`);
      }
    } else if (TYPES.includes(type)) {
      if (options.length < 2) problems.push(`${at}: needs at least two options`);
      if (provenance !== 'DROPPED') {
        if (!Array.isArray(correct) || correct.length === 0) problems.push(`${at}: correct must list at least one label`);
        else for (const label of correct) if (!labels.includes(label)) problems.push(`${at}: correct label "${String(label)}" is not an option`);
      }
    }
  }
  return problems;
}

// ── Slugs and ids ────────────────────────────────────────────────────────────

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
/** 10 characters from [a-z0-9], as QUESTION_PUBLIC_ID_LENGTH requires. */
const newPublicId = () => Array.from({ length: 10 }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join('');

/** The stem's words, maths and markup removed, for the human half of the URL. */
function slugFromStem(stem: string): string {
  const words = stem
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s*\|.*$/gm, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12)
    .join(' ');
  return slugify(words).split('-').slice(0, 8).join('-') || 'question';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const filePath = path.resolve(process.cwd(), file!);
  const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  const problems = fileProblems(raw);
  if (problems.length > 0) {
    console.error(`${path.basename(filePath)} has ${problems.length} problem(s); nothing was written.\n`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  const data = raw as QuestionFile;
  const counts = data.questions.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.subject]: (acc[q.subject] ?? 0) + 1 }), {});
  console.log(`${data.paperSlug}: ${data.questions.length} questions (${Object.entries(counts).map(([s, n]) => `${s} ${n}`).join(', ')}) — file is valid`);
  if (checkOnly) return;

  const prisma = new PrismaClient();
  try {
    await load(prisma, data);
  } finally {
    // A failing disconnect must not replace the error that explains the run.
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function load(prisma: PrismaClient, data: QuestionFile): Promise<void> {
  // 1. Everything the file refers to must already exist.
  const exam = await prisma.exam.findUnique({ where: { slug: data.examSlug }, select: { id: true } });
  if (!exam) throw new Error(`No exam "${data.examSlug}". This script does not create exams.`);

  const paper = await prisma.questionPaper.findUnique({
    where: { slug: data.paperSlug },
    select: {
      id: true,
      examId: true,
      year: true,
      status: true,
      deletedAt: true,
      files: {
        where: { fileRole: 'ANSWER_KEY', isCurrent: true },
        orderBy: { version: 'desc' },
        take: 1,
        select: { media: { select: { secureUrl: true } } },
      },
    },
  });
  if (!paper || paper.deletedAt) throw new Error(`No paper "${data.paperSlug}". Import the paper first.`);
  if (paper.examId !== exam.id) throw new Error(`Paper "${data.paperSlug}" belongs to a different exam.`);
  if (paper.status !== 'PUBLISHED') {
    console.warn(`  NOTE: the paper is ${paper.status}. Its questions will not show on the site until it is published.`);
  }

  const keyUrl = data.answerKeySourceUrl ?? paper.files[0]?.media.secureUrl ?? null;
  const needsKey = data.questions.some((q) => (q.provenance ?? data.provenance).startsWith('OFFICIAL'));
  if (needsKey && !keyUrl) {
    throw new Error('Answers are marked OFFICIAL but there is no answer key: set answerKeySourceUrl or attach the ANSWER_KEY file to the paper.');
  }

  const subjects = await prisma.subject.findMany({
    where: { slug: { in: [...new Set(data.questions.map((q) => q.subject))] } },
    select: { id: true, slug: true },
  });
  const subjectId = new Map(subjects.map((s) => [s.slug, s.id]));
  const chapters = await prisma.examChapter.findMany({
    where: { examId: exam.id, deletedAt: null },
    select: { id: true, slug: true, subjectId: true, status: true },
  });
  const chapterId = new Map(chapters.map((c) => [`${c.subjectId}/${c.slug}`, c.id]));

  const missing: string[] = [];
  for (const q of data.questions) {
    const sid = subjectId.get(q.subject);
    if (!sid) missing.push(`subject ${q.subject}`);
    else if (!chapterId.has(`${sid}/${q.chapter}`)) missing.push(`chapter ${q.subject}/${q.chapter}`);
  }
  if (missing.length > 0) {
    throw new Error(`Missing in the database (run pnpm syllabus:seed): ${[...new Set(missing)].join(', ')}`);
  }

  const reviewer = reviewerEmail
    ? await prisma.user.findUnique({ where: { email: reviewerEmail }, select: { id: true } })
    : null;
  if (reviewerEmail && !reviewer) throw new Error(`No user with email ${reviewerEmail}.`);

  // 2. What changes.
  const existing = await prisma.question.findMany({
    where: { questionPaperId: paper.id },
    select: { id: true, number: true, publicId: true, slug: true, status: true },
  });
  const byNumber = new Map(existing.map((q) => [q.number, q]));
  const fileNumbers = new Set(data.questions.map((q) => q.number));
  for (const q of existing) {
    if (!fileNumbers.has(q.number)) console.warn(`  NOT IN FILE  question ${q.number} (${q.publicId}, ${q.status}) — review by hand`);
  }
  // A live question changes only with a named reviewer: without --publish an
  // edit would reach the site unreviewed.
  const live = existing.filter((q) => q.status === 'PUBLISHED' && fileNumbers.has(q.number));
  if (live.length > 0 && !publish) {
    throw new Error(
      `${live.length} of these questions are already published. Re-import with --publish --reviewer <email> to change them.`,
    );
  }
  const creating = data.questions.filter((q) => !byNumber.has(q.number)).length;
  console.log(`  ${creating} to create, ${data.questions.length - creating} to update${publish ? ', all to be published' : ' (DRAFT)'}`);
  if (dryRun) {
    console.log('\n--dry-run: nothing was written.');
    return;
  }

  // 3. Write, one transaction per question so a failure names its question
  //    and leaves the others intact; re-running converges.
  const now = new Date();
  const touched: Array<{ publicId: string; chapterId: string }> = [];
  for (const q of data.questions) {
    const sid = subjectId.get(q.subject)!;
    const cid = chapterId.get(`${sid}/${q.chapter}`)!;
    const provenance = q.provenance ?? data.provenance;
    const prior = byNumber.get(q.number);
    const publicId = prior?.publicId ?? newPublicId();
    const fields = {
      slug: slugFromStem(q.stem),
      subjectId: sid,
      examChapterId: cid,
      type: q.type,
      marksRight: data.marks.right,
      marksWrong: data.marks.wrong,
      stem: q.stem,
      stemHi: q.stemHi ?? null,
      ...(publish ? { status: 'PUBLISHED' as const, publishedAt: now, deletedAt: null } : {}),
    };
    const correct = new Set(q.correct ?? []);
    const answer = {
      provenance,
      answerKeySourceUrl: provenance.startsWith('OFFICIAL') ? keyUrl : null,
      numericValue: q.type === 'NUMERICAL' && q.numericValue ? new Prisma.Decimal(q.numericValue) : null,
      // A tolerance only means something next to a value (a CHECK enforces it).
      numericTolerance:
        q.type === 'NUMERICAL' && q.numericValue ? new Prisma.Decimal(q.numericTolerance ?? '0') : null,
      solution: q.solution,
      solutionHi: q.solutionHi ?? null,
      ...(reviewer ? { reviewedById: reviewer.id, reviewedAt: now } : {}),
    };

    try {
      await prisma.$transaction(async (tx) => {
        const row = prior
          ? await tx.question.update({ where: { id: prior.id }, data: fields, select: { id: true } })
          : await tx.question.create({
              data: { ...fields, publicId, questionPaperId: paper.id, number: q.number },
              select: { id: true },
            });
        // Options are replaced wholesale: they have no identity of their own
        // and nothing references them.
        await tx.questionOption.deleteMany({ where: { questionId: row.id } });
        if (q.options.length > 0) {
          await tx.questionOption.createMany({
            data: q.options.map((o, order) => ({
              questionId: row.id,
              label: o.label,
              order,
              body: o.body,
              bodyHi: o.bodyHi ?? null,
              isCorrect: correct.has(o.label),
            })),
          });
        }
        await tx.questionAnswer.upsert({
          where: { questionId: row.id },
          update: answer,
          create: { questionId: row.id, ...answer },
        });
      });
    } catch (error) {
      throw new Error(`Question ${q.number}: ${error instanceof Error ? error.message : String(error)}`);
    }
    touched.push({ publicId, chapterId: cid });
  }

  // 4. A chapter goes live with its first published question (Principle 6).
  const touchedChapters = [...new Set(touched.map((t) => t.chapterId))];
  if (publish) {
    const published = await prisma.examChapter.updateMany({
      where: { id: { in: touchedChapters }, status: { not: 'PUBLISHED' } },
      data: { status: 'PUBLISHED', publishedAt: now },
    });
    if (published.count > 0) console.log(`  published ${published.count} chapter(s) that now have questions`);
  }

  // 5. Year-wise statistics, recomputed for the whole exam: a new paper
  //    changes every chapter's share of its subject, not only its own.
  const statRows = await recomputeYearStats(prisma, exam.id);
  console.log(`  year stats: ${statRows} chapter-year rows`);

  // 6. Refresh the pages that show these questions.
  const chapterRows = await prisma.examChapter.findMany({
    where: { id: { in: touchedChapters } },
    select: { slug: true, examSubject: { select: { subject: { select: { slug: true } } } } },
  });
  const tags = [
    ...touched.map((t) => CACHE_TAGS.entity('QUESTION', t.publicId)),
    CACHE_TAGS.entityList('QUESTION'),
    CACHE_TAGS.entity('QUESTION_PAPER', data.paperSlug),
    ...chapterRows.map((c) => CACHE_TAGS.entity('EXAM_CHAPTER', `${data.examSlug}/${c.examSubject.subject.slug}/${c.slug}`)),
    CACHE_TAGS.sitemap(),
  ];
  await prisma.outboxEvent.create({
    data: {
      eventType: 'CACHE_REVALIDATE',
      ownerType: 'QUESTION_PAPER',
      ownerId: paper.id,
      payload: { tags, paths: [], reason: `questions:import ${data.paperSlug}` },
    },
  });
  console.log(`  queued revalidation of ${tags.length} cache tags`);
  console.log(`\nDone: ${touched.length} questions ${publish ? 'published' : 'saved as DRAFT'}.`);
}

/**
 * ExamChapterYearStat from published, non-dropped questions in published
 * papers. Raw counts are stored beside the percentage so the page can show
 * its working.
 */
async function recomputeYearStats(prisma: PrismaClient, examId: string): Promise<number> {
  const rows = await prisma.question.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      examChapterId: { not: null },
      answer: { provenance: { not: 'DROPPED' } },
      questionPaper: { examId, status: 'PUBLISHED', deletedAt: null },
    },
    select: { examChapterId: true, subjectId: true, questionPaperId: true, questionPaper: { select: { year: true } } },
  });

  const perChapter = new Map<string, number>(); // `${chapter}|${year}`
  const perSubject = new Map<string, number>(); // `${subject}|${year}`
  const papers = new Map<number, Set<string>>();
  const chapterSubject = new Map<string, string>();
  for (const r of rows) {
    const year = r.questionPaper.year;
    const chapter = r.examChapterId!;
    const subject = r.subjectId ?? '';
    chapterSubject.set(chapter, subject);
    perChapter.set(`${chapter}|${year}`, (perChapter.get(`${chapter}|${year}`) ?? 0) + 1);
    perSubject.set(`${subject}|${year}`, (perSubject.get(`${subject}|${year}`) ?? 0) + 1);
    papers.set(year, (papers.get(year) ?? new Set()).add(r.questionPaperId));
  }

  const computedAt = new Date();
  const stats = [...perChapter.entries()]
    .map(([key, questions]) => {
      const [examChapterId, yearText] = key.split('|') as [string, string];
      const year = Number(yearText);
      const subjectQuestions = perSubject.get(`${chapterSubject.get(examChapterId)}|${year}`) ?? questions;
      return {
        examChapterId,
        year,
        questions,
        subjectQuestions,
        papersInYear: papers.get(year)?.size ?? 1,
        weightagePct: Math.round((questions / subjectQuestions) * 10000) / 100,
        changePct: null as number | null,
        computedAt,
      };
    })
    .sort((a, b) => a.examChapterId.localeCompare(b.examChapterId) || a.year - b.year);

  // Change against the chapter's previous recorded year, in percentage points.
  for (let i = 1; i < stats.length; i++) {
    const [prev, cur] = [stats[i - 1]!, stats[i]!];
    if (prev.examChapterId === cur.examChapterId) {
      cur.changePct = Math.round((cur.weightagePct - prev.weightagePct) * 100) / 100;
    }
  }

  const chapterIds = (await prisma.examChapter.findMany({ where: { examId }, select: { id: true } })).map((c) => c.id);
  await prisma.$transaction([
    prisma.examChapterYearStat.deleteMany({ where: { examChapterId: { in: chapterIds } } }),
    prisma.examChapterYearStat.createMany({ data: stats }),
  ]);
  return stats.length;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
