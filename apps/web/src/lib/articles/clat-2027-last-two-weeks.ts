import type { Article } from './types';

/**
 * Built on /exam/clat/exam-pattern and /exam/clat/syllabus. Facts are from
 * lib/exam-content/clat.ts (Consortium of NLUs, CLAT 2027 UG question format
 * and syllabus pages). The exam date is the Consortium's: 6 December 2026.
 */
export const clatArticle: Article = {
  slug: 'clat-2027-final-two-weeks-strategy',
  category: 'entrance-exams',
  title: 'CLAT 2027 on 6 December: A Plan for the Final Two Weeks',
  h1: 'CLAT 2027 is on 6 December: a plan for the final two weeks',
  description:
    '120 passage-based questions in two hours, with −0.25 for a wrong answer. Section shares, when guessing pays, and a day-by-day plan for the last fortnight before CLAT 2027.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1589829545856-d10d557cf95f',
    alt: 'A statue of Lady Justice holding the scales and a sword',
    photographer: 'Tingey Injury Law Firm',
    username: 'tingeyinjurylawfirm',
    photo: 'woman-holding-sword-statue-during-daytime-DZpc4UY8ZtY',
  },
  guide: {
    label: 'Open the CLAT 2027 exam pattern',
    href: '/exam/clat/exam-pattern',
  },
  blocks: [
    {
      kind: 'p',
      text: 'CLAT 2027 will be held on **Sunday 6 December 2026, from 2:00 to 4:00 p.m.** With about two weeks to go, new content matters less than how you handle the paper itself: reading speed, choosing which questions to answer, and not losing marks to careless guesses. This article sets out what the Consortium of National Law Universities says about the paper and turns it into a plan for the final fortnight.',
    },
    {
      kind: 'p',
      text: 'The full paper format and the Consortium’s description of each section are on our [CLAT exam pattern](/exam/clat/exam-pattern) and [CLAT syllabus](/exam/clat/syllabus) pages.',
    },
    { kind: 'h2', text: 'The paper in one table' },
    {
      kind: 'table',
      caption: 'CLAT 2027 UG paper',
      head: ['Item', 'Detail'],
      rows: [
        ['Questions', '120 multiple-choice questions'],
        ['Marks', '1 mark each, 120 in all'],
        ['Wrong answer', '−0.25'],
        ['Unanswered', '0'],
        ['Duration', '2 hours'],
      ],
    },
    {
      kind: 'table',
      caption: 'Approximate number of CLAT 2027 questions per section',
      head: ['Section', 'Questions (approx.)', 'Share'],
      rows: [
        ['English Language', '22 – 26', 'about 20%'],
        ['Current Affairs, including General Knowledge', '28 – 32', 'about 25%'],
        ['Legal Reasoning', '28 – 32', 'about 25%'],
        ['Logical Reasoning', '22 – 26', 'about 20%'],
        ['Quantitative Techniques', '10 – 14', 'about 10%'],
      ],
    },
    { kind: 'h2', text: 'Time, not knowledge, is the real limit' },
    {
      kind: 'p',
      text: 'Every question hangs off a passage, and the Consortium pitches each passage so that a Class 12 student can read it in about five to seven minutes. Two hours for 120 questions is one minute per question, including the reading. Most candidates do not run out of knowledge; they run out of time. Your final two weeks should therefore be spent getting faster and more selective, not learning new topics.',
    },
    { kind: 'h2', text: 'When guessing is worth it' },
    {
      kind: 'p',
      text: 'With +1 for a right answer and −0.25 for a wrong one, a guess between four options gains only about **0.06 marks** on average. If you can rule out one option, a guess between the remaining three is worth about **0.17**; rule out two, and it is worth about **0.38**. The arithmetic is clear: never guess blind, but do answer when you have eliminated options, especially when you have narrowed it to two.',
    },
    {
      kind: 'table',
      caption: 'Average marks from guessing in CLAT (+1, −0.25)',
      head: ['Options left', 'Average gain per guess'],
      rows: [
        ['4 (blind guess)', '+0.06'],
        ['3', '+0.17'],
        ['2', '+0.38'],
      ],
    },
    { kind: 'h2', text: 'Section by section, in the last fortnight' },
    {
      kind: 'ul',
      items: [
        '**Legal Reasoning (about 25%):** answer from the principle the passage gives you, not from what you believe the law is. When the two differ, the passage wins. No prior legal knowledge is required.',
        '**Current Affairs (about 25%):** revise the major national and international events of the past year from your notes. Passages come from news writing, so recognising the story matters more than memorising lists.',
        '**English (about 20%):** practise finding the main idea and the author’s tone in one reading. Avoid re-reading whole passages.',
        '**Logical Reasoning (about 20%):** focus on arguments — premises, conclusions, assumptions and what strengthens or weakens them.',
        '**Quantitative Techniques (about 10%):** Class 10-level maths on data in a passage. It is short and exact; many candidates leave it for the end, but it is often better done early, while you are fresh.',
      ],
    },
    { kind: 'h2', text: 'A day-by-day outline' },
    {
      kind: 'table',
      caption: 'Final two weeks before CLAT 2027',
      head: ['Days', 'What to do'],
      rows: [
        [
          '22 – 28 November',
          'One full two-hour mock every other day, at 2 p.m. On the days between, review every wrong answer and note why it went wrong.',
        ],
        [
          '29 November – 2 December',
          'Mocks on alternate days again. Fix your section order and the time you allow each section.',
        ],
        [
          '3 – 4 December',
          'One last full mock, then only light revision of current-affairs notes.',
        ],
        [
          '5 December',
          'No mock. Check your admit card, the exam centre and the documents you must carry.',
        ],
        ['6 December', 'Reach early. Stick to your section order and time limits.'],
      ],
    },
    {
      kind: 'tip',
      text: '**Tip:** take your mocks at 2 p.m., the time of the real exam, so that your concentration peaks when it will matter.',
    },
  ],
  faqs: [
    {
      question: 'When is CLAT 2027?',
      answer: 'Sunday 6 December 2026, from 2:00 p.m. to 4:00 p.m.',
    },
    {
      question: 'What is the negative marking in CLAT 2027?',
      answer:
        'A quarter mark (0.25) is deducted for each wrong answer. Unanswered questions score zero.',
    },
    {
      question: 'Should I guess in CLAT?',
      answer:
        'Not blind: a four-option guess gains only about 0.06 marks on average. Once you have ruled out one or two options, a guess is worth about 0.17 or 0.38 marks.',
    },
    {
      question: 'Do I need to know law for CLAT?',
      answer:
        'No. Legal Reasoning gives you the principle in the passage. You are tested on applying it to facts, not on prior knowledge of law.',
    },
  ],
  sources: [
    {
      name: 'Consortium of NLUs — CLAT 2027 UG Question Paper Format',
      url: 'https://consortiumofnlus.ac.in/clat-2027/ug-question-format.html',
    },
    {
      name: 'Consortium of NLUs — CLAT 2027 UG Syllabus',
      url: 'https://consortiumofnlus.ac.in/clat-2027/ug-syllabus.html',
    },
  ],
};
