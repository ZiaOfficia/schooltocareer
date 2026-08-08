#!/usr/bin/env tsx
/**
 * Deterministic seed.
 *
 * Two jobs, and the second is the one people skip:
 *
 *  1. Reference data — boards, classes, subjects, exam categories — from
 *     @stc/constants, so the seed and the application agree on slugs.
 *  2. VOLUME. A few dozen rows prove the schema accepts inserts; they prove
 *     nothing about query plans. Faceting, keyset pagination and full-text
 *     ranking only behave realistically once the planner stops choosing
 *     sequential scans because the table fits in one page.
 *
 * Everything is idempotent: explicit ids plus upsert, so re-running converges
 * rather than duplicating.
 *
 *   pnpm db:seed
 */
import {
  BOARD_SEEDS,
  CLASS_LEVELS,
  EXAM_CATEGORY_SEEDS,
  PRIORITY_EXAMS,
  PRIORITY_EXAM_CATEGORY,
  STATES,
  STREAMS,
  SUBJECT_SEEDS,
  buildBoardClassSlug,
  subjectsForClass,
} from '@stc/constants';

import { prisma } from '../../src/client.js';

import { createRandom, seedId, type Random } from './random.js';

/** Tuned so query plans are meaningful without the seed taking ten minutes. */
const VOLUME = {
  questionPapers: 3_000,
  posts: 300,
  results: 200,
  chaptersPerSubject: 6,
  yearsPerExam: 3,
} as const;

const SITE_ID = 'seed_site_stc';
const ADMIN_ID = 'seed_user_admin';
const CURRENT_YEAR = new Date().getFullYear();

async function main(): Promise<void> {
  const started = Date.now();
  const rng = createRandom();

  console.log('Seeding SchoolToCareer\n');

  await seedSite();
  await seedAdmin();
  const stateIds = await seedStates();
  const boardIds = await seedBoards(stateIds);
  const classLevelIds = await seedClassLevels();
  const subjectIds = await seedSubjects();
  const boardClassIds = await seedBoardClasses(boardIds, classLevelIds);
  const subjectLinkIds = await seedBoardClassSubjects(boardClassIds, subjectIds);
  await seedChapters(subjectLinkIds, rng);
  const categoryIds = await seedExamCategories();
  const examIds = await seedExams(categoryIds, boardIds);
  await seedExamYears(examIds, rng);
  const mediaIds = await seedMedia(rng);
  await seedQuestionPapers(examIds, boardIds, boardClassIds, subjectIds, mediaIds, rng);
  await seedResults(examIds, boardIds, rng);
  const blogCategoryIds = await seedBlogCategories();
  await seedPosts(blogCategoryIds, examIds, mediaIds, rng);

  await summarise(started);
}

// ── Reference data ──────────────────────────────────────────────────────────

async function seedSite(): Promise<void> {
  await prisma.site.upsert({
    where: { id: SITE_ID },
    create: {
      id: SITE_ID,
      key: 'schooltocareer',
      name: 'SchoolToCareer',
      domain: 'schooltocareer.in',
      defaultLocale: 'EN',
    },
    update: { name: 'SchoolToCareer' },
  });
  console.log('  site                 1');
}

async function seedAdmin(): Promise<void> {
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    create: {
      id: ADMIN_ID,
      email: 'admin@schooltocareer.local',
      // Placeholder. The auth module hashes properly; this row exists so
      // authored content has an author, not so anyone can sign in with it.
      passwordHash: 'SEED_PLACEHOLDER_NOT_A_VALID_HASH',
      name: 'Seed Admin',
      slug: 'seed-admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    update: {},
  });
  console.log('  users                1');
}

async function seedStates(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const state of STATES) {
    const id = seedId('state', state.code);
    await prisma.state.upsert({
      where: { id },
      create: { id, name: state.name, slug: state.slug, code: state.code, region: state.region },
      update: {},
    });
    ids.set(state.code, id);
  }
  console.log(`  states               ${STATES.length}`);
  return ids;
}

async function seedBoards(stateIds: Map<string, string>): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, board] of BOARD_SEEDS.entries()) {
    const id = seedId('board', board.slug);
    await prisma.board.upsert({
      where: { id },
      create: {
        id,
        slug: board.slug,
        name: board.name,
        shortName: board.shortName,
        type: board.type,
        stateId: board.stateCode ? (stateIds.get(board.stateCode) ?? null) : null,
        establishedYear: board.establishedYear ?? null,
        officialWebsite: board.officialWebsite,
        // Long enough to clear assertPublishable's 150-character floor, so the
        // seeded rows are genuinely publishable rather than only inserted.
        description: `${board.name} (${board.shortName}) conducts examinations for affiliated schools across its jurisdiction. This page covers its syllabus, date sheet, previous year question papers, sample papers and result announcements for every class.`,
        popularityScore: 1000 - index * 25,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdById: ADMIN_ID,
      },
      update: { status: 'PUBLISHED' },
    });
    ids.push(id);
  }
  console.log(`  boards               ${ids.length}`);
  return ids;
}

