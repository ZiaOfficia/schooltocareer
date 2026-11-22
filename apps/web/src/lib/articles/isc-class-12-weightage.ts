import type { Article } from './types';

/**
 * Built on /isc-class-12-important-chapters. Marks are from
 * lib/board-prep/board-prep.json (CISCE ISC regulations and syllabuses 2027).
 */
export const iscClass12Article: Article = {
  slug: 'isc-class-12-2027-weightage-and-preparation',
  category: 'board-exams',
  title: 'ISC Class 12 2027 Weightage: Physics, Chemistry, Maths, Bio',
  h1: 'ISC Class 12 2027: unit weightage and how to use it',
  description:
    'Organic Chemistry is 31 of 70, Optics 18 of 70 and Calculus 35 of 80 in ISC 2027. CISCE’s unit marks for science subjects and a revision plan built on them.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1754304342371-29b232189f05',
    alt: 'Handwritten mathematical formulas on a white sheet of paper',
    photographer: 'Bozhin Karaivanov',
    username: 'bkaraivanov',
    photo: 'mathematical-formulas-are-written-on-a-white-sheet-of-paper-LJ2ksdahQZ8',
  },
  guide: {
    label: 'Open the ISC Class 12 chapter guide',
    href: '/isc-class-12-important-chapters',
  },
  blocks: [
    {
      kind: 'p',
      text: 'Unlike ICSE, the ISC syllabus does give marks for units in the science subjects, and they are worth knowing. In ISC 2027 Chemistry, organic chemistry alone is 31 of the 70 theory marks. In Mathematics, Calculus is 35 of 80. These two facts should shape how an ISC science student spends the months before the exam.',
    },
    {
      kind: 'p',
      text: 'Every unit with answer tips and the link to CISCE’s specimen papers is on our [ISC Class 12 important chapters guide](/isc-class-12-important-chapters).',
    },
    { kind: 'h2', text: 'The papers' },
    {
      kind: 'ul',
      items: [
        '**Physics, Chemistry and Biology:** a 70-mark theory paper and 30 marks for practical work, project work and the practical file.',
        '**Mathematics:** an 80-mark theory paper and 20 marks of project work. The 2027 specimen paper has four sections, all compulsory.',
        'CISCE says about **half of the 2027 marks** will test higher-order thinking and application.',
      ],
    },
    { kind: 'h2', text: 'Chemistry: organic is almost half' },
    {
      kind: 'table',
      caption: 'ISC Class 12 Chemistry marks by group, 2027',
      head: ['Group', 'Marks out of 70', 'Share'],
      rows: [
        ['Organic Chemistry', '31', '44%'],
        ['Physical Chemistry', '25', '36%'],
        ['Inorganic Chemistry', '14', '20%'],
      ],
    },
    {
      kind: 'p',
      text: 'ISC gives Chemistry marks to these three groups rather than to chapters. Organic chemistry is the largest, and it is also the most learnable: once the reaction mechanisms and conversions are clear, the same patterns repeat. Physical chemistry is numerical-heavy, so practise problems with units. Inorganic chemistry is smaller but memory-based; keep a running sheet of trends and exceptions.',
    },
    { kind: 'h2', text: 'Physics: Optics, then the electricity units' },
    {
      kind: 'table',
      caption: 'ISC Class 12 Physics unit marks, 2027',
      head: ['Unit', 'Marks out of 70'],
      rows: [
        ['Optics', '18'],
        ['Magnetism + Electromagnetic Induction & AC', '16'],
        ['Electrostatics + Current Electricity', '14'],
        ['Dual Nature of Radiation and Matter', '7'],
        ['Electronic Devices', '7'],
        ['Atoms and Nuclei', '6'],
        ['Electromagnetic Waves', '2'],
      ],
    },
    {
      kind: 'p',
      text: 'Optics and the two electricity-and-magnetism groups are 48 of 70 marks. Start there. Modern physics (Dual Nature, Atoms and Nuclei) is 13 marks together and short to revise. Electromagnetic Waves is just 2 marks.',
    },
    { kind: 'h2', text: 'Mathematics: Calculus is 35 of 80' },
    {
      kind: 'table',
      caption: 'ISC Class 12 Mathematics unit marks, 2027',
      head: ['Unit', 'Marks out of 80'],
      rows: [
        ['Calculus', '35'],
        ['Relations & Functions', '10'],
        ['Algebra', '10'],
        ['Probability', '9'],
        ['Three-Dimensional Geometry', '6'],
        ['Vector Algebra', '5'],
        ['Linear Programming', '5'],
      ],
    },
    {
      kind: 'p',
      text: 'Calculus is 44% of the paper. Because all four sections of the 2027 specimen paper are compulsory, though, you cannot skip a section and the smaller units still need covering. Use Calculus to decide where extra hours go, not which units to leave out.',
    },
    { kind: 'h2', text: 'Biology: four large units' },
    {
      kind: 'p',
      text: 'Reproduction carries 16 marks, Genetics and Evolution and Ecology and Environment 15 each, Biology and Human Welfare 14, and Biotechnology 10. The spread is even enough that every unit needs full coverage; diagrams and flowcharts earn marks across all of them.',
    },
    { kind: 'h2', text: 'A revision order' },
    {
      kind: 'ol',
      items: [
        'Chemistry: organic first, then physical, then inorganic.',
        'Physics: Optics, then Magnetism with EMI and AC, then Electrostatics with Current Electricity.',
        'Maths: Calculus daily, with one other unit each week.',
        'Every week: one CISCE specimen or past paper in full exam time.',
        'Last month: one-page notes, timed papers, and re-doing every mistake.',
      ],
    },
    {
      kind: 'p',
      text: 'For CBSE, UP Board and ICSE, see the [board exam 2027 preparation hub](/board-exam-preparation).',
    },
  ],
  faqs: [
    {
      question: 'How are ISC Class 12 Chemistry marks split in 2027?',
      answer:
        'Organic chemistry 31, physical chemistry 25 and inorganic chemistry 14, for 70 theory marks.',
    },
    {
      question: 'Which Physics unit has the most marks in ISC Class 12?',
      answer:
        'Optics, with 18 of the 70 theory marks, followed by Magnetism with Electromagnetic Induction and AC at 16.',
    },
    {
      question: 'Is there choice in the ISC 2027 Maths paper?',
      answer:
        'The 2027 specimen paper has four sections, all compulsory, so plan to cover every unit.',
    },
  ],
  sources: [
    {
      name: 'CISCE — ISC regulations and syllabuses 2027, and specimen question papers',
      url: 'https://cisce.org/',
    },
  ],
};
