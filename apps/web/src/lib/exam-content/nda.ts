import type { ExamContent, ExamContentSet } from './types';

/**
 * NDA & NA — exam pattern and syllabus.
 *
 * Written from one document, read for this file on 22 Nov 2026:
 *
 *   UPSC Examination Notice No. 10/2026-NDA-II — National Defence Academy
 *   and Naval Academy Examination (II), 2026, notified 20 May 2026.
 *   Para 3 (eligibility), the Plan of Examination and the Syllabus in the
 *   appendix.
 *
 * Deliberately left out: the birth-date window and the wing-wise vacancy
 * split. Both change with every notice, and the copy read for this file
 * was not legible enough on either to quote. The page sends readers to the
 * notice for them instead.
 *
 * The NDA & NA (I) 2027 notice is due on 2 December 2026. When it is out,
 * re-read the Plan of Examination and the Syllabus against this file — UPSC
 * rarely changes them — and update `source` and `checkedOn`.
 */

const NOTICE = {
  name: 'Examination Notice No. 10/2026-NDA-II (NDA & NA Examination (II), 2026)',
  url: 'https://www.upsc.gov.in/examinations/National%20Defence%20Academy%20and%20Naval%20Academy%20Examination%20%28II%29%2C%202026',
  publishedBy: 'Union Public Service Commission',
} as const;

const CHECKED_ON = '2026-11-22';

const CYCLE_NOTE =
  'This is the NDA & NA (II) 2026 notice, the latest UPSC has published. The NDA & NA (I) 2027 notice is due on 2 December 2026; we will check this page against it.';

const examPattern: ExamContent = {
  lede: 'Two written papers on one day — Mathematics for 300 marks and a General Ability Test for 600 — then a 900-mark SSB interview for those who qualify.',
  source: NOTICE,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'The written examination',
      blocks: [
        {
          kind: 'table',
          caption: 'NDA & NA written papers',
          head: ['Paper', 'Subject', 'Duration', 'Marks'],
          rows: [
            ['I', 'Mathematics (code 01)', '2½ hours', '300'],
            ['II', 'General Ability Test (code 02)', '2½ hours', '600'],
          ],
          foot: ['', 'Written total', '', '900'],
          note: 'Both papers are objective multiple choice. For the (II) 2026 exam they were held on 13 September 2026.',
        },
        {
          kind: 'table',
          caption: 'How the General Ability Test is divided',
          head: ['Part', 'Subject', 'Marks'],
          rows: [
            ['A', 'English', '200'],
            ['B', 'General Knowledge', '400'],
          ],
          foot: ['', 'Total', '600'],
        },
        {
          kind: 'list',
          items: [
            'Negative marking: one-third of the marks for a question is deducted for each wrong answer. Marking more than one answer counts as wrong. A blank costs nothing.',
            'Mathematics and Part B of the GAT are set in both Hindi and English. Part A is in English only.',
            'UPSC may fix qualifying marks in any or all papers. It does not publish them in advance.',
          ],
        },
      ],
    },
    {
      title: 'After the written exam: the SSB',
      blocks: [
        {
          kind: 'text',
          text: 'Candidates who clear the written cut-off are called to a Services Selection Board (SSB) for an Intelligence and Personality Test, which carries 900 marks — as many as both written papers together. You must clear minimum marks in the written exam and in the SSB, and then be found medically fit.',
        },
        {
          kind: 'table',
          caption: 'Marks in the NDA & NA selection',
          head: ['Stage', 'Marks'],
          rows: [
            ['Written: Mathematics', '300'],
            ['Written: General Ability Test', '600'],
            ['SSB Test / Interview', '900'],
          ],
          foot: ['Final merit', '1,800'],
        },
        {
          kind: 'text',
          text: 'Because the SSB is half of the final marks, a candidate who scrapes past the written cut-off but does well at the SSB can finish above one who topped the written test. Preparing for the interview is not something to leave until the result is out.',
        },
      ],
    },
    {
      title: 'Who can apply',
      blocks: [
        {
          kind: 'list',
          items: [
            'Unmarried men and women only.',
            'Army wing of NDA: Class 12 pass under the 10+2 pattern, or an equivalent, in any stream.',
            'Air Force and Naval wings of NDA, and the Naval Academy’s 10+2 Cadet Entry Scheme: Class 12 pass with Physics, Chemistry and Mathematics.',
            'Students in Class 12 can apply and must later submit proof of passing by the date the notice sets. Students in Class 11 cannot.',
            'Each notice sets its own birth-date window. Check it in the notice for the exam you are applying to.',
          ],
        },
        {
          kind: 'text',
          text: 'The (II) 2026 notice announced 394 provisional vacancies across the NDA’s Army, Navy and Air Force wings and the Naval Academy, for courses beginning on 1 July 2027.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many marks is the NDA written exam?',
      answer:
        '900: Mathematics for 300 and the General Ability Test for 600. The SSB interview adds another 900.',
    },
    {
      question: 'What is the negative marking in NDA?',
      answer:
        'One-third of the question’s marks for each wrong answer, and marking more than one option counts as wrong. Unanswered questions carry no penalty.',
    },
    {
      question: 'Can a commerce or arts student take NDA?',
      answer:
        'Yes, for the Army wing, which accepts Class 12 in any stream. The Air Force and Naval wings and the Naval Academy need Physics, Chemistry and Mathematics in Class 12.',
    },
    {
      question: 'How often is NDA held?',
      answer:
        'Twice a year, as NDA & NA (I) and (II). The (I) 2027 notice is due on 2 December 2026.',
    },
  ],
};

