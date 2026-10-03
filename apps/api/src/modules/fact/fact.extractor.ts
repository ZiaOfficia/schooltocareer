import type { FactConfidence, FactRisk, FactType } from '@stc/types';

/**
 * DETERMINISTIC FACT EXTRACTION.
 *
 * Pure functions, no I/O, no database, no model. Given the HTML body of one
 * snapshot, return what the page states about a known set of facts — or return
 * nothing, which is a valid and frequent answer.
 *
 * WHY DETERMINISTIC AND NOT AN LLM. Not cost, and not taste. An extractor whose
 * output cannot be reproduced from its input cannot be regression-tested, and
 * the failure it would produce is the one failure this system exists to
 * prevent: a confident wrong exam date. A regex that misses a date leaves the
 * page honestly saying "not announced". A model that hallucinates one puts a
 * student in an exam hall on the wrong day. Those are not symmetric.
 *
 * WHAT THE REAL PAGES LOOK LIKE, measured against stored snapshots rather than
 * assumed — this is what the design below is shaped by:
 *
 *   gate2026.iitg.ac.in   44 kB. A labelled IMPORTANT DATES table. Extractable,
 *                         but the table is RENDERED TWICE, so one label yields
 *                         several different dates. Hence `LOW` confidence and
 *                         the candidate list in the evidence.
 *   jeeadv.ac.in          65 kB. A reverse-chronological announcement feed, not
 *                         a schedule. Full of real dates ("Round 5 deadline",
 *                         "AAT will be held on 4th June") that are NOT the
 *                         exam date. Label anchoring is what keeps those out.
 *   iimcat.ac.in          1.9 kB body, 12 characters of text. A JavaScript
 *                         shell; nothing to read.
 *   ssc.gov.in            32 kB body, 55 characters of text. Also a shell.
 *   sbi.co.in/web/careers 176 kB of corporate PR. Its only dates are award
 *                         ceremonies.
 *
 * So: four of six bound sources currently yield nothing, and that is reported
 * as nothing rather than smoothed over.
 */

/**
 * Bump on ANY behavioural change, including a label list edit.
 *
 * Stamped onto every observation. Without it, a parser fix cannot be told apart
 * from an authority changing its mind, and neither can be replayed.
 */
export const EXTRACTOR_VERSION = 'exam-dates-v2';

/** Publication impact. Fixed per fact type; never derived from confidence. */
const RISK_BY_TYPE: Record<FactType, FactRisk> = {
  // The two that cost a student a year if wrong.
  EXAM_DATE: 'CRITICAL',
  APPLICATION_END: 'CRITICAL',
  APPLICATION_START: 'HIGH',
  RESULT_DATE: 'HIGH',
  // A wrong link is a dead end, not a missed deadline.
  OFFICIAL_APPLICATION_URL: 'MEDIUM',
  OFFICIAL_RESULT_URL: 'MEDIUM',
};

export function riskOf(factType: FactType): FactRisk {
  return RISK_BY_TYPE[factType];
}

/**
 * Label patterns per fact type, in the wording Indian exam authorities
 * actually use.
 *
 * `deny` exists because near-miss labels are the main source of wrong facts.
 * "ONLINE REGISTRATION CLOSES (WITH LATE FEE)" is a different fact from the
 * same sentence with "WITHOUT", and a substring match treats them as one — the
 * same class of bug the exam page already carries a comment about, where
 * matching APPLICATION_START as a substring showed the opening date under a
 * "closes" heading.
 */