async function seedClassLevels(): Promise<string[]> {
  const ids: string[] = [];
  for (const level of CLASS_LEVELS) {
    const id = seedId('class', level.slug);
    await prisma.classLevel.upsert({
      where: { id },
      create: { id, name: level.name, slug: level.slug, order: level.order, stage: level.stage },
      update: {},
    });
    ids.push(id);
  }
  console.log(`  class levels         ${ids.length}`);
  return ids;
}

async function seedSubjects(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const subject of SUBJECT_SEEDS) {
    const id = seedId('subject', subject.slug);
    await prisma.subject.upsert({
      where: { id },
      create: {
        id,
        name: subject.name,
        slug: subject.slug,
        educationLevel: subject.educationLevel,
      },
      update: {},
    });
    ids.set(subject.slug, id);
  }
  console.log(`  subjects             ${ids.size}`);
  return ids;
}

/**
 * Board × class, with streams for 11 and 12.
 *
 * This is the table whose identity uniqueness relies on `NULLS NOT DISTINCT` —
 * classes 1 to 10 have a NULL stream, and without that index a duplicate would
 * be accepted. The verification script attempts exactly that.
 */
async function seedBoardClasses(
  boardIds: string[],
  classLevelIds: string[],
): Promise<Array<{ id: string; boardId: string; classOrder: number }>> {
  const out: Array<{ id: string; boardId: string; classOrder: number }> = [];

  for (const boardId of boardIds) {
    for (const [index, level] of CLASS_LEVELS.entries()) {
      const classLevelId = classLevelIds[index]!;
      const streams = level.order >= 11 ? STREAMS.slice(0, 3) : [null];

      for (const stream of streams) {
        const slug = buildBoardClassSlug(level.order, stream?.value ?? null);
        const id = seedId('bc', `${boardId}-${slug}`);
        await prisma.boardClass.upsert({
          where: { id },
          create: {
            id,
            boardId,
            classLevelId,
            stream: stream?.value ?? null,
            slug,
            status: 'PUBLISHED',
            createdById: ADMIN_ID,
          },
          update: {},
        });
        out.push({ id, boardId, classOrder: level.order });
      }
    }
  }

  console.log(`  board classes        ${out.length}`);
  return out;
}

async function seedBoardClassSubjects(
  boardClasses: Array<{ id: string; classOrder: number }>,
  subjectIds: Map<string, string>,
): Promise<string[]> {
  const rows: Array<{ id: string; boardClassId: string; subjectId: string; slug: string }> = [];

  for (const boardClass of boardClasses) {
    for (const subject of subjectsForClass(boardClass.classOrder, null)) {
      const subjectId = subjectIds.get(subject.slug);
      if (!subjectId) continue;
      rows.push({
        id: seedId('bcs', `${boardClass.id}-${subject.slug}`),
        boardClassId: boardClass.id,
        subjectId,
        slug: subject.slug,
      });
    }
  }

  await prisma.boardClassSubject.createMany({
    data: rows.map((row) => ({ ...row, status: 'PUBLISHED' as const, createdById: ADMIN_ID })),
    skipDuplicates: true,
  });

  console.log(`  board subjects       ${rows.length}`);
  return rows.map((row) => row.id);
}

async function seedChapters(subjectLinkIds: string[], rng: Random): Promise<void> {
  // Only a sample of subject links get chapters — chapters for every one would
  // be ~12,000 rows of fixture data that no query in the verification suite
  // touches.
  const sampled = rng.sample(subjectLinkIds, 200);
  const rows = sampled.flatMap((boardClassSubjectId, s) =>
    Array.from({ length: VOLUME.chaptersPerSubject }, (_, index) => ({
      id: seedId('ch', `${s}-${index}`),
      boardClassSubjectId,
      name: `Chapter ${index + 1}`,
      slug: `chapter-${index + 1}`,
      order: index + 1,
      status: 'PUBLISHED' as const,
      createdById: ADMIN_ID,
    })),
  );

  await prisma.chapter.createMany({ data: rows, skipDuplicates: true });
  console.log(`  chapters             ${rows.length}`);
}

