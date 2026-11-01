import type { ExamContent, ExamContentSet } from './types';

/**
 * SSC CGL — exam pattern and syllabus.
 *
 * Written from one document, read for this file on 1 Nov 2026:
 *
 *   Notice of Combined Graduate Level Examination, 2026 — Staff Selection
 *   Commission, published 21 May 2026 (132 pages). Paras 2, 5, 8, 10, 13
 *   (scheme of examination and indicative syllabus) and 16 (mode of
 *   selection).
 *
 * Every number below is in that notice. The syllabus tables shorten SSC's
 * topic lists for length; they never add a topic.
 *
 * SSC rewrites the notice every year and has changed the Tier-II scheme
 * between cycles before. Re-read Para 13 of the next notice against this file
 * before changing `checkedOn`.
 */

const NOTICE = {
  name: 'Notice of Combined Graduate Level Examination, 2026',
  url: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf',
  publishedBy: 'Staff Selection Commission',
} as const;

const CHECKED_ON = '2026-11-01';

const CYCLE_NOTE =
  'This is the CGL 2026 notice, the latest SSC has published. When the CGL 2027 notice comes out we will check this page against it.';

const examPattern: ExamContent = {
  lede: 'Two computer-based tiers. Tier-I is a one-hour screening test; your final rank comes from Tier-II alone.',
  source: NOTICE,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'How selection works',
      blocks: [
        {
          kind: 'list',
          items: [
            'Tier-I: everyone who applies sits it. Marks decide who is shortlisted, category-wise, for Tier-II.',
            'Tier-II: Paper-I for every candidate, plus Paper-II (Statistics) or Paper-III (Finance and Economics) only for those shortlisted for the posts that need them.',
            'The final merit list is prepared on Tier-II performance only. Tier-I marks do not carry forward.',
            'Before results, you rank the posts and departments you want through an online option form. You are not considered for any post you do not list.',
          ],
        },
      ],
    },
    {
      title: 'Tier-I',
      blocks: [
        {
          kind: 'table',
          caption: 'SSC CGL Tier-I questions and marks by section',
          head: ['Section', 'Questions', 'Marks'],
          rows: [
            ['A. General Intelligence and Reasoning', '25', '50'],
            ['B. General Awareness', '25', '50'],
            ['C. Quantitative Aptitude', '25', '50'],
            ['D. English Comprehension', '25', '50'],
          ],
          foot: ['Total', '100', '200'],
          note: '1 hour in all, with a sectional timer of 15 minutes for each section (20 minutes each, 1 hour 20 minutes in all, for candidates eligible for a scribe).',
        },
        {
          kind: 'list',
          items: [
            'Multiple choice, set in English and Hindi except the English Comprehension section.',
            'Each correct answer is worth 2 marks; each wrong answer loses 0.50.',
          ],
        },
      ],
    },
    {
      title: 'Tier-II, Paper-I (all candidates)',
      blocks: [
        {
          kind: 'table',
          caption: 'SSC CGL Tier-II Paper-I by section',
          head: ['Section', 'Subject', 'Questions', 'Marks', 'Time'],
          rows: [
            [
              'I',
              'A: Mathematical Abilities; B: Reasoning and General Intelligence',
              '30 + 30',
              '180',
              '1 hour (30 minutes per part)',
            ],
            [
              'II',
              'A: English Language and Comprehension; B: General Awareness',
              '45 + 25',
              '210',
              '1 hour (40 + 20 minutes)',
            ],
            ['III', 'Computer Knowledge Test', '20', '60', '15 minutes'],
            ['IV', 'Data Entry Speed Test', 'One task', 'Qualifying', '15 minutes'],
          ],
          note: 'Each question in Sections I to III is worth 3 marks. Candidates eligible for a scribe get extra time in every section.',
        },
        {
          kind: 'list',
          items: [
            'Paper-I runs in two sessions on the same day: Session-I is Sections I, II and III (2 hours 15 minutes); Session-II is the Data Entry Speed Test.',
            'You must qualify every section of Paper-I separately.',
            'Negative marking: 1 mark for each wrong answer in Sections I, II and III.',
            'The Computer Knowledge Test and the Data Entry Speed Test are qualifying only, but posts that need computer proficiency or data entry set a higher bar in both.',
            'The Data Entry Speed Test is a passage of about 2,000 key depressions in 15 minutes.',
          ],
        },
      ],
    },
    {
      title: 'Tier-II, Papers II and III (some posts only)',
      blocks: [
        {
          kind: 'table',
          caption: 'SSC CGL Tier-II Paper-II and Paper-III',
          head: ['Paper', 'Who takes it', 'Questions', 'Marks', 'Time'],
          rows: [
            [
              'Paper-II: Statistics',
              'Candidates shortlisted for Junior Statistical Officer and Statistical Investigator Grade-II',
              '100',
              '200',
              '2 hours',
            ],
            [
              'Paper-III: General Studies (Finance and Economics)',
              'Candidates shortlisted for Assistant Audit Officer and Assistant Accounts Officer',
              '100',
              '200',
              '2 hours',
            ],
          ],
          note: 'Each question is worth 2 marks, with 0.50 deducted for a wrong answer. Candidates eligible for a scribe get 2 hours 40 minutes.',
        },
      ],
    },
    {
      title: 'Minimum qualifying marks',
      blocks: [
        {
          kind: 'table',
          caption: 'Minimum marks to qualify each scored stage',
          head: [
            'Category',
            'Tier-I and each scored part of Tier-II',
            'Data Entry Speed Test: maximum errors',
          ],
          rows: [
            ['UR', '30%', '20%'],
            ['OBC / EWS', '25%', '25%'],
            ['All other categories', '20%', '30%'],
          ],
          note: 'These are the minimums to qualify. The cut-offs SSC sets for shortlisting and selection, category by category, can be higher.',
        },
      ],
    },
    {
      title: 'Who can apply',
      blocks: [
        {
          kind: 'list',
          items: [
            'Qualification: a bachelor’s degree from a recognised university, held by 01.08.2026. Final-year students can apply if they hold the degree by that date.',
            'Junior Statistical Officer also needs 60% in Class 12 Mathematics or Statistics as a degree subject. Statistical Investigator Grade-II needs a degree in a listed subject such as Statistics, Mathematics, Economics or Computer Science.',
            'Age is counted as on 01.08.2026 and the limit depends on the post: 18–27, 18–30, 20–30 or 18–32 years.',
            'Upper age relaxation includes 5 years for SC/ST, 3 years for OBC and 10 years for PwBD (13 for PwBD-OBC, 15 for PwBD-SC/ST).',
          ],
        },
        {
          kind: 'table',
          caption: 'Age limits by post group in CGL 2026',
          head: ['Age limit', 'Born between'],
          rows: [
            ['18–27 years', '02.08.1999 and 01.08.2008'],
            ['18–30 years', '02.08.1996 and 01.08.2008'],
            ['20–30 years', '02.08.1996 and 01.08.2006'],
            ['18–32 years', '02.08.1994 and 01.08.2008'],
          ],
          note: '18–32 applies only to Junior Statistical Officer. 20–30 applies to Assistant Section Officer in the CSS, Railways, MEA and AFHQ, and to Sub Inspector in the CBI.',
        },
      ],
    },
    {
      title: 'Fee in 2026',
      blocks: [
        {
          kind: 'text',
          text: 'The application fee was ₹100. Women, SC, ST, PwBD and eligible Ex-Servicemen candidates pay no fee.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many tiers are there in SSC CGL?',
      answer:
        'Two, both computer-based. Tier-I is a screening test; the final merit list is made on Tier-II marks only.',
    },
    {
      question: 'Is there negative marking in SSC CGL?',
      answer:
        'Yes. 0.50 marks per wrong answer in Tier-I and in Tier-II Papers II and III, and 1 mark per wrong answer in Sections I to III of Tier-II Paper-I.',
    },
    {
      question: 'Do Tier-I marks count in the SSC CGL final result?',
      answer:
        'No. Tier-I only decides who goes to Tier-II. The final merit list uses Tier-II marks alone.',
    },
    {
      question: 'Can final-year students apply for SSC CGL?',
      answer:
        'Yes, if they will hold their bachelor’s degree by the cut-off date, which was 01.08.2026 for CGL 2026.',
    },
  ],
};

