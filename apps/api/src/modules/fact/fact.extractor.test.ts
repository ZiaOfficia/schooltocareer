import { describe, expect, it } from 'vitest';

import { extractFacts, htmlToText, parseDate, riskOf, toDateRange } from './fact.extractor.js';

/**
 * The extractor is pure, so these tests are the real specification of what the
 * system will and will not claim about an official page.
 *
 * The fixtures are SHAPED FROM THE STORED SNAPSHOTS, not invented: the GATE
 * table really is rendered twice with different dates under one label, and
 * jeeadv.ac.in really is an announcement feed full of dates that are not the
 * exam date. Both of those produced a wrong answer from the first version of
 * this file, which is why they are pinned here.
 *
 * Years are derived from the clock rather than hard-coded. The extractor
 * refuses dates more than three years out — correctly, since a 2099 match is a
 * misparse — and a fixture pinned to a literal year would start failing on a
 * calendar boundary for reasons that have nothing to do with the code.
 */

const Y = new Date().getUTCFullYear();

describe('parseDate', () => {
  it('reads every date shape the watched pages actually use', () => {
    expect(parseDate(`23 June ${Y}`)).toBe(`${Y}-06-23`);
    expect(parseDate(`23rd June, ${Y}`)).toBe(`${Y}-06-23`);
    expect(parseDate(`June 23, ${Y}`)).toBe(`${Y}-06-23`);
    expect(parseDate(`23.06.${Y}`)).toBe(`${Y}-06-23`);
    expect(parseDate(`23/06/${Y}`)).toBe(`${Y}-06-23`);
    expect(parseDate(`23-Jun-${Y}`)).toBe(`${Y}-06-23`);
  });

  it('reads bare numeric dates DAY-FIRST, as Indian authorities write them', () => {
    // The whole risk: 06/07 is a valid date under either reading, so a
    // month-first parse produces a real but wrong day with nothing to flag it.
    expect(parseDate(`06/07/${Y}`)).toBe(`${Y}-07-06`);
  });

  it('rejects a date that does not exist rather than rolling it over', () => {
    // `new Date(Y, 1, 31)` silently becomes 3 March. A page we misread must
    // yield nothing, never a plausible-looking wrong date.
    expect(parseDate(`31 February ${Y}`)).toBeNull();
    expect(parseDate(`31/02/${Y}`)).toBeNull();
    expect(parseDate(`45/13/${Y}`)).toBeNull();
  });

  it('rejects years outside the window an exam schedule can occupy', () => {
    // Copyright lines, phone numbers and misparses all look like dates.
    expect(parseDate('23 June 1999')).toBeNull();
    expect(parseDate('23 June 2099')).toBeNull();
  });

  it('is not a date at all', () => {
    expect(parseDate('coming soon')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('htmlToText', () => {
  it('keeps block boundaries, so a label and the cell next to it stay distinct', () => {
    const text = htmlToText('<td>Exam Date</td><td>23 June 2026</td>');
    expect(text).toContain('|');
    expect(text).toContain('Exam Date');
  });

  it('drops scripts, so a date inside a JSON blob is never read as content', () => {
    const text = htmlToText('<script>var d = "23 June 2026";</script><p>Nothing here</p>');
    expect(text).not.toContain('23 June');
  });

  it('keeps an ordinal suffix attached to its day', () => {
    // GATE 2027's markup. As a cell boundary this read "14 | th | August".
    expect(htmlToText('<td>14<sup>th</sup> August 2026</td>')).toContain('14th August 2026');
  });

  it('drops struck-through text, which the authority has withdrawn', () => {
    const text = htmlToText(
      '<td><del><span>21<sup>st</sup> September 2026</span></del><br><span>5<sup>th</sup> October 2026</span></td>',
    );
    expect(text).not.toContain('September');
    expect(text).toContain('5th October 2026');
  });
});

/**
 * The GATE 2027 IMPORTANT DATES table, as IIT Madras published it on
 * 2026-10-03 — trimmed to the rows that matter, markup kept as served.
 *
 * Two things about it broke the v1 extractor outright: every day carries a
 * <sup> ordinal, and revised deadlines keep the old dates struck through in
 * <del> ahead of the new one.
 */
const GATE_2027_TABLE = `
<table><tr><th>Activity</th><th>Date*</th><th>Day</th></tr>
<tr><td><span>Opening Date of <a href="/guideline/"> GATE Online Application Processing System (GOAPS) </a></span></td>
<td><del><span>14<sup>th</sup> August 2026</span></del><br><del><span>27<sup>th</sup> August 2026</span></del><br><span>2<sup>nd</sup> September 2026</span></td>
<td><del><span>Friday</span></del><br><del><span>Thursday</span></del><br><span>Wednesday</span></td></tr>
<tr><td><span>Closing Date of REGULAR online registration (without late fee)</span></td>
<td><del><span>21<sup>st</sup> September 2026 <br> 27<sup>th</sup> September 2026</span></del><br><span>5<sup>th</sup> October 2026</span></td>
<td><del><span>Monday<br>Sunday</span></del><br><span>Monday</span></td></tr>
<tr><td><span>Closing Date of EXTENDED online registration (with late fee)</span></td>
<td><del><span>30<sup>th</sup> September 2026 <br> 5<sup>th</sup> October 2026</span></del><br>12<sup>th</sup> October 2026</td>
<td><del><span>Wednesday<br>Monday</span></del><br>Monday</td></tr>
<tr><td><span>Opening Date of GATE 2027 Application rectification</span></td><td><span>14<sup>th</sup> October 2026</span></td><td><span>Wednesday</span></td></tr>
<tr><td><span>Closing Date of GATE 2027 Application rectification</span></td><td><span>21<sup>st</sup> October 2026</span></td><td><span>Wednesday</span></td></tr>
<tr><td><span>City allotment notification</span></td><td><span>4<sup>th</sup> January 2027</span></td><td><span>Monday</span></td></tr>
<tr><td rowspan="3"><span>GATE 2027 Examinations</span></td><td>6<sup>th</sup> February 2027<br>7<sup>th</sup> February 2027</td><td>Saturday<br>Sunday</td></tr>
<tr><td>13<sup>th</sup> February 2027<br>14<sup>th</sup> February 2027</td><td>Saturday<br>Sunday</td></tr>
<tr><td>20<sup>th</sup> February 2027<br>21<sup>st</sup> February 2027</td><td>Saturday<br>Sunday</td></tr>
<tr><td><span>Announcement of results</span></td><td><span>19<sup>th</sup> March 2027</span></td><td><span>Friday</span></td></tr>
</table>
<p>*All dates are liable to change</p>
<p>${'Graduate Aptitude Test in Engineering, organised by IIT Madras. '.repeat(5)}</p>`;

describe('extractFacts — the GATE 2027 table (struck-through revisions, <sup> ordinals)', () => {
  const byType = (type: string) => {
    const result = extractFacts({ body: GATE_2027_TABLE, truncated: false });
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    return result.observations.find((o) => o.factType === type);
  };

  it('reads the current opening date, not the struck-through ones', () => {
    expect(byType('APPLICATION_START')?.normalizedValue).toBe('2026-09-02');
  });

  it('reads the regular deadline — not the late-fee one, and not rectification', () => {
    // 5 Oct. The late-fee close is 12 Oct, and the rectification window closes
    // on 21 Oct; both are real dates under a "Closing Date" label.
    expect(byType('APPLICATION_END')?.normalizedValue).toBe('2026-10-05');
  });

  it('reads the exam as the span of all six days', () => {
    expect(byType('EXAM_DATE')?.normalizedValue).toBe('2027-02-06/2027-02-21');
  });

  it('reads the result date', () => {
    expect(byType('RESULT_DATE')?.normalizedValue).toBe('2027-03-19');
  });

  it('marks every value tentative, because the page says all dates may change', () => {
    const result = extractFacts({ body: GATE_2027_TABLE, truncated: false });
    expect(result.ok && result.observations.every((o) => o.isTentative)).toBe(true);
  });
});

describe('riskOf', () => {
  it('rates the two facts that cost a student a year as CRITICAL', () => {
    expect(riskOf('EXAM_DATE')).toBe('CRITICAL');
    expect(riskOf('APPLICATION_END')).toBe('CRITICAL');
  });

  it('rates a link lower than a deadline — a dead end is not a missed year', () => {
    expect(riskOf('OFFICIAL_APPLICATION_URL')).toBe('MEDIUM');
  });
});

describe('extractFacts — refusals', () => {
  it('REFUSES a truncated body outright', () => {
    // The stored body may have lost the half of the table saying "WITH LATE
    // FEE", which would turn the extended deadline into the real one.
    const result = extractFacts({
      body: `<p>Date of Examination: 23 June ${Y}</p>`,
      truncated: true,
    });
    expect(result).toEqual({ ok: false, reason: 'TRUNCATED' });
  });

  it('reports an empty body as NO_BODY, not as "nothing found"', () => {
    expect(extractFacts({ body: null, truncated: false })).toEqual({
      ok: false,
      reason: 'NO_BODY',
    });
  });

  it('reports a JavaScript shell as NO_TEXT', () => {
    // iimcat.ac.in stores 1.9 kB of markup that reduces to 12 characters of
    // text. That is a fetch-strategy problem, and calling it "no facts today"
    // would hide it forever.
    const result = extractFacts({
      body: '<html><body><div id="root"></div><script>boot()</script></body></html>',
      truncated: false,
    });
    expect(result).toEqual({ ok: false, reason: 'NO_TEXT' });
  });
});

/** Padding so a focused fixture clears the JS-shell floor. */
const PAD = `<p>${'This page is published by the conducting authority. '.repeat(6)}</p>`;

describe('extractFacts — label anchoring', () => {
  it('reads a labelled exam date and nothing else', () => {
    const result = extractFacts({
      body: `${PAD}<table><tr><td>Date of Examination</td><td>23 June ${Y}</td></tr></table>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exam = result.observations.find((o) => o.factType === 'EXAM_DATE');
    expect(exam?.normalizedValue).toBe(`${Y}-06-23`);
    expect(exam?.rawValue).toBe(`23 June ${Y}`);
    expect(exam?.confidence).toBe('HIGH');
  });

  it('ignores a date that has no label near it', () => {
    // The jeeadv.ac.in failure mode: an announcement feed is wall-to-wall real
    // dates ("Round 5 deadline", "[Posted on July 16]") and not one of them is
    // the exam date.
    const result = extractFacts({
      body: `${PAD}<p>[ Posted on July 16, ${Y}, 17:30 IST ] Round 5 seat acceptance closes 20 July ${Y}.</p>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observations).toHaveLength(0);
  });

  it('keeps the with-late-fee deadline out of APPLICATION_END', () => {
    // A substring match treats these as the same fact. Publishing the late-fee
    // date as "the" deadline tells a student they have another week.
    const result = extractFacts({
      body: `${PAD}<p>Online registration closes (with late fee): 13 October ${Y}</p>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observations.find((o) => o.factType === 'APPLICATION_END')).toBeUndefined();
  });

  it('does not let one row of a dates table steal another row’s date', () => {
    const result = extractFacts({
      body:
        `${PAD}<table>` +
        `<tr><td>Date of Examination</td><td>23 June ${Y}</td></tr>` +
        `<tr><td>Application fee</td><td>Rs 3000</td></tr>` +
        `<tr><td>Last date for submission of online application form</td><td>27 April ${Y}</td></tr>` +
        `</table>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exam = result.observations.find((o) => o.factType === 'EXAM_DATE');
    const close = result.observations.find((o) => o.factType === 'APPLICATION_END');

    // Each label owns exactly its own date — not an invented range spanning
    // April to June, which is what a naive 160-character window produced.
    expect(exam?.normalizedValue).toBe(`${Y}-06-23`);
    expect(exam?.confidence).toBe('HIGH');
    expect(close?.normalizedValue).toBe(`${Y}-04-27`);
    expect(close?.confidence).toBe('HIGH');
  });

  it('reads a DATE-FIRST row, which is how the real GATE table is written', () => {
    // Regression for the worst bug this module has had. A forward-only scan
    // could not see a value written BEFORE its label, so it paired every row
    // with the next row's date — off by one, silently, down the whole table.
    const result = extractFacts({
      body: `${PAD}<div>March 19, ${Y}</div><div>ANNOUNCEMENT OF RESULTS</div><div>Venue as printed</div>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const declared = result.observations.find((o) => o.factType === 'RESULT_DATE');
    expect(declared?.normalizedValue).toBe(`${Y}-03-19`);
    expect(declared?.confidence).toBe('HIGH');
  });

  it('ignores a label mentioned in prose two boundaries from any date', () => {
    // Verbatim shape from gate2026.iitg.ac.in. The sentence contains the words
    // "announcement of results" and is followed, two cells later, by the
    // REGISTRATION OPENING date. The first version of this module published
    // that as the result date, at HIGH confidence.
    const result = extractFacts({
      body:
        `${PAD}<p>The score remains valid for THREE years from the date of announcement of results.</p>` +
        `<h3>IMPORTANT DATES</h3><div>August 25, ${Y}</div>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observations.find((o) => o.factType === 'RESULT_DATE')).toBeUndefined();
  });

  it('does not mistake a "Posted on" stamp for a scheduled date', () => {
    // jeeadv.ac.in stamps every announcement, so the publication date sits
    // exactly one boundary before the heading — positionally identical to a
    // date-first table cell, and distinguishable only by the words in front
    // of it.
    const result = extractFacts({
      body:
        `${PAD}<p>[ Posted on December 06, ${Y} ]</p><h3>JEE (Advanced) Examination Date</h3>` +
        `<p>JEE (Advanced) will be held on Sunday, 17th May, ${Y}.</p>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exam = result.observations.find((o) => o.factType === 'EXAM_DATE');
    expect(exam?.normalizedValue).toBe(`${Y}-05-17`);
    // The posting date is gone, so this is unambiguous rather than a range
    // running from December to May.
    expect(exam?.confidence).toBe('HIGH');
  });
});

describe('extractFacts — ambiguity, measured from the real GATE page', () => {
  /**
   * gate2026.iitg.ac.in renders its IMPORTANT DATES table twice, so one label
   * genuinely resolves to several different dates. This is the case that makes
   * the confidence signal necessary rather than decorative.
   */
  /**
   * THE REAL GATE TABLE, reproduced structurally.
   *
   * Verbatim wording and ordering from the stored snapshot of
   * gate2026.iitg.ac.in, with the real 2025/2026 dates — this fixture is
   * pinned to those actual dates rather than to the clock, because the whole
   * point is the relationship between the values.
   *
   * Three separate traps in one table:
   *   1. rows are DATE-then-LABEL
   *   2. single-value rows are RESTATED once per revision, with the superseded
   *      entries struck through — formatting that text extraction destroys
   *   3. the exam row is genuinely multi-day
   */
  const gateBody =
    `${PAD}<h3>IMPORTANT DATES</h3>` +
    `<div>August 25, 2025:</div><div>ONLINE REGISTRATION OPENS</div>` +
    `<div>August 28, 2025:</div><div>ONLINE REGISTRATION OPENS</div>` +
    `<div>September 25, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITHOUT LATE FEE)</div>` +
    `<div>September 28, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITHOUT LATE FEE)</div>` +
    `<div>October 06, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITHOUT LATE FEE)</div>` +
    `<div>October 07, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITHOUT LATE FEE)</div>` +
    `<div>October 06, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITH LATE FEE)</div>` +
    `<div>October 13, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITH LATE FEE)</div>` +
    `<div>January 13, 2026:</div><div>Admit Cards available for download</div>` +
    // Each date and weekday in its OWN cell, exactly as the stored snapshot
    // renders them. An earlier version of this fixture packed them into one
    // cell, which let a broken extractor pass: against the real page it
    // returned 7 February alone and called that the exam date.
    `<div>GATE 2026 Examinations</div>` +
    `<div>February 07, 2026</div><div>Saturday</div>` +
    `<div>February 08, 2026</div><div>Sunday</div>` +
    `<div>February 14, 2026</div><div>Saturday</div>` +
    `<div>February 15, 2026</div><div>Sunday</div>` +
    `<div>March 19, 2026:</div><div>ANNOUNCEMENT OF RESULTS</div>` +
    `<p>Dates are liable to change.</p>`;

  it('reads a restated deadline as a revision history and takes the LATEST', () => {
    // THE DEFECT THIS FIXES. The page restates the row each time the deadline
    // moves: 25 Sep -> 28 Sep -> 6 Oct -> 7 Oct. Read as rival values that is
    // an unresolvable contradiction, and the extractor emitted the nonsense
    // range "2025-09-25/2025-10-07". Read as an extension history — which is
    // the only thing a strictly increasing restated series can be — the answer
    // is 7 October.
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const close = result.observations.find((o) => o.factType === 'APPLICATION_END');
    expect(close?.normalizedValue).toBe('2025-10-07');
    expect(close?.confidence).toBe('MEDIUM');
    // Every superseded value stays in the evidence: the reviewer must be able
    // to see that the date moved three times.
    expect(close?.evidence).toContain('2025-09-25');
    expect(close?.evidence).toContain('2025-10-07');
  });

  it('never lets the with-late-fee deadline become the deadline', () => {
    // 13 October is the extended, fee-paying deadline. Publishing it as "the"
    // last date tells a student they have another week and costs them the fee.
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const close = result.observations.find((o) => o.factType === 'APPLICATION_END');
    expect(close?.normalizedValue).not.toContain('2025-10-13');
  });

  it('reads a restated opening date the same way', () => {
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const open = result.observations.find((o) => o.factType === 'APPLICATION_START');
    expect(open?.normalizedValue).toBe('2025-08-28');
  });

  it('treats the multi-day exam row as a SPAN, not a revision series', () => {
    // Same shape of data, opposite meaning. An exam can occupy four days; a
    // deadline cannot, which is why only EXAM_DATE keeps the full range.
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exam = result.observations.find((o) => o.factType === 'EXAM_DATE');
    expect(exam?.normalizedValue).toBe('2026-02-07/2026-02-15');
    expect(exam?.confidence).toBe('MEDIUM');
  });

  it('still reads the unambiguous row on an otherwise messy page', () => {
    // Ambiguity elsewhere must not degrade a row that is perfectly clear —
    // otherwise the queue fills with LOW items nobody can act on.
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const declared = result.observations.find((o) => o.factType === 'RESULT_DATE');
    expect(declared?.normalizedValue).toBe('2026-03-19');
    expect(declared?.confidence).toBe('HIGH');
  });

  /**
   * THE FUTURE-REVISION TEST.
   *
   * Proves the extractor UNDERSTANDS the table rather than happening to match
   * today's values. When the authority extends the deadline again, the newly
   * appended row must become the answer and the comparison must see a change.
   */
  it('follows the deadline when the authority extends it again', () => {
    const extended = gateBody.replace(
      `<div>October 07, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITHOUT LATE FEE)</div>`,
      `<div>October 07, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITHOUT LATE FEE)</div>` +
        `<div>October 20, 2025:</div><div>ONLINE REGISTRATION CLOSES (WITHOUT LATE FEE)</div>`,
    );

    const before = extractFacts({ body: gateBody, truncated: false });
    const after = extractFacts({ body: extended, truncated: false });
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;

    const was = before.observations.find((o) => o.factType === 'APPLICATION_END');
    const now = after.observations.find((o) => o.factType === 'APPLICATION_END');

    expect(was?.normalizedValue).toBe('2025-10-07');
    expect(now?.normalizedValue).toBe('2025-10-20');
    // Different normalised values is precisely what the semantic comparison
    // turns into a FactChange. Identical ones produce nothing, however much
    // the surrounding markup moved.
    expect(now?.normalizedValue).not.toBe(was?.normalizedValue);
  });

  it('produces NO change when the page is restyled but states the same dates', () => {
    // The other half of the contract, and the reason the comparison is on the
    // normalised value rather than on the body hash.
    const restyled = gateBody
      .replace(/<div>/g, '<td class="dt">')
      .replace(/<\/div>/g, '</td>')
      .replace('September 25, 2025:', '25 September 2025');

    const a = extractFacts({ body: gateBody, truncated: false });
    const b = extractFacts({ body: restyled, truncated: false });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const va = a.observations.find((o) => o.factType === 'APPLICATION_END')?.normalizedValue;
    const vb = b.observations.find((o) => o.factType === 'APPLICATION_END')?.normalizedValue;
    expect(vb).toBe(va);
  });

  it('rejects a date that contradicts the weekday printed beside it', () => {
    // The page's own checksum. 7 February 2026 is a Saturday; a parse that
    // yields 2 July would be silently wrong without this, since both are real
    // dates. Twelve of twelve dates in the real table agree with their day.
    const wrong = `${PAD}<div>GATE 2026 Examinations</div><div>February 07, 2026 Tuesday</div>`;
    const result = extractFacts({ body: wrong, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.observations.find((o) => o.factType === 'EXAM_DATE')).toBeUndefined();
    expect(result.rejected).toBeGreaterThan(0);
  });

  it('carries an explicit schedule disclaimer through to every date', () => {
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // "Dates are liable to change." is a statement about the whole table, so
    // the site labels these rather than presenting them as settled.
    expect(result.observations.every((o) => o.isTentative)).toBe(true);
  });

  it('does not call a date tentative because of an unrelated "expected"', () => {
    // The first implementation scanned the whole page for hedge words, so
    // "candidates are expected to carry a photo ID" stamped Tentative on a
    // confirmed exam date. Under-claiming is not the safe direction of a wrong
    // answer — it is a different wrong answer, and it teaches a reader to
    // ignore the badge.
    const result = extractFacts({
      body:
        `${PAD}<p>Candidates are expected to carry a valid photo ID to the centre.</p>` +
        `<table><tr><td>Date of Examination</td><td>23 June ${Y}</td></tr></table>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observations.find((o) => o.factType === 'EXAM_DATE')?.isTentative).toBe(false);
  });
});

describe('extractFacts — invalid values', () => {
  it('counts an impossible date as rejected and extracts nothing from it', () => {
    const result = extractFacts({
      body: `${PAD}<p>Date of Examination: 31 February ${Y}</p>`,
      truncated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observations).toHaveLength(0);
    // Reported, not swallowed: a rising rejection count is a parser bug.
    expect(result.rejected).toBeGreaterThan(0);
  });
});

describe('extractFacts — determinism', () => {
  it('returns byte-identical output for the same input', () => {
    // A /g regex carries `lastIndex` between calls; reusing one silently skips
    // half the matches on the second run. Non-negotiable for an extractor whose
    // output is compared against canonical data.
    const body = `${PAD}<p>Date of Examination: 23 June ${Y}</p>`;
    const a = extractFacts({ body, truncated: false });
    const b = extractFacts({ body, truncated: false });
    expect(a).toEqual(b);
  });
});

describe('toDateRange', () => {
  it('sets BOTH endpoints for a single date', () => {
    // The exam page reads a deadline as `endDate ?? startDate` but renders the
    // dates table as `startDate – endDate`. Writing only one produces
    // "To be announced – 27 Apr".
    const range = toDateRange(`${Y}-04-27`);
    expect(range?.start.toISOString().slice(0, 10)).toBe(`${Y}-04-27`);
    expect(range?.end.toISOString().slice(0, 10)).toBe(`${Y}-04-27`);
  });

  it('spans a window', () => {
    const range = toDateRange(`${Y}-02-07/${Y}-02-15`);
    expect(range?.start.toISOString().slice(0, 10)).toBe(`${Y}-02-07`);
    expect(range?.end.toISOString().slice(0, 10)).toBe(`${Y}-02-15`);
  });

  it('returns null rather than an Invalid Date', () => {
    expect(toDateRange('not-a-date')).toBeNull();
    expect(toDateRange('')).toBeNull();
  });
});

describe('notice headlines are not schedules — the CUET false positive', () => {
  it('does not read a rescheduling notice as the exam date', () => {
    // Verbatim from cuet.nta.nic.in. The words "CUET (UG) 2026 Examination"
    // really are present, so the label matched and produced a HIGH-confidence
    // exam date of 30 May — for an exam that runs across many days, taken from
    // a notice about a server fault affecting one shift.
    const body =
      `${PAD}<p>Re-scheduling of examination for the candidates affected due to ` +
      `technical glitch in CUET (UG) &#8211; 2026 Examination on 30.05.2026 (Shift-I)-reg.</p>`;

    const result = extractFacts({ body, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observations.find((o) => o.factType === 'EXAM_DATE')).toBeUndefined();
  });

  it('still reads a genuine exam-date statement on the same kind of page', () => {
    // The deny terms must not blind the extractor to the real thing.
    const body = `${PAD}<p>CUET (UG) 2026 Examination will be held on 15.05.2026.</p>`;
    const result = extractFacts({ body, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observations.find((o) => o.factType === 'EXAM_DATE')?.normalizedValue).toBe(
      '2026-05-15',
    );
  });
});
