import type { Article } from './types';

/**
 * Built on /up-board-class-10-important-chapters. Marks are from
 * lib/board-prep/board-prep.json (UPMSP syllabus 2026-27).
 */
export const upBoardClass10Article: Article = {
  slug: 'up-board-class-10-2027-preparation-strategy',
  category: 'board-exams',
  title: 'UP Board Class 10 2027: Chapter Marks and Preparation Plan',
  h1: 'UP Board Class 10 2027: which chapters carry the marks, and how to prepare',
  description:
    'UPMSP’s 2026-27 unit marks for Class 10 Science, Maths and Social Science, how they differ from CBSE, and a revision plan for the 70-mark written paper.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1569173675610-42c361a86e37',
    alt: 'A group of Indian schoolboys in blue school uniforms',
    photographer: 'Akshar Dave',
    username: 'akshar_dave',
    photo: 'group-of-boys-wearing-blue-school-uniforms-photo-b5UILRPGV_g',
  },
  guide: {
    label: 'Open the UP Board Class 10 chapter guide',
    href: '/up-board-class-10-important-chapters',
  },
  blocks: [
    {
      kind: 'p',
      text: 'UP Board Class 10 students study from the same NCERT textbooks as CBSE students, so it is easy to assume the exam is the same. It is not. The Uttar Pradesh Madhyamik Shiksha Parishad (UPMSP) sets its own marks for each unit, and its written paper is **70 marks**, not 80. Planning with CBSE’s numbers means planning for the wrong paper.',
    },
    {
      kind: 'p',
      text: 'This article sets out UPMSP’s 2026-27 unit marks and what they mean for revision. Every chapter, with answer tips and a link to UPMSP’s model papers, is on our [UP Board Class 10 important chapters guide](/up-board-class-10-important-chapters).',
    },
    { kind: 'h2', text: 'How the UP Board Class 10 paper works' },
    {
      kind: 'ul',
      items: [
        'Science, Mathematics and Social Science each have a **70-mark written paper** and 30 marks of internal assessment or practicals.',
        'You need **33% in each subject** to pass, so one weak subject can hold back an otherwise good result.',
        'Recent papers begin with multiple-choice questions answered on an **OMR sheet**. A wrongly filled bubble cannot be corrected, so fill each one carefully and only once you are sure.',
      ],
    },
    { kind: 'h2', text: 'Science: chemistry and biology are 40 of 70' },
    {
      kind: 'table',
      caption: 'UP Board Class 10 Science unit marks, 2026-27',
      head: ['Unit', 'Marks out of 70'],
      rows: [
        ['Chemical Substances – Nature & Behaviour', '20'],
        ['World of Living', '20'],
        ['Effects of Current', '13'],
        ['Natural Phenomena', '12'],
        ['Natural Resources', '5'],
      ],
    },
    {
      kind: 'p',
      text: 'The chemistry and biology units carry 20 marks each — more than half the written paper together. Start with them: chemical equations, acids, bases and salts, metals, carbon compounds, life processes, control and coordination, reproduction and heredity. Then move to electricity and light, which are 25 marks together.',
    },
    { kind: 'h2', text: 'Mathematics: Algebra is the biggest unit' },
    {
      kind: 'table',
      caption: 'UP Board Class 10 Mathematics unit marks, 2026-27',
      head: ['Unit', 'Marks out of 70'],
      rows: [
        ['Algebra', '18'],
        ['Geometry', '12'],
        ['Trigonometry', '10'],
        ['Mensuration', '10'],
        ['Statistics & Probability', '10'],
        ['Number Systems', '5'],
        ['Coordinate Geometry', '5'],
      ],
    },
    {
      kind: 'p',
      text: 'Algebra and Geometry are 30 marks together. Trigonometry, Mensuration and Statistics are 10 each, and each follows a small set of question types — a few days of practice per unit makes them dependable marks. Number Systems and Coordinate Geometry are 5 each and quick to finish.',
    },
    { kind: 'h2', text: 'Social Science: History and Geography lead' },
    {
      kind: 'p',
      text: 'History and Geography carry **20 marks each**, including map work, and Civics and Economics **15 each**. Map questions are among the easiest marks in the paper: practise the places and features on the syllabus list until you can mark them without hesitation.',
    },
    { kind: 'h2', text: 'Hindi and English: do not leave them to the end' },
    {
      kind: 'p',
      text: 'Because the 33% rule applies to every subject, a language paper left to the last week is a real risk. Hindi covers Gadya, Padya, Vyakaran and Lekhan, and grammar and letter writing are the most reliable marks in it. Give Hindi and English a fixed slot each week from now on, rather than one crammed week before the exam.',
    },
    { kind: 'h2', text: 'A simple plan' },
    {
      kind: 'ol',
      items: [
        'For each subject, study the units in the order of the tables above: biggest first.',
        'Read each NCERT chapter, then solve its exercise questions.',
        'Every Sunday, solve one UPMSP model paper in three hours, including the multiple-choice part on a practice answer sheet.',
        'In the last month, revise from one-page notes and re-do every question you got wrong.',
        'Keep checking that no subject is below 33% in your practice papers.',
      ],
    },
    {
      kind: 'tip',
      text: '**Tip:** UPMSP publishes model papers subject-wise on upmsp.edu.in. They show the current pattern better than any guidebook.',
    },
    {
      kind: 'p',
      text: 'Comparing boards? See [Board exam 2027 preparation](/board-exam-preparation) for CBSE, UP Board, ICSE and ISC together.',
    },
  ],
  faqs: [
    {
      question: 'Is the UP Board Class 10 syllabus the same as CBSE?',
      answer:
        'The textbooks are the same NCERT books, but UPMSP sets its own unit marks and the written paper is 70 marks, not 80. Use UPMSP’s marks to plan.',
    },
    {
      question: 'What are the passing marks for UP Board Class 10?',
      answer: 'You need 33% in each subject to pass.',
    },
    {
      question: 'Which unit carries the most marks in UP Board Class 10 Maths?',
      answer: 'Algebra, with 18 of the 70 written marks, followed by Geometry with 12.',
    },
  ],
  sources: [
    {
      name: 'UPMSP syllabus 2026-27 and model papers (upmsp.edu.in)',
      url: 'https://upmsp.edu.in/',
    },
  ],
};
