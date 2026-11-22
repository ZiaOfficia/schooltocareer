import type { Article } from './types';

/**
 * Built on /exam/jee-advanced/exam-pattern and /exam/jee-advanced/syllabus.
 * Facts are from lib/exam-content/jee-advanced.ts (JEE (Advanced) 2026
 * Information Brochure, IIT Roorkee). Re-check against the 2027 brochure.
 */
export const jeeAdvancedArticle: Article = {
  slug: 'jee-advanced-2027-how-to-prepare-for-an-unknown-pattern',
  category: 'entrance-exams',
  title: 'JEE Advanced 2027: How to Prepare for an Unknown Pattern',
  h1: 'JEE Advanced 2027: how to prepare for a paper whose pattern is revealed only on exam day',
  description:
    'JEE Advanced does not announce its question types or marking in advance. What the official brochure does fix — eligibility, two papers, minimum marks — and how to prepare.',
  publishedAt: '2026-11-22',
  updatedAt: '2026-11-22',
  image: {
    id: 'photo-1635372722656-389f87a941b7',
    alt: 'A blackboard covered in handwritten physics and mathematics equations',
    photographer: 'Thomas T',
    username: 'pyssling240',
    photo: 'a-blackboard-with-a-lot-of-writing-on-it-OPpCbAAKWv8',
  },
  guide: {
    label: 'Open the JEE Advanced exam pattern',
    href: '/exam/jee-advanced/exam-pattern',
  },
  blocks: [
    {
      kind: 'p',
      text: 'JEE Main publishes its paper structure months ahead. JEE Advanced does not. The official brochure fixes the papers, the timings and who can sit the exam, but it leaves the number of questions, the question types and the marking scheme to the instructions shown at the start of each paper. They change from year to year.',
    },
    {
      kind: 'p',
      text: 'That uncertainty changes how you should prepare. This article covers what is fixed, according to the latest brochure (2026, published by IIT Roorkee), and how to prepare for what is not. JEE Advanced 2027 will be run by a different IIT, which will publish its own brochure. Our [JEE Advanced exam pattern](/exam/jee-advanced/exam-pattern) and [syllabus](/exam/jee-advanced/syllabus) pages will be checked against it.',
    },
    { kind: 'h2', text: 'What is fixed' },
    {
      kind: 'table',
      caption: 'JEE (Advanced) 2026 papers',
      head: ['Paper', 'Time (IST)', 'Duration', 'Subjects'],
      rows: [
        ['Paper 1', '09:00 – 12:00', '3 hours', 'Physics, Chemistry, Mathematics'],
        ['Paper 2', '14:30 – 17:30', '3 hours', 'Physics, Chemistry, Mathematics'],
      ],
    },
    {
      kind: 'ul',
      items: [
        '**Both papers are compulsory.** Your answers are evaluated, and you are ranked, only if you sit both.',
        'The exam is **computer based only**. There is no pen-and-paper option.',
        'Questions are in English and Hindi, and you can switch between them during the paper.',
        'Negative marks **may** apply to some incorrect answers. Which ones is stated only in each section’s instructions.',
      ],
    },
    { kind: 'h2', text: 'Who can sit the exam' },
    {
      kind: 'p',
      text: 'Under the 2026 rules, you must be among the **top 2,50,000** successful candidates in JEE Main Paper 1 of the same year. You get at most two attempts, in consecutive years. To take an IIT seat you also need 75% aggregate in Class 12 (65% for SC, ST and PwD candidates), or a place in the category-wise top 20 percentile of your board. The 2026 brochure also set an age limit and Class 12 year rules; check the 2027 brochure for your own dates.',
    },
    { kind: 'h2', text: 'The minimum marks to get a rank at all' },
    {
      kind: 'table',
      caption: 'Minimum marks for a JEE (Advanced) 2026 rank',
      head: ['Rank list', 'Each subject', 'Aggregate'],
      rows: [
        ['Common Rank List', '10.0%', '35.0%'],
        ['GEN-EWS and OBC-NCL', '9.0%', '31.5%'],
        ['SC, ST and all PwD lists', '5.0%', '17.5%'],
      ],
    },
    {
      kind: 'p',
      text: 'These are percentages of the maximum marks, and the subject minimum applies to **each** subject. A brilliant Mathematics score does not help if Chemistry falls below the line: the candidate is not ranked. This is the strongest argument against neglecting your weakest subject.',
    },
    {
      kind: 'p',
      text: 'Ties are broken first by positive marks (marks from correct answers), then by Mathematics, then by Physics. That favours accuracy over guessing.',
    },
    { kind: 'h2', text: 'How to prepare for an unknown pattern' },
    {
      kind: 'ol',
      items: [
        '**Practise every common format,** not one layout: single-correct and multiple-correct multiple choice, numerical answers and matching. Past JEE Advanced papers contain all of them.',
        '**Train yourself to read instructions.** In mock tests, spend the first minute of each section reading its marking rules, and decide how much to risk on that basis.',
        '**Treat multiple-correct questions with care.** Where partial or negative marks apply, a guessed extra option can cost marks that a careful partial answer would have kept.',
        '**Keep all three subjects above the line.** Track your weakest subject in every mock against the 10% subject minimum and push it well clear.',
        '**Prepare for two papers in one day.** Sit at least some full mocks as two three-hour papers with a break, to build the stamina the real day needs.',
      ],
    },
    { kind: 'h2', text: 'The syllabus' },
    {
      kind: 'p',
      text: 'The brochure’s syllabus covers Physics (mechanics, thermal physics, electricity and magnetism, optics, modern physics and more), Chemistry (physical, inorganic and organic topics) and Mathematics (algebra, matrices, probability and statistics, trigonometry, analytical geometry, calculus and vectors). The topics are those of Class 11–12, but the questions test them in more depth than a board paper. The full unit list is on our [JEE Advanced syllabus page](/exam/jee-advanced/syllabus).',
    },
    {
      kind: 'tip',
      text: '**Tip:** JEE Advanced questions often combine two chapters in one problem. Once a chapter is done, practise mixed problems rather than only chapter-wise sets.',
    },
  ],
  faqs: [
    {
      question: 'How many questions are there in JEE Advanced?',
      answer:
        'The brochure does not fix it, and it changes from year to year. The number of questions, their types and the marking scheme appear in the instructions at the start of each paper.',
    },
    {
      question: 'Who can appear for JEE Advanced?',
      answer:
        'Under the 2026 rules, the top 2,50,000 successful candidates of JEE Main Paper 1 of the same year, with at most two attempts in consecutive years. Check the 2027 brochure for the age and Class 12 year rules.',
    },
    {
      question: 'What happens if I score below the subject minimum in one subject?',
      answer:
        'You are not included in the rank list, however high your total. For the 2026 Common Rank List the minimum was 10% in each subject and 35% in aggregate.',
    },
  ],
  sources: [
    {
      name: 'JEE (Advanced) 2026 Information Brochure — IIT Roorkee, for the Joint Admission Board',
      url: 'https://jeeadv.ac.in/documents/IBEnglish_2026_1.pdf',
    },
  ],
};
