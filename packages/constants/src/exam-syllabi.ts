/**
 * Exam syllabi as the conducting body publishes them: the subjects an exam
 * tests and the chapters ("units", in NTA's wording) of each.
 *
 * This is the skeleton the question bank files questions under, and the
 * denominator for every chapter statistic, so it follows the OFFICIAL cut of
 * the syllabus and nobody else's. A coaching site's chapter list is a
 * competitor's editorial choice (Principle 3); the bulletin is the authority
 * (Principle 2).
 *
 * Loaded into ExamSubject / ExamUnit / ExamChapter by
 *   pnpm syllabus:seed
 * which writes chapters as DRAFT. Publishing a chapter is an editorial act,
 * done once it has questions — an empty chapter page is exactly the thin
 * content PRINCIPLES.md #6 keeps out of the index.
 *
 * VERIFICATION. `verifiedAgainstSource` is set to true only after someone has
 * compared every title below with the source document, character for
 * character. The loader prints a warning for any syllabus where it is false.
 */

import { PRIORITY_EXAMS } from './exam-categories.js';
import { SUBJECT_SEEDS, SUBJECTS } from './subjects.js';

export type ExamSyllabusChapter = {
  /** URL segment: /exam/<exam>/<subject>/<slug>. Never change once published. */
  slug: string;
  /** The title as the source document prints it. */
  name: string;
};

export type ExamSyllabusUnit = {
  slug: string;
  name: string;
  chapters: readonly ExamSyllabusChapter[];
};

export type ExamSyllabusSubject = {
  /** Must exist in SUBJECT_SEEDS: exam subjects reuse the Subject table. */
  subjectSlug: string;
  /**
   * Chapters, grouped into units ONLY where the source itself groups them
   * (NTA groups JEE Main chemistry into physical / inorganic / organic, and
   * does not group physics or mathematics). A grouping the source does not
   * make is an editorial claim and is left out.
   */
  units?: readonly ExamSyllabusUnit[];
  chapters?: readonly ExamSyllabusChapter[];
};

export type ExamSyllabus = {
  examSlug: string;
  /** Which paper of a multi-paper exam this is the syllabus for. */
  paper: string;
  /** The official document the titles are taken from. */
  sourceUrl: string;
  sourceTitle: string;
  verifiedAgainstSource: boolean;
  subjects: readonly ExamSyllabusSubject[];
};

const ch = (slug: string, name: string): ExamSyllabusChapter => ({ slug, name });

/**
 * JEE Main, Paper 1 (B.E./B.Tech). Units, order and the chemistry grouping are
 * the syllabus document's own.
 *
 * SOURCE. Not the information bulletin: the 2026 bulletin (section 2.6, page
 * 16) holds no syllabus and points to jeemain.nta.nic.in, whose "Syllabus" link
 * is the PDF below.
 *
 * VERIFIED 2026-10-10 against that PDF's text: 14 mathematics, 20 physics and
 * 20 chemistry units, same titles, same order. Two deliberate differences:
 *  - Case. The PDF prints mathematics and chemistry in capitals and physics in
 *    title case; all three are title case here.
 *  - Spelling. The PDF has "INTEGRAL CALCULAS" and "DIFFRENTIAL EQUATIONS";
 *    these are spelled correctly here. A student-facing page should not
 *    reproduce a typo, and the slug was never derived from it.
 * Re-verify when NTA posts a new syllabus link, and keep slugs unchanged.
 */
