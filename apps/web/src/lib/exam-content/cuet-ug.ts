import type { ExamContent, ExamContentSet } from './types';

/**
 * CUET (UG) — exam pattern and syllabus.
 *
 * Written from NTA documents linked from cuet.nta.nic.in, read for this file
 * on 1 Nov 2026:
 *
 *   Information Bulletin, CUET (UG) 2026 — Chapters 2, 3 and 12, Appendix II
 *   CUET (UG) 2026 syllabus page, with the subject PDFs for English (101)
 *     and the General Aptitude Test (501)
 *   CUET (UG) 2026 FAQs — Q27, on the level of the questions
 *
 * Every number below is in one of those documents. CUET has 37 subject
 * syllabi; this file reproduces the two that almost every candidate takes
 * (a language and the General Aptitude Test) and links to the rest, rather
 * than summarising 35 documents nobody has checked line by line.
 *
 * When NTA publishes the 2027 bulletin, re-read Chapters 2, 3 and 12 and
 * Appendix II against this file before changing `checkedOn`. The subject
 * count has changed between years before.
 */

const BULLETIN = {
  name: 'CUET (UG) 2026 Information Bulletin',
  url: 'https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/01/202601031633478370.pdf',
  publishedBy: 'National Testing Agency',
} as const;

const SYLLABUS_PAGE = {
  name: 'CUET (UG) 2026 syllabus',
  url: 'https://cuet.nta.nic.in/cuetug-2026-syllabus/',
  publishedBy: 'National Testing Agency',
} as const;

const CHECKED_ON = '2026-11-01';

const CYCLE_NOTE =
  'This is the 2026 edition, the latest one NTA has published. When the 2027 bulletin comes out we will check this page against it.';

/** Appendix II of the 2026 bulletin, in NTA's own order and with its codes. */
const SUBJECTS: ReadonlyArray<readonly string[]> = [
  [
    '101–113',
    'Languages',
    'English, Hindi, Assamese, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu, Urdu',
  ],
  ['301', 'Domain', 'Accountancy / Book Keeping'],
  ['302', 'Domain', 'Agriculture'],
  ['303', 'Domain', 'Anthropology'],
  ['304', 'Domain', 'Biology / Biological Science / Biotechnology / Biochemistry'],
  ['305', 'Domain', 'Business Studies'],
  ['306', 'Domain', 'Chemistry'],
  ['307', 'Domain', 'Environmental Science'],
  ['308', 'Domain', 'Computer Science / Information Practices'],
  ['309', 'Domain', 'Economics / Business Economics'],
  ['312', 'Domain', 'Fine Arts / Visual Arts / Commercial Arts'],
  ['313', 'Domain', 'Geography / Geology'],
  ['314', 'Domain', 'History'],
  ['315', 'Domain', 'Home Science'],
  ['316', 'Domain', 'Knowledge Tradition – Practices in India'],
  ['318', 'Domain', 'Mass Media / Mass Communication'],
  ['319', 'Domain', 'Mathematics / Applied Mathematics'],
  ['320', 'Domain', 'Performing Arts (Dance, Drama, Music)'],
  ['321', 'Domain', 'Physical Education (Yoga, Sports)'],
  ['322', 'Domain', 'Physics'],
  ['323', 'Domain', 'Political Science'],
  ['324', 'Domain', 'Psychology'],
  ['325', 'Domain', 'Sanskrit'],
  ['326', 'Domain', 'Sociology'],
  ['501', 'General Aptitude Test', 'General Aptitude Test'],
];

