import type { Article } from './types';

/**
 * Built on /cbse-class-10-important-chapters. Every mark below is from
 * lib/board-prep/board-prep.json (CBSE Curriculum 2026-27); re-check this
 * article whenever that file changes.
 */
export const cbseClass10Article: Article = {
  slug: 'cbse-class-10-2027-how-to-score-90-plus',
  category: 'board-exams',
  title: 'CBSE Class 10 2027: How to Score 90+ Using Unit Weightage',
  h1: 'CBSE Class 10 2027: how to score 90+ by studying where the marks are',
  description:
    'Half of CBSE Class 10 Science is two units, and Algebra is a quarter of Maths. A study order, answer-writing method and weekly plan built on the 2026-27 curriculum.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1606326608606-aa0b62935f2b',
    alt: 'A student writing answers on a sheet of paper with a pen',
    photographer: 'Nguyen Dang Hoang Nhu',
    username: 'nguyendhn',
    photo: 'person-writing-on-white-paper-qDgTQOYk6B8',
  },
  guide: {
    label: 'Open the CBSE Class 10 chapter guide',
    href: '/cbse-class-10-important-chapters',
  },
  blocks: [
    {
      kind: 'p',
      text: 'Most students revise CBSE Class 10 the way the textbook is printed: chapter 1, then chapter 2, until the time runs out. The board does not mark it that way. The 2026-27 curriculum gives every unit a fixed number of the 80 theory marks, and those numbers are very uneven. A student who knows them can put the first two months of revision where the marks are, and leave the small units for the weeks when there is less time.',
    },
    {
      kind: 'p',
      text: 'This article turns the official unit marks into a study order for Science, Mathematics and Social Science. The full chapter list, answer tips for every unit and links to CBSE’s own question papers are in our [CBSE Class 10 important chapters guide](/cbse-class-10-important-chapters).',
    },
    { kind: 'h2', text: 'How a CBSE Class 10 paper is marked' },
    {
      kind: 'p',
      text: 'Each main subject has an **80-mark theory paper** and **20 marks of internal assessment** from your school. So a 90 in a subject means about 70 in the theory paper if your internal marks are full. The theory paper is where the difference is made, and it is set unit by unit.',
    },
    {
      kind: 'p',
      text: 'CBSE also gives marks for correct steps even when the final answer is wrong. That changes how you should write numericals and derivations: a neat, step-by-step answer that slips at the end still earns most of its marks.',
    },
    { kind: 'h2', text: 'Science: two units are half the paper' },
    {
      kind: 'table',
      caption: 'CBSE Class 10 Science unit marks, 2026-27',
      head: ['Unit', 'Marks out of 80', 'Share'],
      rows: [
        ['Chemical Substances – Nature & Behaviour', '25', '31%'],
        ['World of Living', '25', '31%'],
        ['Effects of Current', '13', '16%'],
        ['Natural Phenomena', '12', '15%'],
        ['Natural Resources', '5', '6%'],
      ],
    },
    {
      kind: 'p',
      text: 'The chemistry unit (Chemical Reactions and Equations; Acids, Bases and Salts; Metals and Non-metals; Carbon and its Compounds) and the biology unit (Life Processes; Control and Coordination; How do Organisms Reproduce?; Heredity) carry **50 of the 80 marks** between them. If you are short of time, these eight chapters come first.',
    },
    {
      kind: 'ul',
      items: [
        '**Chemistry:** write one page of every reaction in the four chapters, balanced and with state symbols, and read it every day. Most chemistry marks are lost to unbalanced equations, not to not knowing the reaction.',
        '**Biology:** practise the eight to ten standard diagrams (heart, nephron, neuron, flower, alimentary canal and the rest) until each takes about two minutes. A labelled diagram often carries marks of its own.',
        '**Physics:** Effects of Current and Natural Phenomena are 25 marks together and are mostly numericals and ray diagrams. Learn the formulas with units, then solve past-paper numericals in full steps.',
      ],
    },
    { kind: 'h2', text: 'Mathematics: Algebra first, then Geometry and Trigonometry' },
    {
      kind: 'table',
      caption: 'CBSE Class 10 Mathematics unit marks, 2026-27',
      head: ['Unit', 'Marks out of 80'],
      rows: [
        ['Algebra', '20'],
        ['Geometry', '15'],
        ['Trigonometry', '12'],
        ['Statistics & Probability', '11'],
        ['Mensuration', '10'],
        ['Number Systems', '6'],
        ['Coordinate Geometry', '6'],
      ],
    },
    {
      kind: 'p',
      text: 'Algebra (Polynomials, Pair of Linear Equations, Quadratic Equations and Arithmetic Progressions) is a quarter of the paper on its own. Algebra, Geometry and Trigonometry together make 47 marks — more than half. Statistics and Probability is the most reliable 11 marks in the paper, because its questions follow the same few forms every year.',
    },
    {
      kind: 'p',
      text: 'Do not skip Number Systems and Coordinate Geometry because they are only 6 marks each. They are short chapters with predictable questions, which makes them some of the easiest marks to collect.',
    },
    { kind: 'h2', text: 'Social Science: four equal parts' },
    {
      kind: 'p',
      text: 'History, Geography, Political Science and Economics carry **20 marks each**, so no part can be dropped. Map work is 5 marks in all — 2 inside History and 3 inside Geography — and is the quickest 5 marks in the paper if you practise the official map list a few times.',
    },
    {
      kind: 'tip',
      text: '**Tip:** in Social Science, a 5-mark answer written in five clear points with a heading usually scores better than a long paragraph. Examiners look for the points, so make them easy to find.',
    },
    { kind: 'h2', text: 'A study order for the months left' },
    {
      kind: 'ol',
      items: [
        '**First pass (high-mark units):** Science chemistry and biology units, Maths Algebra and Geometry, and one Social Science part a week. Read the NCERT chapter, then do every exercise question.',
        '**Second pass (middle units):** Effects of Current, Natural Phenomena, Trigonometry, Statistics and Probability, Mensuration.',
        '**Third pass (short units):** Natural Resources, Number Systems, Coordinate Geometry. Each takes a day or two.',
        '**Every Sunday:** one full past paper in exactly three hours, checked against CBSE’s marking scheme rather than just the final answers.',
        '**Last 30 days:** one-page notes of formulas, reactions, diagrams and dates; one timed paper a day in the third week; re-do every wrong answer in the fourth.',
      ],
    },
    { kind: 'h2', text: 'How to write answers that collect every mark' },
    {
      kind: 'ul',
      items: [
        'Match length to marks: one point for 1 mark, two for 2, three for 3, and five or six points with a diagram or example for 5.',
        'For numericals: formula, values with units, calculation, then the answer boxed with its unit.',
        'Draw diagrams in pencil, label on one side, and give each a title.',
        'For case-based questions, read the passage or data first. The answer is usually in it.',
        'Attempt every multiple-choice question. A blank always scores zero.',
      ],
    },
    {
      kind: 'p',
      text: 'The 30-day plan, the exam-day checklist and a downloadable spreadsheet of every unit are on the [CBSE Class 10 guide](/cbse-class-10-important-chapters). For all four boards in one place, see [Board exam 2027 preparation](/board-exam-preparation).',
    },
  ],
  faqs: [
    {
      question: 'Which chapters carry the most marks in CBSE Class 10 Science 2027?',
      answer:
        'The chemistry unit (Chemical Reactions, Acids Bases and Salts, Metals and Non-metals, Carbon and its Compounds) and the biology unit (Life Processes, Control and Coordination, Reproduction, Heredity) carry 25 marks each — 50 of the 80 theory marks.',
    },
    {
      question: 'How many marks is the CBSE Class 10 theory paper?',
      answer:
        'Each main subject has an 80-mark theory paper and 20 marks of internal assessment, for 100 in all.',
    },
    {
      question: 'Can I skip Coordinate Geometry in Class 10 Maths?',
      answer:
        'It is only 6 marks, but its questions are short and predictable, so it is one of the easiest places to collect marks. Revise it after Algebra, Geometry and Trigonometry rather than skipping it.',
    },
  ],
  sources: [
    {
      name: 'CBSE Curriculum 2026-27 (copies published by the Directorate of Education, Delhi)',
      url: 'https://edustud.nic.in/',
    },
    {
      name: 'CBSE previous years’ question papers',
      url: 'https://www.cbse.gov.in/cbsenew/question-paper.html',
    },
  ],
};
