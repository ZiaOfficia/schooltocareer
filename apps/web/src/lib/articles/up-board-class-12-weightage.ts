import type { Article } from './types';

/**
 * Built on /up-board-class-12-important-chapters. Marks are from
 * lib/board-prep/board-prep.json (UPMSP syllabus 2026-27).
 */
export const upBoardClass12Article: Article = {
  slug: 'up-board-class-12-2027-weightage-physics-chemistry-maths-biology',
  category: 'board-exams',
  title: 'UP Board Class 12 2027 Weightage: PCM and Biology',
  h1: 'UP Board Class 12 2027: chapter weightage in Physics, Chemistry, Maths and Biology',
  description:
    'Calculus is 44 of 100 marks in UP Board Class 12 Maths and Optics leads Physics with 13 of 70. UPMSP’s 2026-27 unit marks and how to plan revision around them.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1623303366639-0e330d7c3d9f',
    alt: 'A student holding a yellow textbook',
    photographer: 'Muhammad Zaid',
    username: 'imdzaid',
    photo: 'boy-in-red-crew-neck-shirt-holding-yellow-book-Hg-ZgKIOdpw',
  },
  guide: {
    label: 'Open the UP Board Class 12 chapter guide',
    href: '/up-board-class-12-important-chapters',
  },
  blocks: [
    {
      kind: 'p',
      text: 'UP Board Class 12 science students face four papers that are weighted in very different ways. Mathematics puts nearly half its marks on one unit. Chemistry spreads its marks almost evenly. Physics and Biology sit in between. Knowing which is which tells you where extra hours pay off and where you simply have to cover everything.',
    },
    {
      kind: 'p',
      text: 'All units, answer tips and the link to UPMSP’s model papers are on our [UP Board Class 12 important chapters guide](/up-board-class-12-important-chapters).',
    },
    { kind: 'h2', text: 'The size of each paper' },
    {
      kind: 'ul',
      items: [
        '**Physics, Chemistry and Biology:** a 70-mark written paper and 30 marks of practicals.',
        '**Mathematics:** a 100-mark written paper, with no practical.',
        'You need **33% in each subject**, in the written paper and the practical, to pass.',
        'Papers begin with multiple-choice questions on an OMR sheet, so fill each bubble carefully.',
      ],
    },
    { kind: 'h2', text: 'Mathematics: Calculus is 44 of 100 marks' },
    {
      kind: 'table',
      caption: 'UP Board Class 12 Mathematics unit marks, 2026-27',
      head: ['Unit', 'Marks out of 100'],
      rows: [
        ['Calculus', '44'],
        ['Vectors & 3D Geometry', '18'],
        ['Algebra', '15'],
        ['Relations & Functions', '10'],
        ['Probability', '8'],
        ['Linear Programming', '5'],
      ],
    },
    {
      kind: 'p',
      text: 'With 44 marks, Calculus — continuity and differentiability, derivatives and their applications, integrals, area under curves and differential equations — is the single most important unit any UP Board Class 12 student will study. Practise integration daily: it is the skill that most Calculus questions depend on. Vectors and 3D Geometry (18) is next, and its questions are formula-driven and quick to learn.',
    },
    { kind: 'h2', text: 'Physics: Optics leads, the rest are close' },
    {
      kind: 'table',
      caption: 'UP Board Class 12 Physics unit marks, 2026-27',
      head: ['Unit', 'Marks out of 70'],
      rows: [
        ['Optics', '13'],
        ['Electrostatics', '8'],
        ['Magnetic Effects of Current & Magnetism', '8'],
        ['Electromagnetic Induction & Alternating Current', '8'],
        ['Atoms & Nuclei', '8'],
        ['Electronic Devices', '8'],
        ['Current Electricity', '7'],
        ['Dual Nature of Matter & Radiation', '6'],
        ['Electromagnetic Waves', '4'],
      ],
    },
    {
      kind: 'p',
      text: 'Optics is the clear first priority at 13 marks — ray diagrams, lens and mirror formulas and wave optics. After that, six units carry 7 or 8 marks each, so Physics rewards steady coverage of all of them. Electromagnetic Waves is only 4 marks and mostly descriptive: a short revision is enough.',
    },
    { kind: 'h2', text: 'Chemistry: every chapter carries 6 to 8' },
    {
      kind: 'p',
      text: 'Solutions and Aldehydes, Ketones and Carboxylic Acids carry 8 marks each. Electrochemistry, Chemical Kinetics, Coordination Compounds, Haloalkanes and Haloarenes, Alcohols, Phenols and Ethers, and Biomolecules carry 7 each. d- and f-Block Elements and Amines carry 6. With marks spread this evenly, the plan is simple: cover all ten chapters, and practise organic conversions and named reactions until you can write them without looking.',
    },
    { kind: 'h2', text: 'Biology: Genetics first' },
    {
      kind: 'p',
      text: 'Genetics and Evolution carries **18** of 70 marks. Reproduction, Biology and Human Welfare, and Ecology and Environment carry 14 each, and Biotechnology 10. Study Genetics first, then the three 14-mark units, and draw labelled diagrams in every answer that can use one.',
    },
    { kind: 'h2', text: 'Putting it together' },
    {
      kind: 'ol',
      items: [
        'Give Maths the most daily time, and spend most of that on Calculus until it is secure.',
        'In Physics, finish Optics first, then go through the 7- and 8-mark units one by one.',
        'In Chemistry, cover every chapter; there is no high-weight unit to lean on.',
        'Solve a UPMSP model paper every week in exam time, including the OMR section.',
        'Do not neglect English: the 33% rule applies there too.',
      ],
    },
    {
      kind: 'p',
      text: 'The same information for CBSE, ICSE and ISC is on the [board exam 2027 preparation hub](/board-exam-preparation).',
    },
  ],
  faqs: [
    {
      question: 'Which unit has the most marks in UP Board Class 12 Maths?',
      answer: 'Calculus, with 44 of the 100 marks — nearly half the paper.',
    },
    {
      question: 'Is UP Board Class 12 Chemistry the same as CBSE?',
      answer:
        'The ten chapters are the same NCERT chapters, but UPMSP spreads the marks more evenly: every chapter carries 6 to 8 marks.',
    },
    {
      question: 'Which Physics chapter is most important for UP Board Class 12?',
      answer: 'Optics, with 13 of the 70 written marks. Most other units carry 7 or 8 marks each.',
    },
  ],
  sources: [
    {
      name: 'UPMSP syllabus 2026-27 and model papers (upmsp.edu.in)',
      url: 'https://upmsp.edu.in/',
    },
  ],
};