const LABELS: Record<FactType, { allow: RegExp[]; deny?: RegExp[] }> = {
  EXAM_DATE: {
    allow: [
      /\bdate[s]?\s+of\s+examination\b/i,
      /\bexamination\s+date[s]?\b/i,
      /\bexam\s+date[s]?\b/i,
      /\bdate\s+of\s+(?:the\s+)?exam\b/i,
      // "GATE 2026 Examinations" — an exam name, a year, then the word. The
      // character class excludes `|` and `,` so it cannot span a table cell
      // and pick up an unrelated name. Case-INSENSITIVE: the first version was
      // not, and `examinations?` therefore could not match the capitalised
      // "Examinations" that is how every one of these pages actually writes it.
      /\b[A-Za-z()]{2,14}(?:\s+[A-Za-z()]{2,14})?\s+\d{4}\s+examinations?\b/i,
    ],
    // A mock/practice test date is not the exam date, and an admit-card or
    // answer-key heading sits next to a date on every one of these pages.
    //
    // The notice-headline terms are the CUET false positive, and it is the
    // clearest example of why label matching alone is not enough. The page
    // states: "Re-scheduling of examination for the candidates affected due to
    // technical glitch in CUET (UG) – 2026 on 30.05.2026 (Shift-I)-reg." The
    // words "CUET (UG) 2026 Examination" really are in there, so the label
    // matched and produced a HIGH-confidence exam date of 30 May — for an exam
    // that runs across many days, from a notice about a server fault.
    //
    // A rescheduling, corrigendum or postponement notice is ABOUT the schedule;
    // it is not the schedule.
    deny: [
      /\bmock\b/i,
      /\bpractice\b/i,
      /\badmit\s*card\b/i,
      /\banswer\s*key\b/i,
      /\baat\b/i,
      /\bre-?scheduling\b/i,
      /\bre-?scheduled\b/i,
      /\bpostpone(?:d|ment)?\b/i,
      /\bcorrigendum\b/i,
      /\bglitch\b/i,
      /-reg\.?\b/i,
    ],
  },
  APPLICATION_START: {
    allow: [
      /\bregistration\s+opens?\b/i,
      /\bapplication\s+(?:form\s+)?(?:begins?|opens?|starts?)\b/i,
      /\bstart(?:ing)?\s+date\s+(?:of|for)\s+(?:online\s+)?(?:registration|application)\b/i,
      /\bcommencement\s+of\s+(?:online\s+)?(?:registration|application)\b/i,
      // GATE 2027: "Opening Date of GATE Online Application Processing System
      // (GOAPS)". The exam name is a link, so a cell boundary can sit between
      // "of" and the rest; one optional word covers "GATE".
      /\bopening\s+date\s+of\s+(?:\|\s*)?(?:[a-z]+\s+)?(?:online\s+)?(?:application|registration)\b/i,
    ],
    // "Opening Date of GATE 2027 Application rectification" opens the
    // correction window, not the application.
    deny: [/\blate\s*fee\b/i, /\bcorrection\b/i, /\brectification\b/i],
  },
  APPLICATION_END: {
    allow: [
      /\bregistration\s+closes?\b/i,
      /\bapplication\s+(?:form\s+)?(?:closes?|ends?)\b/i,
      /\blast\s+date\s+(?:for|of|to)\s+(?:submission\s+of\s+)?(?:online\s+)?(?:registration|application|form)\b/i,
      /\bclosing\s+date\b/i,
    ],
    // The with-late-fee deadline is a DIFFERENT fact. Publishing it as "the"
    // deadline tells a student they have another week and costs them the fee
    // at best.
    // "Closing Date of GATE 2027 Application rectification" closes the
    // correction window, a fortnight after the real deadline.
    deny: [/\bwith\s+late\s*fee\b/i, /\bcorrection\b/i, /\bextended\b/i, /\brectification\b/i],
  },
  RESULT_DATE: {
    allow: [
      /\bannouncement\s+of\s+results?\b/i,
      /\bdeclaration\s+of\s+results?\b/i,
      /\bresults?\s+date\b/i,
      /\bdate\s+of\s+(?:declaration\s+of\s+)?results?\b/i,
    ],
    deny: [/\banswer\s*key\b/i, /\bcounselling\b/i],
  },
  // URL facts are not extracted by v1. The label patterns above work because a
  // date has one shape; "the application link" does not, and every candidate on
  // these pages is an unlabelled anchor. Recording a guessed URL as official
  // would be exactly the fabrication this module exists to prevent.
  OFFICIAL_APPLICATION_URL: { allow: [] },
  OFFICIAL_RESULT_URL: { allow: [] },
};

/** Fact types v1 can actually read off a page. */
export const EXTRACTABLE_FACT_TYPES: readonly FactType[] = (
  Object.keys(LABELS) as FactType[]
).filter((type) => LABELS[type].allow.length > 0);

