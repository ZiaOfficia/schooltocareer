#!/usr/bin/env tsx
/**
 * Loads EXAM_SYLLABI (packages/constants/src/exam-syllabi.ts) into ExamSubject,
 * ExamUnit and ExamChapter.
 *
 *   pnpm syllabus:seed              apply
 *   pnpm syllabus:seed --dry-run    print what would change, write nothing
 *
 * REAL DATA, not placeholder: unlike prisma/seed, this is meant to run against
 * production, so it is careful in the ways the volume seed is not.
 *
 *  - It refuses to start if the syllabus fails syllabusProblems().
 *  - It never creates an Exam or a Subject. Both must already exist; a missing
 *    one is reported, not invented (Principle 2).
 *  - New chapters are DRAFT. Publishing is an editorial act, done once a
 *    chapter has questions (Principle 6).
 *  - On re-run it updates name, order and unit only. It never touches status,
 *    description or syllabus status: those are edited by people.
 *  - It never deletes. A chapter in the database but no longer in the syllabus
 *    may have questions filed under it; it is listed for a person to decide.
 *
 * Idempotent: re-running converges.
 */
// Subpath, not the barrel: this file is ESM and @stc/constants is CommonJS
// (see the note in packages/constants/package.json).
import { EXAM_SYLLABI, chaptersOf, syllabusProblems } from '@stc/constants/exam-syllabi';
import { PrismaClient } from '@prisma/client';

const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

type Tally = { created: number; updated: number; unchanged: number };
const tally = (): Tally => ({ created: 0, updated: 0, unchanged: 0 });

async function main(): Promise<void> {
  // 1. Structural check before any query.
  const problems = EXAM_SYLLABI.flatMap((s) => syllabusProblems(s));
  if (problems.length > 0) {
    console.error('Syllabus data has problems; nothing was written.\n');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  for (const syllabus of EXAM_SYLLABI) {
    console.log(`\n${syllabus.examSlug} — ${syllabus.paper}`);
    console.log(`  source: ${syllabus.sourceTitle}`);
    if (!syllabus.verifiedAgainstSource) {
      console.warn('  WARNING: not yet verified against the source document.');
      console.warn('           Chapters load as DRAFT; verify before publishing any.');
    }

    // 2. Exam and subjects must already exist.
    const exam = await prisma.exam.findUnique({ where: { slug: syllabus.examSlug }, select: { id: true } });
    if (!exam) {
      console.error(`  SKIPPED: no Exam with slug "${syllabus.examSlug}". Create it first; this script does not.`);
      continue;
    }
    const subjectRows = await prisma.subject.findMany({
      where: { slug: { in: syllabus.subjects.map((s) => s.subjectSlug) }, deletedAt: null },
      select: { id: true, slug: true },
    });
    const subjectId = new Map(subjectRows.map((r) => [r.slug, r.id]));
    const missing = syllabus.subjects.filter((s) => !subjectId.has(s.subjectSlug)).map((s) => s.subjectSlug);
    if (missing.length > 0) {
      console.error(`  SKIPPED: Subject rows missing for ${missing.join(', ')}. Run the reference seed first.`);
      continue;
    }

    const units = tally();
    const chapters = tally();

    for (const [subjectIndex, subject] of syllabus.subjects.entries()) {
      const sid = subjectId.get(subject.subjectSlug)!;
      const key = { examId: exam.id, subjectId: sid };

      if (!dryRun) {
        await prisma.examSubject.upsert({
          where: { examId_subjectId: key },
          update: { order: subjectIndex },
          create: { ...key, order: subjectIndex },
        });
      }

      // 3. Units, where the source groups chapters.
      const unitId = new Map<string, string | null>();
      for (const [unitIndex, unit] of (subject.units ?? []).entries()) {
        const existing = await prisma.examUnit.findUnique({
          where: { examId_subjectId_slug: { ...key, slug: unit.slug } },
          select: { id: true, name: true, order: true },
        });
        if (existing && existing.name === unit.name && existing.order === unitIndex) {
          units.unchanged++;
          unitId.set(unit.slug, existing.id);
          continue;
        }
        if (existing) units.updated++;
        else units.created++;
        if (dryRun) {
          unitId.set(unit.slug, existing?.id ?? null);
          continue;
        }
        const row = await prisma.examUnit.upsert({
          where: { examId_subjectId_slug: { ...key, slug: unit.slug } },
          update: { name: unit.name, order: unitIndex },
          create: { ...key, slug: unit.slug, name: unit.name, order: unitIndex },
          select: { id: true },
        });
        unitId.set(unit.slug, row.id);
      }
      const unitOf = new Map<string, string>();
      for (const unit of subject.units ?? []) for (const c of unit.chapters) unitOf.set(c.slug, unit.slug);

      // 4. Chapters, in syllabus order.
      const wanted = chaptersOf(subject);
      for (const [order, chapter] of wanted.entries()) {
        const targetUnitId = unitOf.has(chapter.slug) ? (unitId.get(unitOf.get(chapter.slug)!) ?? null) : null;
        const existing = await prisma.examChapter.findUnique({
          where: { examId_subjectId_slug: { ...key, slug: chapter.slug } },
          select: { name: true, order: true, unitId: true },
        });
        if (existing && existing.name === chapter.name && existing.order === order && existing.unitId === targetUnitId) {
          chapters.unchanged++;
          continue;
        }
        if (existing) {
          chapters.updated++;
          console.log(`  update   ${subject.subjectSlug}/${chapter.slug}`);
        } else {
          chapters.created++;
          console.log(`  create   ${subject.subjectSlug}/${chapter.slug}  (DRAFT)`);
        }
        if (dryRun) continue;
        await prisma.examChapter.upsert({
          where: { examId_subjectId_slug: { ...key, slug: chapter.slug } },
          // Name, order and unit only. Status, description and syllabusStatus
          // belong to editors and are never overwritten by a re-run.
          update: { name: chapter.name, order, unitId: targetUnitId },
          create: { ...key, slug: chapter.slug, name: chapter.name, order, unitId: targetUnitId, status: 'DRAFT' },
        });
      }

      // 5. Report, never delete, chapters the syllabus no longer lists.
      const stale = await prisma.examChapter.findMany({
        where: { ...key, deletedAt: null, slug: { notIn: wanted.map((c) => c.slug) } },
        select: { slug: true, status: true, _count: { select: { questions: true } } },
      });
      for (const row of stale) {
        console.warn(
          `  NOT IN SYLLABUS  ${subject.subjectSlug}/${row.slug}  (${row.status}, ${row._count.questions} questions) — review by hand`,
        );
      }
    }

    console.log(
      `  units:    ${units.created} created, ${units.updated} updated, ${units.unchanged} unchanged` +
        `\n  chapters: ${chapters.created} created, ${chapters.updated} updated, ${chapters.unchanged} unchanged`,
    );
  }

  if (dryRun) console.log('\n--dry-run: nothing was written.');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
