/**
 * OUR ESTIMATE for a date the authority has not announced yet.
 *
 * This is the one place on the site that says something the conducting body
 * has not. It exists because "To be announced" in October, about a form that
 * has opened in the last week of October two years running, leaves a student
 * with less than we could honestly tell them. So the rules are tight:
 *
 *   - An estimate is shown ONLY where no official date exists. The moment a
 *     reviewed fact fills the event, the estimate is not rendered at all.
 *   - It is always worded as likely, always under the "Estimated" badge, and
 *     always next to the past official dates it was worked out from.
 *   - It expires. `hideAfter` is the day the guess stops being useful; after
 *     it the tile goes back to "To be announced" rather than naming a window
 *     that has already passed.
 *   - It is tied to one cycle, so it cannot leak into next year's page.
 *
 * Never put an exam date here. An exam date is the number a student plans a
 * year around; it comes from the authority through the review queue or it is
 * not on the page.
 */

export type ExpectedDate = {
  /** Shown in the tile. Must read as an estimate on its own: "Likely …". */
  label: string;
  /** ISO date after which this estimate is no longer shown. */
  hideAfter: string;
};

export type ExpectedDates = {
  cycleYear: number;
  registration?: ExpectedDate;
  result?: ExpectedDate;
  /** The reasoning, in one or two sentences, with the past official dates. */
  basis: string;
  /** The official documents those past dates were read from. */
  sources: ReadonlyArray<{ name: string; url: string }>;
};

const EXPECTED: Readonly<Record<string, ExpectedDates>> = {
  'jee-main': {
    cycleYear: 2027,
    registration: { label: 'Likely late Oct 2026', hideAfter: '2026-11-30' },
    result: { label: 'Likely by mid-Feb 2027', hideAfter: '2027-02-28' },
    basis:
      'NTA has not announced the Session 1 registration or result dates for 2027. In the last two years the Session 1 form opened on 28 October 2024 and 31 October 2025 and stayed open for about four weeks, and NTA set the result for "by 12 February" both times.',
    sources: [
      {
        name: 'JEE (Main) 2026 Information Bulletin',
        url: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/11/202511021649722475.pdf',
      },
      {
        name: 'JEE (Main) 2025 Information Bulletin',
        url: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2024/10/2024102824.pdf',
      },
    ],
  },
};

function live(date: ExpectedDate | undefined, now: number): ExpectedDate | undefined {
  if (!date) return undefined;
  return now <= Date.parse(`${date.hideAfter}T23:59:59+05:30`) ? date : undefined;
}

/**
 * The estimates that still apply to this exam's current cycle, or undefined.
 * The caller decides whether an official date makes each one unnecessary.
 */
export function expectedFor(
  examSlug: string,
  cycleYear: number,
  now: number = Date.now(),
): ExpectedDates | undefined {
  const entry = EXPECTED[examSlug];
  if (!entry || entry.cycleYear !== cycleYear) return undefined;

  const registration = live(entry.registration, now);
  const result = live(entry.result, now);
  if (!registration && !result) return undefined;

  return {
    cycleYear: entry.cycleYear,
    basis: entry.basis,
    sources: entry.sources,
    ...(registration ? { registration } : {}),
    ...(result ? { result } : {}),
  };
}
