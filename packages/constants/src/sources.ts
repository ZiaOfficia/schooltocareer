/**
 * The official pages we watch.
 *
 * ONE ROW PER URL, not per authority. NTA publishes JEE and NEET on separate
 * pages that change on completely different clocks, and a single "NTA" entry
 * would average them into a cadence that fits neither.
 *
 * Every URL here is a public, official notice page. Nothing aggregated, nothing
 * behind a login, nothing from a competitor — Principle 2 and 3 both point the
 * same way, and a fact is only as good as the authority behind it.
 *
 * `cadenceMinutes` is a first guess, and it is meant to be wrong. Phase 0
 * exists to replace these numbers with measured change frequencies; treat them
 * as a starting point that the data will correct within a month.
 */

export type SourceSeed = {
  name: string;
  authority: string;
  url: string;
  kind: 'HTML' | 'PDF' | 'JSON' | 'RSS';
  cadenceMinutes: number;
};

const HOURLY = 60;
const THRICE_DAILY = 480;
const DAILY = 1_440;
const WEEKLY = 10_080;

export const SOURCE_SEEDS: readonly SourceSeed[] = [
  // ── National Testing Agency ───────────────────────────────────────────────
  // The highest-value authority on the list: JEE, NEET, CUET and UGC NET all
  // run through it, and its notice board moves during admission season.
  { name: 'NTA — main notice board', authority: 'NTA', url: 'https://nta.ac.in/', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  { name: 'NTA — latest notifications', authority: 'NTA', url: 'https://nta.ac.in/NoticeBoardArchive', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  { name: 'JEE Main — official', authority: 'NTA', url: 'https://jeemain.nta.nic.in/', kind: 'HTML', cadenceMinutes: HOURLY },
  { name: 'NEET UG — official', authority: 'NTA', url: 'https://neet.nta.nic.in/', kind: 'HTML', cadenceMinutes: HOURLY },
  { name: 'CUET UG — official', authority: 'NTA', url: 'https://cuet.nta.nic.in/', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  { name: 'UGC NET — official', authority: 'NTA', url: 'https://ugcnet.nta.nic.in/', kind: 'HTML', cadenceMinutes: DAILY },

  // ── Boards ────────────────────────────────────────────────────────────────
  { name: 'CBSE — main', authority: 'CBSE', url: 'https://www.cbse.gov.in/', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  { name: 'CBSE — academic circulars', authority: 'CBSE', url: 'https://www.cbse.gov.in/cbsenew/circulars.html', kind: 'HTML', cadenceMinutes: DAILY },
  // results.cbse.nic.in does not resolve — NXDOMAIN, not a redirect. The
  // live results host is cbseresults.nic.in, verified 200.
  { name: 'CBSE — results portal', authority: 'CBSE', url: 'https://cbseresults.nic.in/', kind: 'HTML', cadenceMinutes: HOURLY },
  { name: 'CISCE — main', authority: 'CISCE', url: 'https://cisce.org/', kind: 'HTML', cadenceMinutes: DAILY },

  // ── Commissions and services ──────────────────────────────────────────────
  // The apex 307s to www and DROPS THE PATH, so both of these resolved to the
  // UPSC home page rather than the notice list. Addressing www directly keeps
  // the path. (Both still 403 behind the WAF — see docs/architecture/
  // source-acquisition.md — but the URL itself is now correct.)
  { name: 'UPSC — what is new', authority: 'UPSC', url: 'https://www.upsc.gov.in/whats-new', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  { name: 'UPSC — examinations', authority: 'UPSC', url: 'https://www.upsc.gov.in/examinations/active-examinations', kind: 'HTML', cadenceMinutes: DAILY },
  { name: 'SSC — main', authority: 'SSC', url: 'https://ssc.gov.in/', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  { name: 'SSC — notice board', authority: 'SSC', url: 'https://ssc.gov.in/candidate-portal/notice-board', kind: 'HTML', cadenceMinutes: THRICE_DAILY },

  // ── Banking and railways ──────────────────────────────────────────────────
  { name: 'IBPS — main', authority: 'IBPS', url: 'https://www.ibps.in/', kind: 'HTML', cadenceMinutes: DAILY },
  { name: 'SBI — careers', authority: 'SBI', url: 'https://sbi.co.in/web/careers', kind: 'HTML', cadenceMinutes: DAILY },
  // The certificate's altnames list rrbchennai.gov.in but NOT www, so the www
  // form fails TLS verification outright. The apex serves 200 and redirects to
  // rrb.indianrailways.gov.in/chennai/.
  { name: 'RRB — Chennai', authority: 'RRB', url: 'https://rrbchennai.gov.in/', kind: 'HTML', cadenceMinutes: DAILY },

  // ── Engineering and management ────────────────────────────────────────────
  { name: 'GATE — official', authority: 'IIT', url: 'https://gate2026.iitg.ac.in/', kind: 'HTML', cadenceMinutes: DAILY },
  { name: 'JEE Advanced — official', authority: 'IIT', url: 'https://jeeadv.ac.in/', kind: 'HTML', cadenceMinutes: DAILY },
  { name: 'CAT — official', authority: 'IIM', url: 'https://iimcat.ac.in/', kind: 'HTML', cadenceMinutes: WEEKLY },
];
