/**
 * SSC'S EXAMINATION CALENDAR for 2026-27, as published — one table, transcribed.
 *
 * SSC shows the calendar inside a page that only draws after its script has
 * run, with the official names of the exams and nothing else. This file is the
 * same twelve rows as text, plus the name each exam is commonly known by.
 *
 * Like the NTA calendar, it is a TRANSCRIPTION, not a source of dates for the
 * rest of the site. An exam page still shows a date only after it has gone
 * through the review queue; this page shows what SSC's calendar says, says
 * that SSC calls the whole calendar tentative, and links it so anyone can
 * check a row against it.
 *
 * The dates are facts and are given exactly as SSC gives them — a month where
 * SSC gives a month, a day where it gives a day. Every other word here
 * (`knownAs`, `stage`, the page copy) is ours. When SSC issues a new calendar,
 * replace this file whole rather than editing rows.
 */

export type SscCalendarRow = {
  /** The examination's name as SSC lists it. */
  exam: string;
  /** What candidates call it. Absent where there is no common short name. */
  knownAs?: string;
  /** The stage the calendar dates belong to, in plain words. */
  stage: string;
  /** When SSC planned to publish the notice. */
  advertised: string;
  /** Last date to apply. */
  closes: string;
  /** The month or months SSC planned the exam for. */
  examWindow: string;
  /** Last month of that window, `YYYY-MM`. Splits the page into ahead / passed. */
  windowEnd: string;
  /** Open only to serving staff, not a public recruitment. */
  departmental?: boolean;
  /** Set when we have a page for this exam, so the row can link to it. */
  examSlug?: string;
};