const MATHS_TOPICS: ReadonlyArray<readonly string[]> = [
  [
    '1',
    'Algebra',
    'Sets and Venn diagrams, relations, complex numbers, binary numbers, progressions, quadratic equations, linear inequations, permutations and combinations, binomial theorem, logarithms',
  ],
  [
    '2',
    'Matrices and Determinants',
    'Types of matrices and operations, determinants, adjoint and inverse, solving equations by Cramer’s rule and the matrix method',
  ],
  [
    '3',
    'Trigonometry',
    'Angles and ratios, identities, inverse trigonometric functions, heights and distances, properties of triangles',
  ],
  [
    '4',
    'Analytical Geometry of Two and Three Dimensions',
    'Lines, circles and conics; points, direction cosines and ratios, planes and spheres in space',
  ],
  [
    '5',
    'Differential Calculus',
    'Functions, limits, continuity, derivatives and their applications, maxima and minima',
  ],
  [
    '6',
    'Integral Calculus and Differential Equations',
    'Methods of integration, definite integrals, area under curves, order and degree, first-order equations, growth and decay',
  ],
  [
    '7',
    'Vector Algebra',
    'Vector operations, dot and cross products, applications to work, moment and geometry',
  ],
  [
    '8',
    'Statistics and Probability',
    'Presenting data, mean, median and mode, dispersion, correlation and regression, laws of probability, Bayes’ theorem, binomial distribution',
  ],
];

const GK_SECTIONS: ReadonlyArray<readonly string[]> = [
  [
    'A',
    'Physics',
    'about 25%',
    'Matter and its states, motion and Newton’s laws, heat, sound, and how simple devices work',
  ],
  [
    'B',
    'Chemistry',
    'about 15%',
    'Physical and chemical changes, compounds, gases, acids, bases and salts, forms of carbon, common materials, the atom',
  ],
  [
    'C',
    'General Science',
    'about 10%',
    'Living things, the cell, the human body, food and diet, epidemics, the solar system, light, magnetism, electricity, simple instruments',
  ],
  [
    'D',
    'History, Freedom Movement etc.',
    'about 20%',
    'Indian history and culture, the freedom struggle, the Constitution, Five-Year Plans, themes of world history',
  ],
  [
    'E',
    'Geography',
    'about 20%',
    'The Earth, atmosphere, rocks, oceans and climate, regional geography of India, trade routes',
  ],
  [
    'F',
    'Current Events',
    'about 10%',
    'Recent important events in India and the world, and prominent personalities',
  ],
];

const syllabus: ExamContent = {
  lede: 'The Mathematics paper follows Class 11–12 mathematics in eight areas; the General Ability Test adds English and six General Knowledge sections, each with an official share of the marks.',
  source: NOTICE,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'Paper I: Mathematics (300 marks)',
      blocks: [
        {
          kind: 'table',
          caption: 'NDA Mathematics syllabus areas',
          head: ['Area', 'Name', 'What it covers'],
          rows: MATHS_TOPICS,
          note: 'UPSC gives no marks per area. The list above shortens UPSC’s topic lists; the notice has every topic in full.',
        },
      ],
    },
    {
      title: 'Paper II, Part A: English (200 marks)',
      blocks: [
        {
          kind: 'text',
          text: 'The English paper tests your understanding of the language and how well you use it. UPSC names grammar and usage, vocabulary, comprehension, and cohesion in extended text.',
        },
      ],
    },
    {
      title: 'Paper II, Part B: General Knowledge (400 marks)',
      blocks: [
        {
          kind: 'table',
          caption: 'NDA General Knowledge sections and their weightage',
          head: ['Section', 'Subject', 'Weightage', 'What it covers'],
          rows: GK_SECTIONS,
          note: 'The weightages are UPSC’s own, stated in the syllabus. They are approximate.',
        },
        {
          kind: 'text',
          text: 'Science — Physics, Chemistry and General Science — is about half of Part B, so about 200 of the GAT’s 600 marks. The topics are the fundamentals of school science, so a candidate from an arts or commerce background has the most to gain from revising it.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'What level is NDA Mathematics?',
      answer:
        'It follows the Class 11 and 12 syllabus closely: algebra, matrices, trigonometry, coordinate geometry, calculus, vectors, statistics and probability.',
    },
    {
      question: 'Which part of the NDA GAT carries the most marks?',
      answer:
        'General Knowledge, at 400 of the 600 marks. Within it Physics is the largest section, at about 25%.',
    },
    {
      question: 'Is current affairs a big part of NDA?',
      answer:
        'Current Events is about 10% of the General Knowledge part, or roughly 40 marks. History and Geography carry about twice as much each.',
    },
  ],
};

export const NDA_CONTENT: ExamContentSet = {
  'exam-pattern': examPattern,
  syllabus,
};