export const JEE_MAIN_PAPER_1: ExamSyllabus = {
  examSlug: PRIORITY_EXAMS.JEE_MAIN,
  paper: 'Paper 1 (B.E./B.Tech.)',
  sourceUrl:
    'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf',
  sourceTitle:
    'Syllabus for JEE Main Paper 1 (B.E./B.Tech.) - Mathematics, Physics and Chemistry, National Testing Agency',
  verifiedAgainstSource: true,
  subjects: [
    {
      subjectSlug: SUBJECTS.MATHEMATICS,
      chapters: [
        ch('sets-relations-and-functions', 'Sets, Relations and Functions'),
        ch('complex-numbers-and-quadratic-equations', 'Complex Numbers and Quadratic Equations'),
        ch('matrices-and-determinants', 'Matrices and Determinants'),
        ch('permutations-and-combinations', 'Permutations and Combinations'),
        ch('binomial-theorem', 'Binomial Theorem and its Simple Applications'),
        ch('sequence-and-series', 'Sequence and Series'),
        ch('limit-continuity-and-differentiability', 'Limit, Continuity and Differentiability'),
        ch('integral-calculus', 'Integral Calculus'),
        ch('differential-equations', 'Differential Equations'),
        ch('coordinate-geometry', 'Co-ordinate Geometry'),
        ch('three-dimensional-geometry', 'Three Dimensional Geometry'),
        ch('vector-algebra', 'Vector Algebra'),
        ch('statistics-and-probability', 'Statistics and Probability'),
        ch('trigonometry', 'Trigonometry'),
      ],
    },
    {
      subjectSlug: SUBJECTS.PHYSICS,
      chapters: [
        ch('units-and-measurements', 'Units and Measurements'),
        ch('kinematics', 'Kinematics'),
        ch('laws-of-motion', 'Laws of Motion'),
        ch('work-energy-and-power', 'Work, Energy and Power'),
        ch('rotational-motion', 'Rotational Motion'),
        ch('gravitation', 'Gravitation'),
        ch('properties-of-solids-and-liquids', 'Properties of Solids and Liquids'),
        ch('thermodynamics', 'Thermodynamics'),
        ch('kinetic-theory-of-gases', 'Kinetic Theory of Gases'),
        ch('oscillations-and-waves', 'Oscillations and Waves'),
        ch('electrostatics', 'Electrostatics'),
        ch('current-electricity', 'Current Electricity'),
        ch('magnetic-effects-of-current-and-magnetism', 'Magnetic Effects of Current and Magnetism'),
        ch('electromagnetic-induction-and-alternating-currents', 'Electromagnetic Induction and Alternating Currents'),
        ch('electromagnetic-waves', 'Electromagnetic Waves'),
        ch('optics', 'Optics'),
        ch('dual-nature-of-matter-and-radiation', 'Dual Nature of Matter and Radiation'),
        ch('atoms-and-nuclei', 'Atoms and Nuclei'),
        ch('electronic-devices', 'Electronic Devices'),
        ch('experimental-skills', 'Experimental Skills'),
      ],
    },
    {
      subjectSlug: SUBJECTS.CHEMISTRY,
      units: [
        {
          slug: 'physical-chemistry',
          name: 'Physical Chemistry',
          chapters: [
            ch('some-basic-concepts-in-chemistry', 'Some Basic Concepts in Chemistry'),
            ch('atomic-structure', 'Atomic Structure'),
            ch('chemical-bonding-and-molecular-structure', 'Chemical Bonding and Molecular Structure'),
            ch('chemical-thermodynamics', 'Chemical Thermodynamics'),
            ch('solutions', 'Solutions'),
            ch('equilibrium', 'Equilibrium'),
            ch('redox-reactions-and-electrochemistry', 'Redox Reactions and Electrochemistry'),
            ch('chemical-kinetics', 'Chemical Kinetics'),
          ],
        },
        {
          slug: 'inorganic-chemistry',
          name: 'Inorganic Chemistry',
          chapters: [
            ch('classification-of-elements-and-periodicity', 'Classification of Elements and Periodicity in Properties'),
            ch('p-block-elements', 'p-Block Elements'),
            ch('d-and-f-block-elements', 'd- and f-Block Elements'),
            ch('coordination-compounds', 'Coordination Compounds'),
          ],
        },
        {
          slug: 'organic-chemistry',
          name: 'Organic Chemistry',
          chapters: [
            ch('purification-and-characterisation-of-organic-compounds', 'Purification and Characterisation of Organic Compounds'),
            ch('some-basic-principles-of-organic-chemistry', 'Some Basic Principles of Organic Chemistry'),
            ch('hydrocarbons', 'Hydrocarbons'),
            ch('organic-compounds-containing-halogens', 'Organic Compounds Containing Halogens'),
            ch('organic-compounds-containing-oxygen', 'Organic Compounds Containing Oxygen'),
            ch('organic-compounds-containing-nitrogen', 'Organic Compounds Containing Nitrogen'),
            ch('biomolecules', 'Biomolecules'),
            ch('principles-related-to-practical-chemistry', 'Principles Related to Practical Chemistry'),
          ],
        },
      ],
    },
  ],
};

export const EXAM_SYLLABI: readonly ExamSyllabus[] = [JEE_MAIN_PAPER_1];

/** Every chapter of a subject in syllabus order, flattening units. */
export function chaptersOf(subject: ExamSyllabusSubject): ExamSyllabusChapter[] {
  return [...(subject.chapters ?? []), ...(subject.units ?? []).flatMap((u) => u.chapters)];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Structural problems in a syllabus, as messages. Empty means loadable.
 * Checked before anything is written, so a typo fails the run instead of
 * creating a second chapter beside the real one.
 */
export function syllabusProblems(
  syllabus: ExamSyllabus,
  knownSubjectSlugs: readonly string[] = SUBJECT_SEEDS.map((seed) => seed.slug),
): string[] {
  const problems: string[] = [];
  const subjects = new Set<string>();

  for (const subject of syllabus.subjects) {
    const where = `${syllabus.examSlug}/${subject.subjectSlug}`;
    if (!knownSubjectSlugs.includes(subject.subjectSlug)) {
      problems.push(`${where}: subject is not in SUBJECT_SEEDS`);
    }
    if (subjects.has(subject.subjectSlug)) problems.push(`${where}: subject listed twice`);
    subjects.add(subject.subjectSlug);

    if (subject.chapters && subject.units) {
      problems.push(`${where}: has both units and loose chapters; use one or the other`);
    }

    const unitSlugs = new Set<string>();
    for (const unit of subject.units ?? []) {
      if (!SLUG.test(unit.slug)) problems.push(`${where}: unit slug "${unit.slug}" is not kebab-case`);
      if (unitSlugs.has(unit.slug)) problems.push(`${where}: unit "${unit.slug}" listed twice`);
      unitSlugs.add(unit.slug);
      if (unit.chapters.length === 0) problems.push(`${where}: unit "${unit.slug}" has no chapters`);
    }

    const chapterSlugs = new Set<string>();
    const all = chaptersOf(subject);
    if (all.length === 0) problems.push(`${where}: no chapters`);
    for (const chapter of all) {
      if (!SLUG.test(chapter.slug)) problems.push(`${where}: chapter slug "${chapter.slug}" is not kebab-case`);
      if (chapterSlugs.has(chapter.slug)) problems.push(`${where}: chapter "${chapter.slug}" listed twice`);
      chapterSlugs.add(chapter.slug);
      if (chapter.name.trim() !== chapter.name || chapter.name.length === 0) {
        problems.push(`${where}: chapter "${chapter.slug}" has a blank or untrimmed name`);
      }
    }
  }
  return problems;
}
