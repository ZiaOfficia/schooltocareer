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
export const EXTRACTOR_VERSION = 'exam-dates-v1';

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
    deny: [/\bmock\b/i, /\bpractice\b/i, /\badmit\s*card\b/i, /\banswer\s*key\b/i, /\baat\b/i],
  },
  APPLICATION_START: {
    allow: [
      /\bregistration\s+opens?\b/i,
      /\bapplication\s+(?:form\s+)?(?:begins?|opens?|starts?)\b/i,
      /\bstart(?:ing)?\s+date\s+(?:of|for)\s+(?:online\s+)?(?:registration|application)\b/i,
      /\bcommencement\s+of\s+(?:online\s+)?(?:registration|application)\b/i,
    ],
    deny: [/\blate\s*fee\b/i, /\bcorrection\b/i],
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
    deny: [/\bwith\s+late\s*fee\b/i, /\bcorrection\b/i, /\bextended\b/i],
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
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' | ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\|(\s*\|)+/g, ' | ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
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
function datesAfter(text: string, labelEnd: number): string[] {
  const window = untilNextLabel(text.slice(labelEnd, labelEnd + WINDOW_CHARS));
  const found = datesIn(window).filter((d) => !isPublicationStamp(text, labelEnd + d.index));
  const first = found[0];
  if (!first) return [];
  if (countBoundaries(window.slice(0, first.index)) > MAX_BOUNDARY_HOPS) return [];

  const closes = window.indexOf('|', first.index + first.raw.length);
  return found.filter((d) => closes === -1 || d.index < closes).map((d) => d.raw);
}

/** The dates in the cell immediately BEFORE a label, if any. */
function datesBefore(text: string, labelStart: number): string[] {
  const from = Math.max(0, labelStart - WINDOW_CHARS);
  const raw = text.slice(from, labelStart);
  const window = sincePreviousLabel(raw);
  // Offset of `window` within `text`, so the publication-stamp check can read
  // the characters that precede a date even when they fall outside the window.
  const base = from + (raw.length - window.length);

  const found = datesIn(window).filter((d) => !isPublicationStamp(text, base + d.index));
  const last = found[found.length - 1];
  if (!last) return [];
  if (countBoundaries(window.slice(last.index + last.raw.length)) > MAX_BOUNDARY_HOPS) return [];

  const opens = window.lastIndexOf('|', last.index);
  return found.filter((d) => d.index > opens).map((d) => d.raw);
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
        const context = text.slice(Math.max(0, labelStart - 90), labelEnd + 90);
        if (config.deny?.some((pattern) => pattern.test(context))) continue;

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
        const sides: Array<{ side: 'before' | 'after'; raws: string[] }> = [
          { side: 'before', raws: datesBefore(text, labelStart) },
          { side: 'after', raws: datesAfter(text, labelEnd) },
        ];

        for (const { side, raws } of sides) {
          for (const raw of raws) {
            const iso = parseDate(raw);
            if (!iso) {
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

    // A date on BOTH sides of a label means the row's orientation is genuinely
    // undecidable from the text, whatever the values are. Even when both sides
    // happen to agree, the agreement is a coincidence rather than evidence, so
    // this alone caps confidence at LOW.
    const bothSides =
      candidates.some((c) => c.side === 'before') && candidates.some((c) => c.side === 'after');

    // A window is expected for an exam that runs over several days (GATE sits
    // four Saturdays and Sundays); it is a contradiction for a deadline, which
    // can only have one value. Same data, different meaning, so the same
    // multiplicity maps to different confidence.
    const confidence: FactConfidence =
      distinct.length === 1 && !bothSides
        ? 'HIGH'
        : factType === 'EXAM_DATE' && !bothSides
          ? 'MEDIUM'
          : 'LOW';

    const normalizedValue =
      distinct.length === 1
        ? distinct[0]!
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
