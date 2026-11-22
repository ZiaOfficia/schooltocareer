import type { Article } from './types';

/**
 * Built on /exam/nda/exam-pattern and /exam/nda/syllabus. Facts are from
 * lib/exam-content/nda.ts (UPSC Examination Notice No. 10/2026-NDA-II).
 * Re-check against the NDA & NA (I) 2027 notice, due 2 December 2026.
 */
export const ndaArticle: Article = {
  slug: 'nda-2027-marks-negative-marking-and-preparation',
  category: 'entrance-exams',
  title: 'NDA 2027: Marks, Negative Marking and How to Prepare',
  h1: 'NDA 2027: how the marks work, and how to prepare for both papers and the SSB',
  description:
    'NDA is 900 written marks and 900 at the SSB. How UPSC splits the Mathematics and General Ability papers, what negative marking costs, and a preparation plan for 2027.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1766405531756-b1290ba82619',
    alt: 'India Gate in New Delhi in morning fog',
    photographer: 'Ashish Kushwaha',
    username: 'anshu4u',
    photo: 'india-gate-monument-shrouded-in-fog-with-people-walking-v3nvmkwReIw',
  },
  guide: {
    label: 'Open the NDA exam pattern',
    href: '/exam/nda/exam-pattern',
  },
  blocks: [
    {
      kind: 'p',
      text: 'The National Defence Academy and Naval Academy examination is held twice a year by the Union Public Service Commission (UPSC). The notice for **NDA & NA (I) 2027 is due on 2 December 2026**. Before it arrives, it helps to understand how the marks work, because the structure surprises many first-time candidates: the written exam is only half of the final total.',
    },
    {
      kind: 'p',
      text: 'The figures below are from UPSC’s latest notice, for NDA & NA (II) 2026. UPSC rarely changes the plan of examination, but check the 2027 notice when it is out. Full details are on our [NDA exam pattern](/exam/nda/exam-pattern) and [NDA syllabus](/exam/nda/syllabus) pages.',
    },
    { kind: 'h2', text: 'How the 1,800 marks are made up' },
    {
      kind: 'table',
      caption: 'Marks in the NDA & NA selection',
      head: ['Stage', 'Marks'],
      rows: [
        ['Written: Mathematics (2½ hours)', '300'],
        ['Written: General Ability Test (2½ hours)', '600'],
        ['SSB Intelligence and Personality Test', '900'],
        ['Final merit', '1,800'],
      ],
    },
    {
      kind: 'p',
      text: 'The Services Selection Board (SSB) carries as many marks as both written papers together. A candidate who just clears the written cut-off but does well at the SSB can finish above one who topped the written test. That is why serious candidates begin preparing for the SSB alongside the written exam, not after the result.',
    },
    { kind: 'h2', text: 'Negative marking: one-third per wrong answer' },
    {
      kind: 'p',
      text: 'One-third of the marks for a question is deducted for each wrong answer, and marking more than one option counts as wrong. A blank costs nothing. With four options, a blind guess gives nothing on average, so it only adds risk. A guess after ruling out two options is a different matter, and is worth taking.',
    },
    { kind: 'h2', text: 'The General Ability Test: where the 600 marks are' },
    {
      kind: 'table',
      caption: 'NDA General Ability Test',
      head: ['Part', 'Subject', 'Marks or share'],
      rows: [
        ['A', 'English', '200 marks'],
        ['B', 'General Knowledge', '400 marks'],
        ['B – Physics', 'Matter, motion, heat, sound, simple devices', 'about 25% of GK'],
        [
          'B – History, Freedom Movement etc.',
          'Indian history, freedom struggle, Constitution',
          'about 20% of GK',
        ],
        ['B – Geography', 'The Earth, climate, regional geography of India', 'about 20% of GK'],
        ['B – Chemistry', 'Changes, compounds, acids, bases and salts', 'about 15% of GK'],
        [
          'B – General Science',
          'Living things, the human body, the solar system',
          'about 10% of GK',
        ],
        ['B – Current Events', 'Recent events in India and the world', 'about 10% of GK'],
      ],
    },
    {
      kind: 'p',
      text: 'Physics is the largest share of General Knowledge, and much of it is Class 9–10 science. A student from the science stream can make it a strength with a few weeks of focused revision. History and Geography together are about 40% of GK, and both reward the NCERT school textbooks.',
    },
    { kind: 'h2', text: 'The Mathematics paper' },
    {
      kind: 'p',
      text: 'The 300-mark Mathematics paper covers eight areas of Class 11–12 mathematics: algebra; matrices and determinants; trigonometry; analytical geometry in two and three dimensions; differential calculus; integral calculus and differential equations; vector algebra; and statistics and probability. UPSC gives no marks per area, so cover them all. Because of negative marking, accuracy matters more than attempting everything.',
    },
    { kind: 'h2', text: 'A preparation plan' },
    {
      kind: 'ol',
      items: [
        '**Mathematics:** finish the eight areas from your Class 11–12 books, then practise past UPSC papers against the clock.',
        '**English (200 marks):** grammar, vocabulary and comprehension practice every day; it is a large block of marks for steady work.',
        '**General Knowledge:** Physics first, then History and Geography from NCERT books, then a daily newspaper for current events.',
        '**Mocks:** sit both papers on the same day, as in the real exam, and track how many marks negative marking is costing you.',
        '**SSB:** start now with fitness, clear communication and reading about current affairs. These cannot be crammed after the written result.',
      ],
    },
    { kind: 'h2', text: 'Who can apply' },
    {
      kind: 'p',
      text: 'Unmarried men and women can apply. The Army wing accepts Class 12 in any stream; the Air Force and Naval wings and the Naval Academy need Physics, Chemistry and Mathematics in Class 12. Class 12 students can apply and submit proof of passing later; Class 11 students cannot. Each notice sets its own birth-date window, so check it in the 2027 notice.',
    },
  ],
  faqs: [
    {
      question: 'How many marks is the NDA exam?',
      answer:
        'The written exam is 900 marks — Mathematics 300 and the General Ability Test 600 — and the SSB adds another 900, for 1,800 in the final merit.',
    },
    {
      question: 'What is the negative marking in NDA?',
      answer:
        'One-third of the marks for a question is deducted for each wrong answer. Marking more than one option counts as wrong; a blank carries no penalty.',
    },
    {
      question: 'When will the NDA 2027 notice come out?',
      answer: 'UPSC’s calendar gives 2 December 2026 for the NDA & NA (I) 2027 notice.',
    },
    {
      question: 'Can commerce or arts students apply for NDA?',
      answer:
        'Yes, for the Army wing, which accepts Class 12 in any stream. The Air Force and Naval wings and the Naval Academy need Physics, Chemistry and Mathematics.',
    },
  ],
  sources: [
    {
      name: 'UPSC Examination Notice No. 10/2026-NDA-II (NDA & NA Examination (II), 2026)',
      url: 'https://www.upsc.gov.in/examinations/National%20Defence%20Academy%20and%20Naval%20Academy%20Examination%20%28II%29%2C%202026',
    },
  ],
};
