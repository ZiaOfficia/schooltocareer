import type { Article } from './types';

/**
 * Built on /icse-class-10-important-chapters. CISCE publishes no chapter
 * marks for ICSE; the pattern facts are from the guide's notes
 * (lib/board-prep/board-prep.json, CISCE regulations and 2027 specimen papers).
 */
export const icseClass10Article: Article = {
  slug: 'icse-class-10-2027-how-to-prepare-without-chapter-weightage',
  category: 'board-exams',
  title: 'ICSE 2027 Has No Chapter Weightage: How to Prepare',
  h1: 'ICSE Class 10 2027 has no chapter weightage. Here is how to prepare instead',
  description:
    'CISCE does not publish marks per chapter, Section A covers the whole syllabus, and about half of 2027 marks test application. A preparation plan built on the paper pattern.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1423592707957-3b212afa6733',
    alt: 'Three textbooks beside an open notebook on a desk',
    photographer: 'Mikhail Pavstyuk',
    username: 'pavstyuk',
    photo: 'selective-focus-photography-of-three-books-beside-opened-notebook-EKy2OTRPXdw',
  },
  guide: {
    label: 'Open the ICSE Class 10 chapter guide',
    href: '/icse-class-10-important-chapters',
  },
  blocks: [
    {
      kind: 'p',
      text: 'Search for “ICSE chapter-wise weightage” and you will find plenty of tables. None of them comes from the board. The Council for the Indian School Certificate Examinations (CISCE) does not publish marks for individual ICSE chapters, so any such table is someone’s guess from past papers. Planning your revision around a guess is risky, especially when the paper is designed so that every chapter can appear.',
    },
    {
      kind: 'p',
      text: 'What CISCE does publish is the shape of each paper, and that is enough to plan with. The chapter list for every subject and links to CISCE’s specimen papers are on our [ICSE Class 10 important chapters guide](/icse-class-10-important-chapters).',
    },
    { kind: 'h2', text: 'Why every chapter matters in ICSE' },
    {
      kind: 'p',
      text: 'Each ICSE paper has a compulsory **Section A** set from the whole syllabus, and a **Section B** where you choose questions. Because Section A is compulsory, a skipped chapter can cost marks that no choice in Section B will give back. This is the main difference from CBSE planning: in ICSE you cover everything first, then decide where to go deeper.',
    },
    {
      kind: 'table',
      caption: 'ICSE Class 10 Mathematics paper, 2027',
      head: ['Part', 'Marks', 'What you do'],
      rows: [
        ['Section A', '40', 'Answer every question; set from the whole syllabus'],
        ['Section B', '40', 'Answer any four questions out of seven'],
        ['Internal assessment', '20', 'From your school'],
      ],
    },
    {
      kind: 'p',
      text: 'Science is three separate papers — Physics, Chemistry and Biology — each with its own compulsory Section A and a Section B with choice.',
    },
    { kind: 'h2', text: 'What changes in 2027' },
    {
      kind: 'p',
      text: 'CISCE has said that in 2027 about **half of the marks** will test higher-order thinking and application rather than recall. In practice, that means more case-based questions, data to interpret and “explain why” questions. Learning definitions is no longer enough on its own; you need to practise using them.',
    },
    {
      kind: 'ul',
      items: [
        'Solve the 2027 specimen paper for each subject early, to see the new question styles.',
        'For each chapter, practise at least a few questions that ask you to apply an idea to an unfamiliar situation.',
        'In case-based questions, read the passage or data first. The answer is usually in it.',
      ],
    },
    { kind: 'h2', text: 'A plan that works without weightage' },
    {
      kind: 'ol',
      items: [
        '**Cover:** go through every chapter of every subject once, so nothing in Section A is new to you.',
        '**Strengthen:** go deeper into the chapters that past papers use most often for the long Section B questions — in Maths, Algebra and Geometry; in Physics, Machines, Light and Electricity; in Chemistry, Study of Compounds and Mole Concept.',
        '**Test:** solve one full specimen or past paper each week in exam time.',
        '**Fix:** re-do every wrong answer, and note the chapter it came from. Your mistakes are your real weightage table.',
      ],
    },
    {
      kind: 'tip',
      text: '**Tip:** in Maths Section B you answer four of seven questions. Decide during reading time which four you will attempt, and start with the one you are most sure of.',
    },
    { kind: 'h2', text: 'English, History & Civics and Geography' },
    {
      kind: 'p',
      text: 'These papers reward clear structure. In History and Civics, write answers in points with the key terms underlined. In Geography, practise the map and topographical-sheet questions, which follow set formats. In English, practise composition and letter formats against the time limit.',
    },
    {
      kind: 'p',
      text: 'If you are comparing boards, the [board exam 2027 preparation hub](/board-exam-preparation) covers CBSE, UP Board and ISC as well.',
    },
  ],
  faqs: [
    {
      question: 'Does CISCE publish chapter-wise weightage for ICSE 2027?',
      answer:
        'No. CISCE does not publish marks for individual ICSE chapters. Tables online are estimates from past papers, not the board’s figures.',
    },
    {
      question: 'Can I skip chapters in ICSE?',
      answer:
        'It is risky. Section A of each paper is compulsory and set from the whole syllabus, so a skipped chapter can cost marks you cannot choose your way out of.',
    },
    {
      question: 'What is new in ICSE 2027?',
      answer:
        'CISCE says about half of the marks will test higher-order thinking and application. The 2027 specimen papers show what these questions look like.',
    },
  ],
  sources: [
    {
      name: 'CISCE — ICSE regulations and syllabuses 2027, and specimen question papers',
      url: 'https://cisce.org/',
    },
  ],
};