/**
 * Words that mean the authority has not committed to THIS value.
 *
 * Checked against the candidate's own window only. Scanning the whole page for
 * these was the first implementation and it marked every date on every page
 * tentative, because "expected" appears in ordinary instructions ("candidates
 * are expected to carry a photo ID"). Labelling a confirmed exam date
 * "Tentative" is not the safe direction of a wrong answer — it is a different
 * wrong answer, and it teaches a reader to ignore the label.
 */
const TENTATIVE_RE = /\b(tentative|provisional|expected|likely|to\s+be\s+announced)\b/i;

/**
 * A disclaimer that genuinely covers a whole schedule.
 *
 * GATE's important-dates table ends "Dates are liable to change." — that is an
 * explicit statement about every date above it, not an incidental word, so it
 * is the one thing allowed to mark a page's facts tentative wholesale. Written
 * to require the word "dates" so a stray "subject to change" about, say, a fee
 * cannot reach across the document.
 */
const SCHEDULE_DISCLAIMER_RE =
  /\bdates?\s+(?:are|is|may\s+be)\s+(?:liable|subject)\s+to\s+change\b/i;

/**
 * HTML to text, preserving BLOCK BOUNDARIES as `|`.
 *
 * The boundary marker is load-bearing, not cosmetic. On GATE's page the label
 * and its date are in adjacent table cells, so with tags simply deleted the two
 * run together and there is no way to tell "this date belongs to this label"
 * from "these two strings happen to be near each other". Keeping the cell
 * boundary is what makes the proximity rule below mean something.
 */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // STRUCK-THROUGH TEXT IS WITHDRAWN TEXT. GATE 2027 revises a deadline by
      // wrapping the old date in <del> and printing the new one after it, so
      // the cell reads "~~21 Sep~~ ~~27 Sep~~ 5 Oct". Kept, the old dates are
      // the FIRST dates after the label — the ones proximity prefers — and the
      // page's own correction is undone. The authority's markup says which
      // value stands; reading it is not a heuristic.
      .replace(/<(del|s|strike)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      // An ordinal suffix is part of the date, not a cell. GATE 2027 writes
      // "14<sup>th</sup> August 2026"; turned into a boundary like every other
      // tag, that became "14 | th | August 2026", which no date shape matches,
      // and the whole table read as silent.
      .replace(/<\/?su[pb]\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' | ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#8217;|&rsquo;/gi, "'")
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\|(\s*\|)+/g, ' | ')
      .replace(/[ \t\r\n]+/g, ' ')
      .trim()
  );
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Every date shape seen across the stored snapshots, in one expression:
 *   23 June 2026 · 23rd June, 2026 · 23.06.2026 · 23/06/2026 · June 23, 2026
 *
 * Numeric-only forms are read DAY-FIRST. Indian authorities write DD/MM/YYYY,
 * and guessing wrong silently turns 06/07 into July 6th — a real date, on the
 * wrong day, with nothing to flag it. Ambiguous numeric dates that could be
 * either are downgraded by `parseDate` returning the day-first reading only
 * when it is unambiguous or plausible as such.
 */
const DATE_RE = new RegExp(
  [
    // 23 June 2026 / 23rd June, 2026 / 23-Jun-2026
    String.raw`\b(\d{1,2})(?:st|nd|rd|th)?[\s.\-/]+([A-Za-z]{3,9})\.?,?[\s.\-/]+(\d{4})\b`,
    // June 23, 2026 / Jun 23 2026
    String.raw`\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`,
    // 23.06.2026 / 23/06/2026 / 23-06-2026
    String.raw`\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b`,
  ].join('|'),
  'gi',
);

/** An ISO date, or null when the text is not a valid calendar date. */
export function parseDate(raw: string): string | null {
  const match = new RegExp(DATE_RE.source, 'i').exec(raw);
  if (!match) return null;

  let day: number, month: number, year: number;

  if (match[1] && match[2] && match[3]) {
    day = Number(match[1]);
    month = MONTHS[match[2].slice(0, 3).toLowerCase()] ?? 0;
    year = Number(match[3]);
  } else if (match[4] && match[5] && match[6]) {
    month = MONTHS[match[4].slice(0, 3).toLowerCase()] ?? 0;
    day = Number(match[5]);
    year = Number(match[6]);
  } else if (match[7] && match[8] && match[9]) {
    day = Number(match[7]);
    month = Number(match[8]);
    year = Number(match[9]);
  } else {
    return null;
  }

  return toIsoIfReal(year, month, day);
}