// ── Exams ───────────────────────────────────────────────────────────────────

async function seedExamCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  // Parents first — a child referencing an unseeded parent is a foreign key
  // violation, and EXAM_CATEGORY_SEEDS lists parents before children.
  for (const category of EXAM_CATEGORY_SEEDS) {
    const id = seedId('excat', category.slug);
    await prisma.examCategory.upsert({
      where: { id },
      create: {
        id,
        name: category.name,
        slug: category.slug,
        order: category.order,
        parentId: category.parentSlug ? (ids.get(category.parentSlug) ?? null) : null,
      },
      update: {},
    });
    ids.set(category.slug, id);
  }

  console.log(`  exam categories      ${ids.size}`);
  return ids;
}

async function seedExams(
  categoryIds: Map<string, string>,
  boardIds: string[],
): Promise<string[]> {
  const slugs = Object.values(PRIORITY_EXAMS);
  const ids: string[] = [];

  for (const [index, slug] of slugs.entries()) {
    const id = seedId('exam', slug);
    const categorySlug = PRIORITY_EXAM_CATEGORY[slug];
    const shortName = slug.toUpperCase().replace(/-/g, ' ');

    await prisma.exam.upsert({
      where: { id },
      create: {
        id,
        slug,
        name: shortName,
        shortName,
        conductingBody: 'National Testing Agency',
        categoryId: categoryIds.get(categorySlug) ?? null,
        boardId: null,
        level: 'NATIONAL',
        mode: 'ONLINE',
        frequency: 'ANNUAL',
        educationLevel: 'UNDERGRADUATE',
        officialWebsite: `https://example.test/${slug}`,
        // Over the 200-character floor in assertPublishable, so these rows can
        // actually be published by the verification script.
        overview: `${shortName} is a national level entrance examination. This page covers the ${shortName} exam dates, application form, eligibility criteria, exam pattern, syllabus, admit card, answer key, result and cutoff for ${CURRENT_YEAR}. Candidates should check the official notification before applying, and use the previous year question papers below to understand the paper structure.`,
        popularityScore: 1000 - index * 20,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdById: ADMIN_ID,
      },
      update: { status: 'PUBLISHED' },
    });
    ids.push(id);
  }

  // One board exam, so the board->exam relation is exercised.
  const lastExamId = ids.at(-1);
  if (lastExamId) {
    await prisma.exam.update({
      where: { id: lastExamId },
      data: { boardId: boardIds[0] ?? null, level: 'BOARD' },
    });
  }

  console.log(`  exams                ${ids.length}`);
  return ids;
}

async function seedExamYears(examIds: string[], rng: Random): Promise<void> {
  const years: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];

  const EVENT_TYPES = [
    'NOTIFICATION',
    'APPLICATION_START',
    'APPLICATION_END',
    'ADMIT_CARD',
    'EXAM_DATE',
    'ANSWER_KEY',
    'RESULT',
  ] as const;

  for (const examId of examIds) {
    for (let offset = 0; offset < VOLUME.yearsPerExam; offset++) {
      const year = CURRENT_YEAR - offset;
      const id = seedId('ey', `${examId}-${year}`);
      years.push({
        id,
        examId,
        year,
        sessionName: null,
        slug: String(year),
        isCurrent: offset === 0,
        status: 'PUBLISHED',
        createdById: ADMIN_ID,
      });

      EVENT_TYPES.forEach((type, index) => {
        const start = new Date(year, index + 1, rng.int(1, 27));
        events.push({
          id: seedId('ev', `${id}-${type}`),
          examYearId: id,
          type,
          title: `${type.replace(/_/g, ' ').toLowerCase()} ${year}`,
          startDate: start,
          endDate: null,
          isTentative: offset === 0,
          order: index,
        });
      });
    }
  }

  await prisma.examYear.createMany({ data: years as never, skipDuplicates: true });
  await prisma.examEvent.createMany({ data: events as never, skipDuplicates: true });
  console.log(`  exam years           ${years.length}`);
  console.log(`  exam events          ${events.length}`);
}

// ── Media ───────────────────────────────────────────────────────────────────