export const SSC_CALENDAR = {
  title: 'SSC Exam Calendar 2026-27',
  session: '2026-27',
  /** The "last updated" date SSC printed on the page when it was read. */
  sourceUpdatedOn: '2026-10-12',
  checkedOn: '2026-10-14',
  source: {
    name: 'SSC examination calendar, 2026-27',
    url: 'https://ssc.gov.in/for-candidates/examination-calendar',
  },
  rows: [
    {
      exam: 'JSA / LDC Grade Limited Departmental Competitive Examination, 2025 (for DoPT only)',
      stage: 'Paper 1, computer-based',
      advertised: '16 March 2026',
      closes: '7 April 2026',
      examWindow: 'May 2026',
      windowEnd: '2026-05',
      departmental: true,
    },
    {
      exam: 'SSA / UDC Grade Limited Departmental Competitive Examination, 2025 (for DoPT only)',
      stage: 'Paper 1, computer-based',
      advertised: '16 March 2026',
      closes: '7 April 2026',
      examWindow: 'May 2026',
      windowEnd: '2026-05',
      departmental: true,
    },
    {
      exam: 'ASO Grade Limited Departmental Competitive Examination, 2025',
      stage: 'Paper 1, computer-based',
      advertised: '16 March 2026',
      closes: '7 April 2026',
      examWindow: 'May 2026',
      windowEnd: '2026-05',
      departmental: true,
    },
    {
      exam: 'Combined Graduate Level Examination, 2026',
      knownAs: 'SSC CGL 2026',
      stage: 'Tier 1, computer-based',
      advertised: 'March 2026',
      closes: 'April 2026',
      examWindow: 'May to June 2026',
      windowEnd: '2026-06',
      examSlug: 'ssc-cgl',
    },
    {
      exam: 'Junior Engineer (Civil, Mechanical and Electrical) Examination, 2026',
      knownAs: 'SSC JE 2026',
      stage: 'Paper 1, computer-based',
      advertised: 'March 2026',
      closes: 'April 2026',
      examWindow: 'May to June 2026',
      windowEnd: '2026-06',
    },
    {
      exam: 'Selection Post Examination, Phase XIV, 2026',
      knownAs: 'SSC Selection Post Phase 14',
      stage: 'Computer-based exam',
      advertised: 'March 2026',
      closes: 'April 2026',
      examWindow: 'May to July 2026',
      windowEnd: '2026-07',
    },
    {
      exam: 'Combined Higher Secondary (10+2) Level Examination, 2026',
      knownAs: 'SSC CHSL 2026',
      stage: 'Tier 1, computer-based',
      advertised: 'April 2026',
      closes: 'May 2026',
      examWindow: 'July to September 2026',
      windowEnd: '2026-09',
      examSlug: 'ssc-chsl',
    },
    {
      exam: 'Stenographer Grade ‘C’ and ‘D’ Examination, 2026',
      knownAs: 'SSC Stenographer 2026',
      stage: 'Computer-based exam',
      advertised: 'April 2026',
      closes: 'May 2026',
      examWindow: 'August to September 2026',
      windowEnd: '2026-09',
    },
    {
      exam: 'Combined Hindi Translators Examination, 2026',
      knownAs: 'SSC CHT 2026',
      stage: 'Paper 1, computer-based',
      advertised: 'April 2026',
      closes: 'May 2026',
      examWindow: 'August to September 2026',
      windowEnd: '2026-09',
    },
    {
      exam: 'Multi-Tasking (Non-Technical) Staff and Havaldar (CBIC and CBN) Examination, 2026',
      knownAs: 'SSC MTS 2026',
      stage: 'Computer-based exam',
      advertised: 'June 2026',
      closes: 'July 2026',
      examWindow: 'September to November 2026',
      windowEnd: '2026-11',
    },
    {
      exam: 'Sub-Inspector in Delhi Police and Central Armed Police Forces Examination, 2026',
      knownAs: 'SSC CPO 2026',
      stage: 'Paper 1, computer-based',
      advertised: 'May 2026',
      closes: 'June 2026',
      examWindow: 'October to November 2026',
      windowEnd: '2026-11',
    },
    {
      exam: 'Constables (GD) in Central Armed Police Forces (CAPFs), NIA, SSF and Rifleman (GD) in Assam Rifles Examination, 2027',
      knownAs: 'SSC GD 2027',
      stage: 'Computer-based exam',
      advertised: 'September 2026',
      closes: 'October 2026',
      examWindow: 'January to March 2027',
      windowEnd: '2027-03',
    },
  ],
} as const satisfies {
  title: string;
  session: string;
  sourceUpdatedOn: string;
  checkedOn: string;
  source: { name: string; url: string };
  rows: readonly SscCalendarRow[];
};

/** The short forms the calendar uses without spelling them out. */
export const SSC_ABBREVIATIONS: ReadonlyArray<{ short: string; full: string }> = [
  { short: 'CBE', full: 'Computer Based Examination — taken on a computer at a test centre' },
  { short: 'CGL', full: 'Combined Graduate Level' },
  { short: 'CHSL', full: 'Combined Higher Secondary Level' },
  { short: 'MTS', full: 'Multi-Tasking Staff' },
  { short: 'GD', full: 'General Duty' },
  { short: 'CAPFs', full: 'Central Armed Police Forces' },
  { short: 'NIA', full: 'National Investigation Agency' },
  { short: 'SSF', full: 'Secretariat Security Force' },
  { short: 'CBIC', full: 'Central Board of Indirect Taxes and Customs' },
  { short: 'CBN', full: 'Central Bureau of Narcotics' },
  { short: 'JSA / LDC', full: 'Junior Secretariat Assistant / Lower Division Clerk' },
  { short: 'SSA / UDC', full: 'Senior Secretariat Assistant / Upper Division Clerk' },
  { short: 'ASO', full: 'Assistant Section Officer' },
  { short: 'DoPT', full: 'Department of Personnel and Training' },
];

/** The calendar's row for this exam, if it has one — the hub links here if so. */
export function sscCalendarRow(examSlug: string): SscCalendarRow | undefined {
  return SSC_CALENDAR.rows.find((row) => 'examSlug' in row && row.examSlug === examSlug);
}
