/**
 * NTA'S EXAMINATION CALENDAR, as published — one notice, transcribed.
 *
 * The notice is a scanned image, so a student cannot search it, copy from it,
 * or read it comfortably on a phone. This file is the same table as text.
 *
 * It is a TRANSCRIPTION, not a source of dates for the rest of the site. An
 * exam page still shows a date only after it has gone through the review
 * queue; this page shows what the notice says, says that NTA calls every date
 * tentative, and links the notice so anyone can check a row against it.
 *
 * Every row was read from page 2 of the notice and the day counts were checked
 * against NTA's own "Duration" column (CUET PG: 5 + 1 + 9 + 2 = 17 days).
 * When NTA issues a new calendar, replace this file whole rather than editing
 * rows — a half-updated calendar is worse than an old one that says its date.
 */

export type CalendarRow = {
  exam: string;
  dates: string;
  duration: string;
  /** Set when we have a page for this exam, so the row can link to it. */
  examSlug?: string;
};

export const NTA_CALENDAR = {
  title: 'NTA Exam Calendar: December 2026 to March 2027',
  noticeDate: '2026-09-16',
  checkedOn: '2026-10-08',
  source: {
    name: 'NTA public notice, 16 September 2026',
    url: 'https://www.nta.ac.in/Download/Notice/Notice_20260916195948.pdf',
  },
  /** Our copy of the same file, served as a download. */
  downloadUrl:
    'https://res.cloudinary.com/dukyebopv/raw/upload/fl_attachment:nta-exam-calendar-dec-2026-to-mar-2027/v1791411121/notices/nta-exam-calendar-dec-2026-to-mar-2027.pdf',
  downloadSize: '788 KB',
  months: [
    {
      month: 'December 2026',
      rows: [
        { exam: 'Rashtriya Indian Military College', dates: '6 Dec 2026', duration: '1 day' },
        { exam: 'SWAYAM', dates: '8 to 12 Dec 2026', duration: '5 days' },
        { exam: 'Rashtriya Military Schools', dates: '13 Dec 2026', duration: '1 day' },
        {
          exam: 'UGC NET (December cycle)',
          dates: '14 to 19 Dec 2026 (buffer: 20 and 21 Dec)',
          duration: '6 days',
        },
        {
          exam: 'Joint CSIR UGC NET (December cycle)',
          dates: '20 and 21 Dec 2026',
          duration: '2 days',
        },
      ],
    },
    {
      month: 'January 2027',
      rows: [
        { exam: 'Army Cadets College', dates: '4 Jan 2027', duration: '1 day' },
        {
          exam: 'SHRESHTA (NETS): Residential Education for Students in High Schools in Targeted Areas',
          dates: '10 Jan 2027',
          duration: '1 day',
        },
        {
          exam: 'NIFT Entrance Examination',
          dates: '10 Jan 2027',
          duration: '1 day',
          examSlug: 'nift',
        },
        {
          exam: 'JEE (Main), Session 1',
          dates: '22 to 24 and 28 to 30 Jan 2027 (buffer: 31 Jan)',
          duration: '6 days',
          examSlug: 'jee-main',
        },
        {
          exam: 'All India Sainik Schools Entrance Examination',
          dates: '31 Jan 2027',
          duration: '1 day',
        },
      ],
    },
    {
      month: 'February 2027',
      rows: [
        { exam: 'Common Management Admission Test (CMAT)', dates: '7 Feb 2027', duration: '1 day' },
        {
          exam: 'NITTT: National Initiative for Technical Teachers Training (Part 1)',
          dates: '26 and 27 Feb 2027',
          duration: '2 days',
        },
      ],
    },
    {
      month: 'March 2027',
      rows: [
        {
          exam: 'CUET (PG): Common University Entrance Test (Post-Graduate)',
          dates: '1 to 5, 8, 12 to 20, 24 and 25 March 2027 (buffer: 30 and 31 March)',
          duration: '17 days',
        },
        { exam: 'NITTT (Part 2)', dates: '5 and 7 March 2027', duration: '2 days' },
      ],
    },
  ],
} as const satisfies {
  title: string;
  noticeDate: string;
  checkedOn: string;
  source: { name: string; url: string };
  downloadUrl: string;
  downloadSize: string;
  months: ReadonlyArray<{ month: string; rows: readonly CalendarRow[] }>;
};

/** True when NTA's calendar has a row for this exam — the hub links here if so. */
export function isOnNtaCalendar(examSlug: string): boolean {
  return NTA_CALENDAR.months.some((month) =>
    month.rows.some((row) => 'examSlug' in row && row.examSlug === examSlug),
  );
}
