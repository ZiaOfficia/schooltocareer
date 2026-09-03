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
  // Date-first rows, a duplicated label, and a multi-day exam cell — the three
  // things the real page does that a naive reading gets wrong.
  const gateBody =
    `${PAD}<h3>IMPORTANT DATES</h3>` +
    `<div>August 25, ${Y}</div><div>Online registration opens</div>` +
    `<div>August 28, ${Y}</div><div>Online registration opens</div>` +
    `<div>September 25, ${Y}</div><div>Online registration closes (without late fee)</div>` +
    `<div>September 28, ${Y}</div><div>Online registration closes (without late fee)</div>` +
    `<div>GATE ${Y} Examinations</div><div>February 07, ${Y} February 08, ${Y}</div>` +
    `<div>March 19, ${Y}</div><div>Announcement of results</div>` +
    `<p>Dates are liable to change.</p>`;

  it('marks a deadline with rival dates LOW, and keeps every candidate', () => {
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const close = result.observations.find((o) => o.factType === 'APPLICATION_END');
    // A deadline can only have one value. The page states two, so we cannot
    // tell which — and silently picking one would be fabrication.
    expect(close?.confidence).toBe('LOW');
    expect(close?.normalizedValue).toBe(`${Y}-09-25/${Y}-09-28`);
    // The reviewer's whole basis for a decision.
    expect(close?.evidence).toContain(`${Y}-09-25`);
    expect(close?.evidence).toContain(`${Y}-09-28`);
  });

  it('treats several dates in ONE exam cell as a window, not a contradiction', () => {
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exam = result.observations.find((o) => o.factType === 'EXAM_DATE');
    // GATE genuinely sits over several days, and they share a cell on one side
    // of the label. Same multiplicity as the deadline above, opposite meaning —
    // hence MEDIUM, not LOW.
    expect(exam?.confidence).toBe('MEDIUM');
    expect(exam?.normalizedValue).toBe(`${Y}-02-07/${Y}-02-08`);
  });

  it('still reads the unambiguous row on an otherwise messy page', () => {
    // Ambiguity elsewhere must not degrade a row that is perfectly clear —
    // otherwise the queue fills with LOW items nobody can act on.
    const result = extractFacts({ body: gateBody, truncated: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const declared = result.observations.find((o) => o.factType === 'RESULT_DATE');
    expect(declared?.normalizedValue).toBe(`${Y}-03-19`);
    expect(declared?.confidence).toBe('HIGH');
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