async function seedMedia(rng: Random): Promise<string[]> {
  const rows = Array.from({ length: 400 }, (_, index) => ({
    id: seedId('media', index),
    provider: 'seed',
    publicId: `seed/asset-${index}`,
    secureUrl: `https://cdn.example.test/seed/asset-${index}.png`,
    type: index % 4 === 0 ? ('PDF' as const) : ('IMAGE' as const),
    mimeType: index % 4 === 0 ? 'application/pdf' : 'image/png',
    format: index % 4 === 0 ? 'pdf' : 'png',
    bytes: BigInt(rng.int(50_000, 4_000_000)),
    width: index % 4 === 0 ? null : 1200,
    height: index % 4 === 0 ? null : 630,
    aspectRatio: index % 4 === 0 ? null : 1.9048,
    pageCount: index % 4 === 0 ? rng.int(4, 40) : null,
    // Unique per asset: the partial unique index on live rows rejects
    // duplicates, which the verification script relies on.
    checksum: `seedsum${String(index).padStart(6, '0')}`,
    altText: index % 4 === 0 ? null : `Seed image ${index}`,
    isDecorative: false,
    uploadedById: ADMIN_ID,
  }));

  await prisma.mediaAsset.createMany({ data: rows, skipDuplicates: true });
  console.log(`  media assets         ${rows.length}`);
  return rows.map((row) => row.id);
}

// ── Volume: papers, results, posts ──────────────────────────────────────────

/**
 * The dataset that makes faceting and keyset pagination meaningful.
 *
 * Spread across exams, years, subjects and shifts so `GROUP BY` produces
 * realistic bucket distributions rather than one bucket with everything in it.
 */
async function seedQuestionPapers(
  examIds: string[],
  boardIds: string[],
  boardClasses: Array<{ id: string }>,
  subjectIds: Map<string, string>,
  mediaIds: string[],
  rng: Random,
): Promise<void> {
  const subjectList = [...subjectIds.values()];
  const shifts = ['S1', 'S2', null];
  const paperTypes = ['PREVIOUS_YEAR', 'PREVIOUS_YEAR', 'PREVIOUS_YEAR', 'SAMPLE', 'MODEL'] as const;

  const papers: Array<Record<string, unknown>> = [];
  const files: Array<Record<string, unknown>> = [];

  for (let index = 0; index < VOLUME.questionPapers; index++) {
    const examId = rng.pick(examIds);
    const year = rng.int(CURRENT_YEAR - 11, CURRENT_YEAR);
    const shift = rng.pick(shifts);
    const subjectId = rng.pick(subjectList);
    const paperType = rng.pick(paperTypes);
    const id = seedId('paper', index);
    const slug = `paper-${index}-${year}`;

    papers.push({
      id,
      slug,
      // Mirrors buildPaperDedupeKey's shape. Includes the index so the fixture
      // set never collides on the unique constraint.
      dedupeKey: `seed|${examId}|${year}|${shift ?? '-'}|EN|${paperType}|${index}`,
      title: `Question Paper ${index} — ${year}${shift ? ` Shift ${shift}` : ''}`,
      paperType,
      year,
      shift,
      locale: 'EN',
      examId,
      boardId: rng.bool(0.2) ? rng.pick(boardIds) : null,
      boardClassId: rng.bool(0.2) ? rng.pick(boardClasses).id : null,
      subjectId,
      totalQuestions: rng.int(30, 120),
      totalMarks: rng.int(100, 400),
      durationMin: rng.pick([120, 150, 180]),
      hasSolution: rng.bool(0.6),
      downloadCount: rng.int(0, 20_000),
      status: 'PUBLISHED',
      publishedAt: rng.pastDate(3),
      createdById: ADMIN_ID,
    });

    files.push({
      id: seedId('pf', index),
      questionPaperId: id,
      mediaId: rng.pick(mediaIds),
      fileRole: 'PAPER',
      locale: 'EN',
      version: 1,
      isCurrent: true,
      createdById: ADMIN_ID,
    });
  }

  await prisma.questionPaper.createMany({ data: papers as never, skipDuplicates: true });
  await prisma.questionPaperFile.createMany({ data: files as never, skipDuplicates: true });
  console.log(`  question papers      ${papers.length}`);
}

async function seedResults(examIds: string[], boardIds: string[], rng: Random): Promise<void> {
  const rows = Array.from({ length: VOLUME.results }, (_, index) => {
    const declared = rng.bool(0.7);
    const year = rng.int(CURRENT_YEAR - 4, CURRENT_YEAR);
    const byExam = rng.bool(0.6);

    return {
      id: seedId('result', index),
      slug: `result-${index}-${year}`,
      title: `Result ${index} ${year}`,
      resultType: byExam ? ('EXAM' as const) : ('BOARD' as const),
      year,
      examId: byExam ? rng.pick(examIds) : null,
      boardId: byExam ? null : rng.pick(boardIds),
      isDeclared: declared,
      declaredAt: declared ? rng.pastDate(2) : null,
      // A spread of expected dates so the "upcoming" widget and the
      // time-dependent cache TTL both have realistic inputs.
      expectedAt: declared ? null : new Date(Date.now() + rng.int(-5, 90) * 86_400_000),
      officialUrl: 'https://example.test/result',
      status: 'PUBLISHED' as const,
      publishedAt: rng.pastDate(1),
      createdById: ADMIN_ID,
    };
  });

  await prisma.result.createMany({ data: rows, skipDuplicates: true });
  console.log(`  results              ${rows.length}`);
}