const syllabus: ExamContent = {
  lede: 'What SSC CGL tests in each tier, from the indicative syllabus in SSC’s 2026 notice.',
  source: NOTICE,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'Level of the questions',
      blocks: [
        {
          kind: 'table',
          caption: 'Standard each part of SSC CGL is set at',
          head: ['Part', 'Level'],
          rows: [
            ['Tier-I Reasoning, General Awareness, English Comprehension', 'Graduation'],
            ['Tier-I Quantitative Aptitude', 'Class 10'],
            ['Tier-II Mathematical Abilities', 'Matriculation (Class 10)'],
            ['Tier-II English Language and Comprehension', 'Class 12 (10+2)'],
            ['Tier-II Paper-II and Paper-III', 'Graduation'],
          ],
        },
        {
          kind: 'text',
          text: 'SSC calls this an indicative syllabus: it shows the ground the questions cover. The tables below shorten SSC’s topic lists; the notice has every topic in full.',
        },
      ],
    },
    {
      title: 'Tier-I',
      blocks: [
        {
          kind: 'table',
          caption: 'SSC CGL Tier-I syllabus',
          head: ['Section', 'What it covers'],
          rows: [
            [
              'General Intelligence and Reasoning',
              'Verbal and non-verbal reasoning: analogies, classification, number and figural series, coding-decoding, Venn diagrams, syllogisms, space visualisation, paper folding and punched holes, embedded figures, critical thinking',
            ],
            [
              'General Awareness',
              'Current events, everyday science, and India and its neighbours: history, culture, geography, the economy, general policy and scientific research',
            ],
            [
              'Quantitative Aptitude',
              'Number system, percentage, ratio, averages, interest, profit and loss, mixtures, time and work, time and distance, school algebra, geometry, mensuration, trigonometry, heights and distances, charts and graphs',
            ],
            [
              'English Comprehension',
              'Understanding correct English, basic comprehension and writing ability',
            ],
          ],
        },
      ],
    },
    {
      title: 'Tier-II, Paper-I',
      blocks: [
        {
          kind: 'table',
          caption: 'SSC CGL Tier-II Paper-I syllabus',
          head: ['Part', 'What it covers'],
          rows: [
            [
              'Mathematical Abilities',
              'Number systems, arithmetic (percentages, ratio, averages, interest, profit and loss, mixtures, time and work, time and distance), algebra, geometry, mensuration, trigonometry, statistics and probability',
            ],
            [
              'Reasoning and General Intelligence',
              'The same verbal and non-verbal question types as Tier-I, including emotional and social intelligence',
            ],
            [
              'English Language and Comprehension',
              'Vocabulary, grammar, error spotting, fill in the blanks, idioms, one-word substitution, active and passive voice, direct and indirect speech, sentence and paragraph rearrangement, cloze test, and three or more comprehension passages',
            ],
            [
              'General Awareness',
              'As in Tier-I: current events, everyday science, and India’s history, culture, geography, economy and policy',
            ],
            [
              'Computer Knowledge',
              'Computer basics and memory, Windows and MS Office (Word, Excel, PowerPoint), internet, e-mail and e-banking, networking basics and cyber security',
            ],
          ],
        },
        {
          kind: 'text',
          text: 'Of the comprehension passages in English, at least one is a simple passage from a book or story, and the others are on current affairs from a report or an editorial.',
        },
      ],
    },
    {
      title: 'Tier-II, Paper-II: Statistics',
      blocks: [
        {
          kind: 'list',
          items: [
            'Collection, classification and presentation of data',
            'Measures of central tendency and dispersion; moments, skewness and kurtosis',
            'Correlation and regression',
            'Probability theory, random variables and probability distributions (binomial, Poisson, normal, exponential)',
            'Sampling theory and statistical inference: estimation and tests based on Z, t, chi-square and F',
            'Analysis of variance, time series analysis and index numbers',
          ],
        },
      ],
    },
    {
      title: 'Tier-II, Paper-III: General Studies (Finance and Economics)',
      blocks: [
        {
          kind: 'table',
          caption: 'SSC CGL Tier-II Paper-III syllabus',
          head: ['Part', 'Marks', 'What it covers'],
          rows: [
            [
              'A: Finance and Accounts',
              '80',
              'Financial accounting concepts and conventions, double entry, journals and ledgers, trial balance, final accounts, depreciation, inventories, non-profit accounts, bills of exchange',
            ],
            [
              'B: Economics and Governance',
              '120',
              'The CAG and the Finance Commission; demand and supply, production and cost, market forms; the Indian economy, national income, poverty and unemployment; economic reforms since 1991; money, banking, the RBI, budgets and the FRBM Act; IT in governance',
            ],
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'Is the SSC CGL syllabus the same for Tier-I and Tier-II?',
      answer:
        'The subjects overlap, but Tier-II goes further: English is at Class 12 level with longer comprehension, and it adds a Computer Knowledge Test, a Data Entry Speed Test and, for some posts, Statistics or Finance and Economics.',
    },
    {
      question: 'At what level is SSC CGL Quantitative Aptitude?',
      answer:
        'Class 10. SSC sets Tier-I Quantitative Aptitude and Tier-II Mathematical Abilities at matriculation level.',
    },
    {
      question: 'Who has to study Statistics for SSC CGL?',
      answer:
        'Only candidates shortlisted after Tier-I for Junior Statistical Officer or Statistical Investigator Grade-II. They take Tier-II Paper-II.',
    },
  ],
};

export const SSC_CGL_CONTENT: ExamContentSet = {
  'exam-pattern': examPattern,
  syllabus,
};