const examPattern: ExamContent = {
  lede: 'Up to five one-hour tests on a computer, 50 questions each, marked +5 for a right answer and −1 for a wrong one. Which tests you take depends on the course you want.',
  source: BULLETIN,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'The exam at a glance',
      blocks: [
        {
          kind: 'table',
          caption: 'CUET (UG) scheme of examination',
          head: ['', 'CUET (UG) 2026'],
          rows: [
            [
              'Subjects offered',
              '37: 13 languages, 23 domain subjects and the General Aptitude Test',
            ],
            ['Subjects you can take', 'Up to 5, including languages and the General Aptitude Test'],
            ['Questions per test', '50, all compulsory'],
            ['Time per test', '60 minutes (PwBD candidates get 20 extra minutes per hour)'],
            ['Question type', 'Multiple choice'],
            ['Mode', 'Computer-based test (CBT) only'],
            [
              'Shifts',
              'Several shifts over the exam window, depending on candidates and subject choices',
            ],
          ],
        },
        {
          kind: 'text',
          text: 'There is no common paper that everyone sits. Each test is separate, and your choice of up to five should follow the admission rules of the universities and programmes you are aiming for, not just the subjects you studied in Class 12.',
        },
      ],
    },
    {
      title: 'Marking scheme',
      blocks: [
        {
          kind: 'table',
          caption: 'Marks for each kind of answer',
          head: ['Your answer', 'Marks'],
          rows: [
            ['Correct', '+5'],
            ['Wrong', '−1'],
            ['Not answered', '0'],
          ],
          foot: ['Maximum per test', '250'],
        },
        {
          kind: 'list',
          items: [
            'If more than one option is found correct after the answer-key challenge, +5 goes to everyone who marked any of the correct options.',
            'If no option is correct, or a question is wrong or dropped, every candidate who took that test gets +5.',
          ],
        },
        {
          kind: 'text',
          text: 'A wrong answer costs a fifth of what a right one earns, a lighter penalty than in NEET or JEE Main. With four options, a pure guess is worth +0.5 marks on average, so leaving many questions blank usually costs more than it saves.',
        },
      ],
    },
    {
      title: 'How your score is calculated',
      blocks: [
        {
          kind: 'text',
          text: 'Where a test is held in more than one shift, NTA converts each candidate’s raw marks into an NTA Score so that shifts of different difficulty can be compared. The method is set out in Appendix VI of the bulletin.',
        },
        {
          kind: 'list',
          items: [
            'Results are based on the final answer keys. There is no re-evaluation or re-checking.',
            'The 2026 NTA Score is valid for admission in 2026–27 only.',
            'NTA does not prepare a merit list or allot seats. Each university makes its own merit list from CUET scores and runs its own admissions.',
          ],
        },
      ],
    },
    {
      title: 'Languages',
      blocks: [
        {
          kind: 'text',
          text: 'Question papers are offered in 13 languages: English, Hindi, Assamese, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu and Urdu. Each paper is shown in English and the language you chose; if the two differ, the English version is final.',
        },
        {
          kind: 'text',
          text: 'Choose the medium carefully in the application form. It cannot be changed later, and you must use the same medium in the exam.',
        },
      ],
    },
    {
      title: 'Who can apply',
      blocks: [
        {
          kind: 'list',
          items: [
            'No age limit for the exam itself. A university may still have its own age rule for a programme.',
            'You must have passed Class 12 or an equivalent examination, or be appearing for it in the exam year.',
            'Accepted qualifications include Class 12 from any recognised Central or State board, NIOS senior secondary with at least five subjects, a three-year AICTE or state-board diploma, GCE A levels and the IB Diploma.',
          ],
        },
        {
          kind: 'text',
          text: 'Sitting CUET does not by itself make you eligible for a course. Each university sets its own subject, marks and reservation rules, and you must meet them for the programme you apply to.',
        },
      ],
    },
    {
      title: 'Application fee in 2026',
      blocks: [
        {
          kind: 'table',
          caption: 'CUET (UG) 2026 application fee',
          head: ['Category', 'Up to 3 subjects', 'Each extra subject'],
          rows: [
            ['General (UR)', '₹1,000', '₹400'],
            ['OBC-NCL / EWS', '₹900', '₹375'],
            ['SC / ST / PwD / PwBD / Third gender', '₹800', '₹350'],
            ['Centres outside India', '₹4,500', '₹1,800'],
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many subjects can I take in CUET (UG)?',
      answer:
        'Up to five, counting languages and the General Aptitude Test. In 2026 there were 37 to choose from.',
    },
    {
      question: 'Is there negative marking in CUET (UG)?',
      answer:
        'Yes. A correct answer earns 5 marks and a wrong answer loses 1. Unanswered questions score 0.',
    },
    {
      question: 'How long is each CUET (UG) test?',
      answer:
        '60 minutes for 50 compulsory questions. PwBD candidates get 20 extra minutes per hour.',
    },
    {
      question: 'Is there an age limit for CUET (UG)?',
      answer:
        'Not for the exam. Some universities set an age rule for particular programmes, so check the university’s own admission notice.',
    },
  ],
};

const syllabus: ExamContent = {
  lede: 'CUET (UG) has a separate syllabus for each of its 37 subjects. Here is the full list, with the language and General Aptitude Test syllabi that most candidates need.',
  source: SYLLABUS_PAGE,
  checkedOn: CHECKED_ON,
  cycleNote: CYCLE_NOTE,
  parts: [
    {
      title: 'All 37 subjects',
      blocks: [
        {
          kind: 'table',
          caption: 'CUET (UG) 2026 subjects and codes',
          head: ['Code', 'Type', 'Subject'],
          rows: SUBJECTS,
          note: 'Sanskrit (325) is a domain subject and is not translated into other languages.',
        },
        {
          kind: 'text',
          text: 'NTA publishes a separate syllabus PDF for every subject on its syllabus page, linked above. In NTA’s 2026 FAQs it says questions in every subject are set at the level of the NCERT syllabus, so for domain subjects your Class 12 NCERT books are the reference.',
        },
      ],
    },
    {
      title: 'Language tests (101–113)',
      blocks: [
        {
          kind: 'text',
          text: 'The English (101) syllabus lists two areas, and says questions will come from these topics but are not limited to them:',
        },
        {
          kind: 'table',
          caption: 'CUET (UG) English language syllabus',
          head: ['Area', 'What it covers'],
          rows: [
            [
              'Reading comprehension',
              'Three kinds of passage, each up to 300 words: factual, narrative and literary',
            ],
            [
              'Verbal ability',
              'Rearranging parts of a sentence, match the following, choosing the correct word, synonyms and antonyms',
            ],
          ],
        },
        {
          kind: 'text',
          text: 'You can take the language test in a different language from the medium you choose for your other tests, for example Hindi as your language and English for the rest. Check that the combination matches what your university asks for.',
        },
      ],
    },
    {
      title: 'General Aptitude Test (501)',
      blocks: [
        {
          kind: 'list',
          items: [
            'General knowledge and current affairs',
            'General mental ability and numerical ability',
            'Quantitative reasoning: simple use of arithmetic, algebra, geometry, mensuration and statistics',
            'Logical and analytical reasoning',
            'General science and environment literacy',
          ],
        },
        {
          kind: 'text',
          text: 'Whether you need the General Aptitude Test depends on the programme. Check the admission notice of each university you are applying to before you pick your five subjects.',
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'How many subjects are there in CUET (UG)?',
      answer:
        '37 in 2026: 13 languages, 23 domain-specific subjects and the General Aptitude Test.',
    },
    {
      question: 'Is the CUET (UG) syllabus based on NCERT?',
      answer:
        'NTA says questions in all subjects are set at the level of the NCERT syllabus. Each subject has its own syllabus PDF on the official site.',
    },
    {
      question: 'What is in the CUET General Aptitude Test?',
      answer:
        'General knowledge and current affairs, mental and numerical ability, basic quantitative reasoning, logical and analytical reasoning, and general science and environment literacy.',
    },
  ],
};

export const CUET_UG_CONTENT: ExamContentSet = {
  'exam-pattern': examPattern,
  syllabus,
};