async function seedBlogCategories(): Promise<string[]> {
  const roots = [
    { slug: 'exam-prep', name: 'Exam Preparation' },
    { slug: 'career-guidance', name: 'Career Guidance' },
    { slug: 'study-tips', name: 'Study Tips' },
  ];
  const children = [
    { slug: 'engineering-prep', name: 'Engineering', parent: 'exam-prep' },
    { slug: 'medical-prep', name: 'Medical', parent: 'exam-prep' },
    { slug: 'time-management', name: 'Time Management', parent: 'study-tips' },
    // Deliberately three levels deep, so the recursive ancestor CTE has more
    // than one hop to walk.
    { slug: 'jee-strategy', name: 'JEE Strategy', parent: 'engineering-prep' },
  ];

  const ids: string[] = [];

  for (const [index, category] of roots.entries()) {
    const id = seedId('cat', category.slug);
    await prisma.category.upsert({
      where: { id },
      create: {
        id,
        siteId: SITE_ID,
        name: category.name,
        slug: category.slug,
        type: 'BLOG',
        order: index,
        createdById: ADMIN_ID,
      },
      update: {},
    });
    ids.push(id);
  }

  for (const [index, category] of children.entries()) {
    const id = seedId('cat', category.slug);
    await prisma.category.upsert({
      where: { id },
      create: {
        id,
        siteId: SITE_ID,
        name: category.name,
        slug: category.slug,
        type: 'BLOG',
        parentId: seedId('cat', category.parent),
        order: index,
        createdById: ADMIN_ID,
      },
      update: {},
    });
    ids.push(id);
  }

  console.log(`  blog categories      ${ids.length}`);
  return ids;
}

async function seedPosts(
  categoryIds: string[],
  examIds: string[],
  mediaIds: string[],
  rng: Random,
): Promise<void> {
  const rows = Array.from({ length: VOLUME.posts }, (_, index) => {
    const isNews = rng.bool(0.3);
    const categoryId = rng.pick(categoryIds);
    const slug = `post-${index}`;
    const section = isNews ? 'news' : 'blog';

    return {
      id: seedId('post', index),
      siteId: SITE_ID,
      type: isNews ? ('NEWS' as const) : ('ARTICLE' as const),
      slug,
      path: `/${section}/${slug}`,
      title: `Article ${index}: preparation strategy and timeline`,
      excerpt: `A practical guide covering preparation strategy, timeline and common mistakes for aspirants in ${CURRENT_YEAR}.`,
      // Long enough to clear the indexability score's word-count component, so
      // seeded posts are genuinely publishable.
      bodyHtml: `<p>${'Preparation requires a realistic timeline and consistent revision. '.repeat(40)}</p>`,
      readingMinutes: rng.int(3, 12),
      locale: 'EN' as const,
      status: 'PUBLISHED' as const,
      publishedAt: rng.pastDate(2),
      version: 1,
      isFeatured: rng.bool(0.1),
      viewCount: rng.int(0, 50_000),
      authorId: ADMIN_ID,
      categoryId,
      featuredImageId: rng.pick(mediaIds),
      examId: rng.bool(0.4) ? rng.pick(examIds) : null,
      createdById: ADMIN_ID,
    };
  });

  await prisma.contentEntry.createMany({ data: rows, skipDuplicates: true });
  console.log(`  posts                ${rows.length}`);
}

// ── Summary ─────────────────────────────────────────────────────────────────

async function summarise(started: number): Promise<void> {
  const [papers, posts, results, boardClasses, categories] = await Promise.all([
    prisma.questionPaper.count(),
    prisma.contentEntry.count(),
    prisma.result.count(),
    prisma.boardClass.count(),
    prisma.category.count(),
  ]);

  console.log(`\nSeed complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(
    `  papers=${papers} posts=${posts} results=${results} boardClasses=${boardClasses} categories=${categories}`,
  );
  console.log('\nNext: pnpm verify:e2e');
}

main()
  .catch((error: unknown) => {
    console.error('\nSeed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