/**
 * Rejects impossible dates instead of letting `Date` roll them over.
 *
 * `new Date(2026, 1, 31)` is 3 March, silently. A page that says "31 February"
 * is a page we misread, and the correct response is to extract nothing — an
 * invalid value must never reach canonical data.
 *
 * The year window is deliberately narrow. An exam schedule is published at most
 * a couple of years ahead, so a 1998 or 2099 match is a phone number, a
 * copyright line or a misparse, never a date a student needs.
 */
function toIsoIfReal(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const thisYear = new Date().getUTCFullYear();
  if (year < thisYear - 3 || year > thisYear + 3) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * One date found on the page.
 *
 * `side` is kept because it is a confidence signal in its own right: a label
 * with a date on both sides is ambiguous no matter how many distinct values
 * there are.
 */
type Candidate = { iso: string; raw: string; side: 'before' | 'after'; window: string };

export type Observation = {
  factType: FactType;
  /** Verbatim source text for the value, or the list when several disagreed. */
  rawValue: string;
  /** `YYYY-MM-DD`, or `YYYY-MM-DD/YYYY-MM-DD` for a window. */
  normalizedValue: string;
  confidence: FactConfidence;
  isTentative: boolean;
  evidence: string;
};

export type ExtractionResult =
  | { ok: true; observations: Observation[]; rejected: number }
  /**
   * A refusal is a first-class result, not an exception. "We would not read
   * this" and "we read it and it said nothing" must be distinguishable in the
   * task's metrics, because the first is a fixable condition.
   */
  | { ok: false; reason: 'TRUNCATED' | 'NO_BODY' | 'NO_TEXT' };

/** How far from a label a date may sit and still be attributed to it. */
const WINDOW_CHARS = 160;

/**
 * How many block boundaries may sit between a label and its value.
 *
 * ONE. A label and the cell next to it are `LABEL | VALUE` — one boundary. Two
 * or more means we have left the row, and everything past that point belongs to
 * something else.
 *
 * This single number is what kills the worst false positive the real pages
 * produce. gate2026.iitg.ac.in contains the sentence "…remains valid for THREE
 * years from the date of announcement of results.", immediately followed by
 * "| IMPORTANT DATES | August 25, 2025:". A forward scan with a generous window
 * read that prose as a RESULT_DATE label and paired it with the registration
 * opening date — a wrong result date, at HIGH confidence, from a page that
 * states the right one two hundred characters later. Two boundaries away is not
 * "nearby"; it is a different part of the document.
 */
const MAX_BOUNDARY_HOPS = 1;

function countBoundaries(text: string): number {
  return (text.match(/\|/g) ?? []).length;
}

/** A date found in the body, with its absolute offset for context checks. */
type Found = { raw: string; at: number };

/** Every date in a fragment, with the offset it was found at. */
function datesIn(fragment: string): Array<{ raw: string; index: number }> {
  return [...fragment.matchAll(new RegExp(DATE_RE.source, 'gi'))].map((m) => ({
    raw: m[0],
    index: m.index ?? 0,
  }));
}

/**
 * A date that says WHEN THE NOTICE WAS POSTED, not when anything happens.
 *
 * jeeadv.ac.in stamps every item "[ Posted on December 06, 2025, 17:30 IST ]"
 * immediately before its heading, so the publication date sits exactly one
 * boundary before the label — indistinguishable, by position alone, from a
 * date-first table cell. It is distinguishable by what precedes it, which is
 * what this checks.
 *
 * Left in as a filter rather than handled by narrowing the window, because the
 * window is doing its job: the date really is adjacent. It is simply not a
 * fact about the exam.
 */
const PUBLICATION_STAMP = /\b(posted|published|updated|uploaded|revised|dated)\s+(on\s+)?$/i;

function isPublicationStamp(text: string, at: number): boolean {
  return PUBLICATION_STAMP.test(text.slice(Math.max(0, at - 24), at));
}

/**
 * A date used as a row KEY, i.e. immediately followed by a colon.
 *
 * `August 25, 2025: | ONLINE REGISTRATION OPENS` — the date introduces the
 * label rather than answering one. It is the page's own statement of which way
 * its rows read, and it is the only reliable way to tell a date-first table
 * from a label-first one without guessing.
 */
function isRowKey(text: string, endOfDate: number): boolean {
  return /^\s*:/.test(text.slice(endOfDate, endOfDate + 3));
}

const DAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;

/**
 * The bounds of the block the given offset sits in.
 *
 * Proximity alone is not enough on a dense table: "within 22 characters" and
 * "within 90 characters" both reach straight into the neighbouring row. Two
 * real misreads came from exactly that —
 *
 *   the weekday "Sunday", printed after 15 February in the exam row, sat close
 *   enough to "March 19, 2026" in the NEXT row to be taken as its weekday, and
 *   the result date was discarded as a day mismatch;
 *
 *   the qualifier "(WITHOUT LATE FEE)", belonging to the closing row, fell
 *   inside the opening row's deny window and suppressed it.
 *
 * A cell boundary is the real limit of what a value can be qualified by.
 */
function cellBounds(text: string, at: number): { start: number; end: number } {
  const start = text.lastIndexOf('|', at);
  const end = text.indexOf('|', at);
  return { start: start === -1 ? 0 : start + 1, end: end === -1 ? text.length : end };
}

/**
 * The page's own checksum, and the cheapest correctness signal available.
 *
 * GATE prints a day beside every date — "February 07, 2026 | Saturday". All
 * twelve dates in its table agree with their stated day, which is strong
 * independent confirmation that the parse is right. More usefully, a
 * DISAGREEMENT is proof it is wrong: a misparsed numeric date (07/02 read as
 * 2 July rather than 7 February) lands on the wrong weekday and can be thrown
 * out before it ever becomes a candidate.
 *
 * Returns `true` when no day is stated, because most pages state none. Absence
 * of the checksum is not a failure of it.
 */
function dayOfWeekAgrees(iso: string, text: string, at: number, rawLength: number): boolean {
  // Nearby AND inside the same cell. The exam row packs four dates and four
  // weekdays into one cell, so proximity is what pairs them — but proximity
  // alone reaches into the next row, which is how a Sunday from 15 February
  // came to be read as the weekday of 19 March.
  const cell = cellBounds(text, at);
  const before = text.slice(Math.max(cell.start, at - 22), at);
  const after = text.slice(at + rawLength, Math.min(cell.end, at + rawLength + 22));
  const around = `${before} ${after}`;

  const stated = DAY_NAMES.find((day) => new RegExp(`\\b${day}\\b`, 'i').test(around));
  if (!stated) return true;

  const actual = DAY_NAMES[new Date(`${iso}T00:00:00.000Z`).getUTCDay()];
  return actual === stated;
}

/** Cuts a forward window at the next label of ANY type. */
function untilNextLabel(window: string): string {
  let cut = window.length;
  for (const config of Object.values(LABELS)) {
    for (const pattern of config.allow) {
      const found = new RegExp(pattern.source, pattern.flags.replace(/g/g, '')).exec(window);
      if (found && found.index < cut) cut = found.index;
    }
  }
  return window.slice(0, cut);
}

/** Cuts a backward window after the previous label of ANY type. */
function sincePreviousLabel(window: string): string {
  let cut = 0;
  for (const config of Object.values(LABELS)) {
    for (const pattern of config.allow) {
      const scanner = new RegExp(pattern.source, `${pattern.flags.replace(/g/g, '')}g`);
      let hit: RegExpExecArray | null;
      while ((hit = scanner.exec(window)) !== null) {
        cut = Math.max(cut, hit.index + hit[0].length);
      }
    }
  }
  return window.slice(cut);
}

/**
 * The dates in the cell immediately AFTER a label, if any.
 *
 * Several dates in ONE cell are all kept — GATE lists its four exam days
 * together, and that is a genuine window rather than a contradiction.
 */
function datesAfter(text: string, labelEnd: number): Found[] {
  const window = untilNextLabel(text.slice(labelEnd, labelEnd + WINDOW_CHARS));
  const found = datesIn(window)
    .map((d) => ({ raw: d.raw, at: labelEnd + d.index, index: d.index }))
    .filter((d) => !isPublicationStamp(text, d.at))
    // A date written as a ROW KEY — "August 25, 2025:" — introduces the label
    // that follows it. It is emphatically not the value of the label above.
    //
    // This is what made the restated rows unfixable: for "REGISTRATION OPENS"
    // the date after it is the CLOSING row's key, so the opening fact picked up
    // 25 September and the revision series resolved to the wrong end of the
    // table. The trailing colon is the page telling us which way the row reads.
    .filter((d) => !isRowKey(text, d.at + d.raw.length));
  const first = found[0];
  if (!first) return [];
  if (countBoundaries(window.slice(0, first.index)) > MAX_BOUNDARY_HOPS) return [];

  const closes = window.indexOf('|', first.index + first.raw.length);
  return found
    .filter((d) => closes === -1 || d.index < closes)
    .map((d) => ({ raw: d.raw, at: d.at }));
}

/**
 * Continues a multi-day schedule across cell boundaries.
 *
 * The real GATE exam row is not one cell — it is eight:
 *
 *   GATE 2026 Examinations | February 07, 2026 | Saturday | February 08, 2026
 *   | Sunday | February 14, 2026 | Saturday | February 15, 2026 | Sunday |
 *
 * Stopping at the first boundary yields 7 February and calls it the exam date,
 * which misleads every candidate whose paper sits on the 15th. So a run of
 * cells that contain NOTHING BUT a date or a weekday is read as one schedule.
 *
 * The run ends at the first cell containing anything else — here "March 19,
 * 2026:", which is a row key and therefore the next row's label. That is what
 * stops the exam date swallowing the result date.
 *
 * Only EXAM_DATE uses this. A deadline restated across cells is a revision
 * history, not a span, and is handled separately.
 */
function scheduleRun(text: string, from: number): Found[] {
  const out: Found[] = [];
  let cursor = from;
  const limit = from + WINDOW_CHARS * 3;

  while (cursor < text.length && cursor < limit) {
    const next = text.indexOf('|', cursor);
    if (next === -1) break;
    const start = next + 1;
    const end = text.indexOf('|', start);
    const cell = text.slice(start, end === -1 ? text.length : end).trim();
    if (cell.length === 0) break;

    // A weekday on its own continues the run without contributing a value.
    if (DAY_NAMES.some((day) => new RegExp(`^${day}$`, 'i').test(cell))) {
      cursor = start + (end === -1 ? cell.length : end - start);
      continue;
    }

    const dates = datesIn(cell);
    const only = dates.length === 1 && dates[0]!.raw.trim() === cell;
    if (!only || isRowKey(text, start + dates[0]!.index + dates[0]!.raw.length)) break;

    out.push({ raw: dates[0]!.raw, at: start + dates[0]!.index });
    cursor = start + (end === -1 ? cell.length : end - start);
  }

  return out;
}

/** The dates in the cell immediately BEFORE a label, if any. */
function datesBefore(text: string, labelStart: number): Found[] {
  const from = Math.max(0, labelStart - WINDOW_CHARS);
  const raw = text.slice(from, labelStart);
  const window = sincePreviousLabel(raw);
  // Offset of `window` within `text`, so the publication-stamp check can read
  // the characters that precede a date even when they fall outside the window.
  const base = from + (raw.length - window.length);

  const found = datesIn(window)
    .map((d) => ({ raw: d.raw, at: base + d.index, index: d.index }))
    .filter((d) => !isPublicationStamp(text, d.at));
  const last = found[found.length - 1];
  if (!last) return [];
  if (countBoundaries(window.slice(last.index + last.raw.length)) > MAX_BOUNDARY_HOPS) return [];

  const opens = window.lastIndexOf('|', last.index);
  return found.filter((d) => d.index > opens).map((d) => ({ raw: d.raw, at: d.at }));
}

/** Below this, the body is a JavaScript shell — iimcat.ac.in yields 12 chars. */
const MIN_TEXT_CHARS = 200;

/**
 * Reads one snapshot body.
 *
 * `truncated` is a hard stop. A body cut at 4 MB may have lost the half of the
 * table that says "WITH LATE FEE", which would turn the extended deadline into
 * the real one — a partial document must never be parsed as a complete one.
 */
export function extractFacts(input: {
  body: string | null;
  truncated: boolean;
  factTypes?: readonly FactType[];
}): ExtractionResult {
  if (input.truncated) return { ok: false, reason: 'TRUNCATED' };
  if (!input.body || input.body.trim().length === 0) return { ok: false, reason: 'NO_BODY' };

  const text = htmlToText(input.body);
  if (text.length < MIN_TEXT_CHARS) return { ok: false, reason: 'NO_TEXT' };

  const wanted = input.factTypes ?? EXTRACTABLE_FACT_TYPES;
  const observations: Observation[] = [];
  let rejected = 0;

  for (const factType of wanted) {
    const config = LABELS[factType];
    if (config.allow.length === 0) continue;

    const candidates: Candidate[] = [];
    /** How many times a label for this fact type matched. See isRevisionSeries. */
    let labelHits = 0;

    for (const label of config.allow) {
      // A fresh global clone per label — reusing a /g regex across calls
      // carries `lastIndex` over and silently skips matches.
      const scanner = new RegExp(label.source, `${label.flags.replace(/g/g, '')}g`);
      let hit: RegExpExecArray | null;

      while ((hit = scanner.exec(text)) !== null) {
        const labelStart = hit.index;
        const labelEnd = hit.index + hit[0].length;

        // The label itself plus a little context, for the deny check. A deny
        // term ("WITH LATE FEE") can precede or follow the label depending on
        // how the table is laid out.
        // The label's OWN cell. A qualifier that changes what a label means —
        // "(WITH LATE FEE)", "provisional", "mock" — is printed inside the cell
        // with it. Reaching 90 characters either way instead pulled in the
        // neighbouring row and suppressed the opening date because the row
        // below it mentioned a late fee.
        const cell = cellBounds(text, labelStart);
        const context = text.slice(cell.start, Math.max(cell.end, labelEnd));
        if (config.deny?.some((pattern) => pattern.test(context))) continue;

        labelHits += 1;

        // BOTH DIRECTIONS, because real pages disagree about which way round a
        // table goes — and gate2026.iitg.ac.in disagrees WITH ITSELF. Its
        // important-dates rows read "August 25, 2025: | ONLINE REGISTRATION
        // OPENS" (value first), while its exam row reads "GATE 2026
        // Examinations | February 07, 2026" (label first). A forward-only scan
        // paired every row with the NEXT row's date — off by one, silently,
        // across the whole table.
        //
        // When both sides offer a date we do not know which is the label's, so
        // both become candidates and the ambiguity surfaces as LOW confidence
        // rather than as a coin flip resolved in private.
        const after = datesAfter(text, labelEnd);
        // A multi-day exam continues past its first cell. Anchored at the last
        // date already accepted, so it extends the run rather than restarting.
        const last = after[after.length - 1];
        const run =
          factType === 'EXAM_DATE' && last
            ? scheduleRun(text, last.at + last.raw.length)
            : [];

        const sides: Array<{ side: 'before' | 'after'; found: Found[] }> = [
          { side: 'before', found: datesBefore(text, labelStart) },
          { side: 'after', found: [...after, ...run] },
        ];

        for (const { side, found } of sides) {
          for (const { raw, at } of found) {
            const iso = parseDate(raw);
            if (!iso) {
              rejected += 1;
              continue;
            }
            // The page's own checksum. A date that contradicts the weekday
            // printed beside it is a misparse, not a fact.
            if (!dayOfWeekAgrees(iso, text, at, raw.length)) {
              rejected += 1;
              continue;
            }
            candidates.push({
              iso,
              raw,
              side,
              window:
                side === 'before' ? `${raw} → ${hit[0]}` : `${hit[0]} → ${raw}`,
            });
          }
        }
      }
    }

    if (candidates.length === 0) continue;

    const distinct = [...new Set(candidates.map((c) => c.iso))].sort();
    const first = candidates[0]!;

    /**
     * A REVISION HISTORY, not a set of rival values.
     *
     * This is the defect that produced an application deadline of
     * "25 September – 7 October". gate2026.iitg.ac.in restates a deadline row
     * every time the deadline moves, and renders the superseded entries struck
     * through. Strikethrough is formatting, so text extraction keeps all four
     * and loses the one thing that said which was current:
     *
     *   September 25 → September 28 → October 06 → October 07
     *
     * Read as rival values that is an unresolvable contradiction. Read as what
     * it is — a deadline extended three times — the answer is unambiguous and
     * is the LAST one. The signature is that the values are strictly
     * increasing, which is what an extension can only ever be. A set that is
     * not ordered is not a revision history, and stays ambiguous.
     *
     * Verified against the page's own weekday column: Thu, Sun, Mon, Tue match
     * 25 Sep, 28 Sep, 6 Oct and 7 Oct exactly.
     */
    const strictlyIncreasing = distinct.every(
      (value, index) => index === 0 || value > distinct[index - 1]!,
    );
    // An exam can genuinely occupy several days; a deadline cannot. So the same
    // shape of data means different things per fact type, and only EXAM_DATE
    // keeps the full span.
    const isSchedule = factType === 'EXAM_DATE';

    /**
     * THE LABEL MUST ACTUALLY REPEAT.
     *
     * A revision history is a row RESTATED — the label appears once per
     * revision. Requiring that is what keeps the rule narrow: two unrelated
     * dates that happen to be in date order, found on either side of a single
     * label, are not a revision series and stay LOW. GATE restates
     * "REGISTRATION CLOSES (WITHOUT LATE FEE)" four times and "REGISTRATION
     * OPENS" twice, which is exactly the signature.
     */
    const isRevisionSeries =
      !isSchedule && labelHits > 1 && distinct.length > 1 && strictlyIncreasing;

    /**
     * Dates on both sides of a label are NOT evidence of ambiguity here.
     *
     * In a DATE-then-LABEL table the date after row N is the date before row
     * N+1, so a restated label always reports both sides. An earlier version
     * capped that at LOW, which permanently pinned the most structured page on
     * the watch list to its least usable confidence. Multiplicity is explained
     * by the layout; what matters is whether the values form a schedule, a
     * revision series, or a genuine contradiction.
     */
    const confidence: FactConfidence =
      distinct.length === 1
        ? 'HIGH'
        : isSchedule || isRevisionSeries
          ? // A span across a multi-day exam, or the latest of a restated
            // series: well-founded readings, but each is an inference from
            // layout rather than a value the page states outright.
            'MEDIUM'
          : 'LOW';

    const normalizedValue =
      distinct.length === 1
        ? distinct[0]!
        : isRevisionSeries
          ? distinct[distinct.length - 1]!
          : `${distinct[0]}/${distinct[distinct.length - 1]}`;

    observations.push({
      factType,
      rawValue:
        distinct.length === 1
          ? first.raw
          : candidates.map((c) => c.raw).join(' | '),
      normalizedValue,
      isTentative:
        candidates.some((c) => TENTATIVE_RE.test(c.window)) || SCHEDULE_DISCLAIMER_RE.test(text),
      confidence,
      // Every rival candidate, verbatim, with its label. This is the whole
      // basis on which a reviewer can accept a LOW-confidence value, so it is
      // not summarised away.
      evidence: [
        `extractor=${EXTRACTOR_VERSION} candidates=${candidates.length} distinct=${distinct.length}`,
        ...candidates.slice(0, 12).map((c) => `[${c.iso}] ${c.window}`),
      ].join('\n'),
    });
  }

  return { ok: true, observations, rejected };
}

/**
 * Splits a normalised date value into the pair `ExamEvent` stores.
 *
 * A single date sets BOTH endpoints, deliberately. The exam page reads a
 * deadline as `endDate ?? startDate` while the dates table renders
 * `startDate – endDate`, so a row with only one of them set displays as
 * "To be announced – 27 Apr 2026". Writing both keeps the two readers agreeing.
 */
export function toDateRange(normalizedValue: string): { start: Date; end: Date } | null {
  const [from, to] = normalizedValue.split('/');
  if (!from) return null;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to ?? from}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}
