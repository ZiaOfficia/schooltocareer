import type { ExamContent, ExamContentSet } from './types';

/**
 * CLAT (UG) — exam pattern and syllabus.
 *
 * Written from the Consortium of National Law Universities' own CLAT 2027
 * pages, read for this file on 22 Nov 2026:
 *
 *   UG Question Paper Format   /clat-2027/ug-question-format.html
 *   UG Syllabus                /clat-2027/ug-syllabus.html
 *   UG Eligibility             /clat-2027/ug-eligibility.html
 *   Press Release, CLAT 2027   (date and time of the exam)
 *   General Instructions       (extra time for PwD candidates)
 *
 * The Consortium gives question counts as RANGES ("approximate number of
 * questions"), so this page does too. It publishes no topic-wise weightage
 * inside a section, and no list of current-affairs topics.
 *
 * Re-read the three UG pages when the CLAT 2028 pages go up. The Consortium
 * has said a committee's recommendations will be considered for CLAT 2028,
 * so the pattern may change then.
 */

const FORMAT = {
  name: 'CLAT 2027 UG Question Paper Format',
  url: 'https://consortiumofnlus.ac.in/clat-2027/ug-question-format.html',
  publishedBy: 'Consortium of National Law Universities',
} as const;

const SYLLABUS = {
  name: 'CLAT 2027 UG Syllabus',
  url: 'https://consortiumofnlus.ac.in/clat-2027/ug-syllabus.html',
  publishedBy: 'Consortium of National Law Universities',
} as const;

const CHECKED_ON = '2026-11-22';

const CYCLE_NOTE =
  'CLAT 2027 is held on 6 December 2026 for admission in the 2027–28 academic year. The Consortium has said the pattern is unchanged from CLAT 2026.';

