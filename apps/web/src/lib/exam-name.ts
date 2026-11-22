/**
 * Exam names for display.
 *
 * Some exam rows store their name in capitals ("JEE ADVANCED"). Shouting
 * names read badly on cards, so capitalised words are set in title case,
 * except known exam acronyms (JEE, NEET, UG, CLAT, SSC…), which stay as they are.
 *
 * This is presentation only. The fix at source is to correct the names in
 * the database through the reviewed exam-hub data.
 */
/** Exam and qualification acronyms that are always written in capitals. */
const ACRONYMS = new Set([
  'AILET',
  'BITSAT',
  'CAT',
  'CET',
  'CGL',
  'CHSL',
  'CLAT',
  'CTET',
  'CUET',
  'GATE',
  'GD',
  'IBPS',
  'JEE',
  'MHT',
  'MTS',
  'NA',
  'NDA',
  'NEET',
  'NIFT',
  'NTPC',
  'PG',
  'PO',
  'RRB',
  'SBI',
  'SSC',
  'UG',
  'UPSC',
  'VITEEE',
  'WBJEE',
]);

export function examDisplayName(name: string): string {
  return name
    .split(' ')
    .map((word) =>
      /^[A-Z]{2,}$/.test(word) && !ACRONYMS.has(word)
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ');
}
