/**
 * WRITTEN GUIDANCE FOR AN EXAM'S PAPERS PAGE, keyed by exam slug.
 *
 * One registry rather than copy inside the route, for the reason
 * exam-sections.ts gives: the page is a template for every exam, and prose
 * about one exam does not belong in a template. An exam with no entry here
 * simply renders its papers.
 *
 * WHERE THE FACTS COME FROM. Nothing below is taken from another site's
 * article. The question counts, timings and marking rules were read out of the
 * papers themselves (each NTA paper prints its duration, total marks, the
 * number of questions per section and the marks for a right and wrong answer).
 * A claim the papers do not support is not made — which is why there is no
 * "most repeated chapters" list here: we have not counted them, and a guessed
 * list is worse than none.
 *
 * Keep it plain. These are read by seventeen-year-olds on a phone the night
 * before a mock test, not by a search engine.
 */

export type PaperGuide = {
  sections: ReadonlyArray<{
    title: string;
    paragraphs: readonly string[];
    points?: readonly string[];
  }>;
  faqs: ReadonlyArray<{ question: string; answer: string }>;
};

export const PAPER_GUIDES: Readonly<Record<string, PaperGuide>> = {
  'jee-main': {
    sections: [
      {
        title: 'What these files are',
        paragraphs: [
          'Each file is the paper NTA released after the exam: the same questions, in the same order, with the question ID printed next to each one. None of them is a memory-based paper rebuilt from what students remembered.',
          'Many of the files print every question twice, once in English and once in Hindi. That is why a 75-question paper can run past 60 pages. You are not looking at 150 questions.',
          'For some shifts NTA’s final answer key is here as well. It lists each question ID with the ID of the correct option, so keep the paper open beside it while you check.',
          'A few sittings are missing. We opened every file and left out the ones we could not match to a date and shift, along with any that turned out not to be an NTA paper.',
        ],
      },
      {
        title: 'How the paper has changed',
        paragraphs: [
          'The B.E./B.Tech paper has been 3 hours and 300 marks throughout, with 4 marks for a correct answer. What has moved is the number of questions and how much choice you get.',
        ],
        points: [
          '2020: 75 questions. Each subject had 20 multiple-choice questions and 5 numerical ones. A wrong numerical answer cost nothing.',
          '2021 to 2024: 90 questions printed, 75 to answer. Each subject had 20 multiple-choice questions and 10 numerical ones, and you picked any 5 of the 10. In the 2021 papers a wrong numerical answer cost nothing. In the 2023 and 2024 papers it cost 1 mark.',
          'From 2025: back to 75 questions with no choice. 20 multiple-choice and 5 numerical per subject, all compulsory. The 2025 papers take 1 mark off for any wrong answer, numerical ones included.',
        ],
      },
      {
        title: 'How to practise with them',
        paragraphs: [
          'Start with the newest year and work backwards. The recent papers follow the pattern you will actually sit.',
          'If you time yourself on a 2021 to 2024 paper, answer only 5 numerical questions per subject. Do all 10 and you have practised a longer exam than the real one.',
          'Do a full paper in one sitting: 3 hours, phone away, no pausing. Then mark it properly. For every wrong answer, note whether you did not know it, misread it, or ran out of time. Those are three different problems and they need different fixes.',
          'Two shifts on the same day are two different papers with different questions, so doing both is not repetition.',
          'B.Arch and B.Planning have their own papers. In the files here each is 3 hours and 400 marks, and the combined paper for students taking both is 3 hours 30 minutes and 500 marks.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Are these the official JEE Main papers?',
        answer:
          'Yes. Each file is the paper as NTA published it. We opened every one and checked the date and shift printed inside against the label on this page. Where the two disagreed, we went with what the paper says.',
      },
      {
        question: 'Do the papers come with solutions?',
        answer:
          'No. These are question papers. Where NTA’s final answer key is available you get the correct option for every question, but not worked solutions.',
      },
      {
        question: 'Why do some papers have 90 questions and others 75?',
        answer:
          'From 2021 to 2024 each subject had 10 numerical questions and you answered any 5, so 90 were printed and 75 counted. In 2020, and again from 2025, there are 5 numerical questions per subject and all of them are compulsory.',
      },
      {
        question: 'Why is every question printed twice?',
        answer:
          'Many of the files are bilingual. Each question appears in English and then in Hindi, which doubles the page count but not the number of questions.',
      },
      {
        question: 'Is there a paper for every shift?',
        answer:
          'No. We only list a paper once we have checked the file against its date and shift, so some sittings are not here yet.',
      },
      {
        question: 'Do I need to sign up to download?',
        answer: 'No. Every file opens directly, with no account and no form to fill in.',
      },
    ],
  },
};