const examPattern: ExamContent = {
  lede: 'One two-hour paper of 120 multiple-choice questions, all built on reading passages, across five subjects. A wrong answer costs a quarter mark.',
  source: FORMAT,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'The paper at a glance',
      blocks: [
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
            ['CLAT 2027 date', 'Sunday 6 December 2026, 2:00 p.m. to 4:00 p.m.'],
          ],
          note: 'Eligible PwD candidates get extra time: 2:00 p.m. to 4:40 p.m., according to the Consortium’s general instructions.',
        },
      ],
    },
    {
      title: 'Questions by subject',
      blocks: [
        {
          kind: 'table',
          caption: 'Approximate number of CLAT 2027 UG questions in each subject',
          head: ['Subject', 'Questions (approx.)', 'Share of paper'],
          rows: [
            ['English Language', '22 – 26', 'about 20%'],
            ['Current Affairs, including General Knowledge', '28 – 32', 'about 25%'],
            ['Legal Reasoning', '28 – 32', 'about 25%'],
            ['Logical Reasoning', '22 – 26', 'about 20%'],
            ['Quantitative Techniques', '10 – 14', 'about 10%'],
          ],
          foot: ['Total', '120', '100%'],
          note: 'The Consortium publishes ranges, not fixed numbers. The exact split is known only when you open the paper.',
        },
      ],
    },
    {
      title: 'What the marking means for you',
      blocks: [
        {
          kind: 'text',
          text: 'With +1 for a right answer and −0.25 for a wrong one, a blind guess between four options gains only about 0.06 marks on average, and it costs the time you spend on it. Ruling out even one option raises that to about 0.17, and ruling out two to about 0.38, so an educated guess is usually worth making. A blind guess on a passage you have not read is not.',
        },
        {
          kind: 'text',
          text: 'The bigger constraint is time. Every question hangs off a passage of around 450 words, so most of the two hours goes on reading. Legal Reasoning and Current Affairs together are about half the paper, and both reward fast, accurate reading more than memorised facts.',
        },
      ],
    },
    {
      title: 'Who can sit CLAT (UG)',
      blocks: [
        {
          kind: 'list',
          items: [
            'There is no upper age limit.',
            'You need Class 12 (10+2) or an equivalent with at least 45% marks, or 40% for SC, ST and PwD candidates.',
            'Students sitting their Class 12 exams in March or April 2027 can apply, but must show proof of passing at the time of admission.',
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many questions are there in CLAT 2027?',
      answer:
        'There are 120 multiple-choice questions of one mark each, to be answered in two hours.',
    },
    {
      question: 'What is the negative marking in CLAT?',
      answer:
        'A quarter mark (0.25) is deducted for each wrong answer. Questions left blank cost nothing.',
    },
    {
      question: 'Which section of CLAT has the most questions?',
      answer:
        'Legal Reasoning and Current Affairs including General Knowledge, with about 28 to 32 questions each. Together they make up about half of the paper.',
    },
    {
      question: 'When is CLAT 2027?',
      answer:
        'On Sunday 6 December 2026, from 2:00 p.m. to 4:00 p.m. Check your admit card for your centre and reporting time.',
    },
    {
      question: 'Is there an age limit for CLAT UG?',
      answer: 'No. The Consortium sets no upper age limit for the UG programme.',
    },
  ],
};

const syllabus: ExamContent = {
  lede: 'CLAT does not have a list of chapters. Each of the five sections tests a skill through reading passages, and this is what the Consortium says each one asks of you.',
  source: SYLLABUS,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'How the CLAT syllabus works',
      blocks: [
        {
          kind: 'text',
          text: 'Unlike JEE or NEET, CLAT is not built on a school syllabus. Every section gives you passages and asks questions about them. What you are tested on is reading, reasoning and, in Current Affairs, awareness of the world. The descriptions below are the Consortium’s, condensed.',
        },
        {
          kind: 'table',
          caption: 'The five CLAT sections and what their passages are',
          head: ['Section', 'Passages'],
          rows: [
            [
              'English Language',
              'About 450 words each, from contemporary or historically significant fiction and non-fiction',
            ],
            [
              'Current Affairs, including GK',
              'Up to 450 words each, from news, journalistic sources and other non-fiction',
            ],
            [
              'Legal Reasoning',
              'About 450 words each, on legal matters, public policy questions or moral and philosophical enquiries',
            ],
            [
              'Logical Reasoning',
              'Short passages of about 450 words, each followed by one or more questions',
            ],
            [
              'Quantitative Techniques',
              'Short sets of facts, propositions or other numerical information',
            ],
          ],
        },
      ],
    },
    {
      title: 'English Language',
      blocks: [
        {
          kind: 'text',
          text: 'The passages are pitched so that a Class 12 student can read each one in about five to seven minutes. You will be asked to:',
        },
        {
          kind: 'list',
          items: [
            'identify the main point, the arguments and the viewpoints in a passage;',
            'draw inferences and conclusions from it;',
            'summarise it;',
            'compare and contrast the arguments or viewpoints it sets out;',
            'work out the meaning of words and phrases from their context.',
          ],
        },
      ],
    },
    {
      title: 'Current Affairs, including General Knowledge',
      blocks: [
        {
          kind: 'text',
          text: 'Questions may ask about legal information in a passage, but you are not expected to know any law beyond what the passage says. The section tests awareness of:',
        },
        {
          kind: 'list',
          items: [
            'significant contemporary events in India and the world;',
            'arts and culture;',
            'international affairs;',
            'historical events of continuing significance.',
          ],
        },
        {
          kind: 'text',
          text: 'Because the passages come from news writing, the best preparation is to read a daily newspaper properly for the twelve months or so before the exam, rather than to memorise lists of facts.',
        },
      ],
    },
    {
      title: 'Legal Reasoning',
      blocks: [
        {
          kind: 'text',
          text: 'No prior knowledge of law is required. A general awareness of current legal and moral issues helps you apply principles to facts. You will be asked to:',
        },
        {
          kind: 'list',
          items: [
            'identify and infer the rules and principles set out in a passage;',
            'apply those rules and principles to different fact situations;',
            'understand how a change to a rule or principle would change how it applies.',
          ],
        },
        {
          kind: 'text',
          text: 'The commonest mistake here is answering from what you believe the law is, rather than from the principle the passage gives you. When the two differ, the passage wins.',
        },
      ],
    },
    {
      title: 'Logical Reasoning',
      blocks: [
        {
          kind: 'list',
          items: [
            'Recognise an argument, and identify its premises and conclusion.',
            'Analyse patterns of reasoning: how a conclusion depends on its premises or evidence, and what strengthens or weakens it.',
            'Infer what follows from a passage and apply it to new situations.',
            'Identify relationships and analogies, spot contradictions and equivalences, and judge how effective an argument is.',
          ],
        },
      ],
    },
    {
      title: 'Quantitative Techniques',
      blocks: [
        {
          kind: 'text',
          text: 'The mathematics is at Class 10 level. You will derive, infer and manipulate numbers given in a passage, using operations such as:',
        },
        {
          kind: 'list',
          items: [
            'ratios and proportions',
            'basic algebra',
            'mensuration',
            'statistical estimation',
          ],
        },
        {
          kind: 'text',
          text: 'It is the smallest section, at about 10% of the paper, but the questions are short and the answers exact. Many candidates attempt it last, when time is short; it is often better done early, while you are fresh.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'Do I need to know law for CLAT?',
      answer:
        'No. The Consortium says no prior knowledge of law is required for Legal Reasoning. Every principle you need is in the passage.',
    },
    {
      question: 'What level of maths is in CLAT?',
      answer:
        'Class 10. The Consortium names ratios and proportions, basic algebra, mensuration and statistical estimation.',
    },
    {
      question: 'Is there a fixed list of current affairs topics?',
      answer:
        'No. Questions come from passages based on news and non-fiction, covering events in India and the world, arts and culture, international affairs and history of continuing importance.',
    },
    {
      question: 'Is there a separate syllabus PDF?',
      answer:
        'For CLAT 2027 the Consortium sets out the syllabus on its UG Syllabus web page, which this page is written from.',
    },
  ],
};

export const CLAT_CONTENT: ExamContentSet = {
  'exam-pattern': examPattern,
  syllabus,
};
