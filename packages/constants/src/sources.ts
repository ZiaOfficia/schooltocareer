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
  /**
   * The exam slug this page is AUTHORITATIVE for, when it is authoritative for
   * exactly one.
   *
   * WHY THIS LIVES HERE AND NOT ON `Source`. The registry already owns "which
   * official page we watch"; "what that page is authoritative about" is the
   * same fact, and splitting it across a constants file and a database column
   * gives it two owners. There is also nothing to edit: a notice board does not
   * become an exam-specific page because someone changed a dropdown.
   *
   * ABSENT ON PURPOSE for multi-exam pages. nta.ac.in and ssc.gov.in carry
   * notices for a dozen exams at once, and attributing a date on such a page to
   * one exam is not a deterministic operation — it is a guess with an exam name
   * near it. The fact extractor only runs where this field is set, which is the
   * mechanism that keeps that guess out of the database.
   */
  watchesExamSlug?: string;
  /**
   * The exam CYCLE this page currently describes. Required whenever
   * `watchesExamSlug` is set.
   *
   * WHY. An exam's site outlives its cycle: jeeadv.ac.in still lists the 2026
   * schedule after the exam has moved on to 2027. Without this, rolling an
   * exam to a new cycle turns every un-rolled page into a stream of LAST
   * year's dates proposed as THIS year's — with HIGH confidence, because the
   * page really does say them.
   *
   * The extractor only records against an exam whose current cycle matches
   * this year, and approval refuses a change whose page is bound to another
   * cycle. When an authority rolls its site to the new cycle, change this
   * number on the same commit that checks the page.
   */
  watchesCycleYear?: number;
};

const HOURLY = 60;
const THRICE_DAILY = 480;
const DAILY = 1_440;
const WEEKLY = 10_080;

export const SOURCE_SEEDS: readonly SourceSeed[] = [
  // ── National Testing Agency ───────────────────────────────────────────────
  // The highest-value authority on the list: JEE, NEET, CUET and UGC NET all
  // run through it, and its notice board moves during admission season.
  // No `watchesExamSlug` on the two notice boards: they cover JEE, NEET, CUET
  // and UGC NET simultaneously.
  { name: 'NTA — main notice board', authority: 'NTA', url: 'https://nta.ac.in/', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  { name: 'NTA — latest notifications', authority: 'NTA', url: 'https://nta.ac.in/NoticeBoardArchive', kind: 'HTML', cadenceMinutes: THRICE_DAILY },
  // Still bound to 2026 as of 2026-10-03: none of the three carries a 2027
  // schedule yet (JEE Main's 2027 bulletin is expected late October). They stay
  // dormant for the 2027 cycle until someone confirms the page has rolled.
  { name: 'JEE Main — official', authority: 'NTA', url: 'https://jeemain.nta.nic.in/', kind: 'HTML', cadenceMinutes: HOURLY, watchesExamSlug: 'jee-main', watchesCycleYear: 2026 },
  { name: 'NEET UG — official', authority: 'NTA', url: 'https://neet.nta.nic.in/', kind: 'HTML', cadenceMinutes: HOURLY, watchesExamSlug: 'neet-ug', watchesCycleYear: 2026 },
  { name: 'CUET UG — official', authority: 'NTA', url: 'https://cuet.nta.nic.in/', kind: 'HTML', cadenceMinutes: THRICE_DAILY, watchesExamSlug: 'cuet-ug', watchesCycleYear: 2026 },
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
  // SBI's careers page is authoritative for SBI PO, but the fetched body is
  // corporate PR — the only dates in it are award-ceremony dates. Bound anyway
  // so a future recruitment notice is picked up; the extractor finds nothing
  // today, which is the correct outcome rather than a defect.
  { name: 'SBI — careers', authority: 'SBI', url: 'https://sbi.co.in/web/careers', kind: 'HTML', cadenceMinutes: DAILY, watchesExamSlug: 'sbi-po', watchesCycleYear: 2026 },
  // The certificate's altnames list rrbchennai.gov.in but NOT www, so the www
  // form fails TLS verification outright. The apex serves 200 and redirects to
  // rrb.indianrailways.gov.in/chennai/.
  { name: 'RRB — Chennai', authority: 'RRB', url: 'https://rrbchennai.gov.in/', kind: 'HTML', cadenceMinutes: DAILY },

  // ── Engineering and management ────────────────────────────────────────────
  // The single most productive source on this list. Robots-allowed, 44 kB of
  // server-rendered HTML, and it carries a labelled IMPORTANT DATES table —
  // the only watched page that does. Everything the fact extractor can do
  // today, it can do because of this page.
  //
  // GATE moves to a new organising IIT, and a new host, every cycle. 2026 was
  // gate2026.iitg.ac.in; 2027 is IIT Madras. Dropping the 2026 URL retires it
  // (DEAD, history kept) on the next sources:seed rather than deleting it.
  // /important_dates is the page with the table, including the struck-through
  // earlier deadlines the extractor reads as revisions. Checked 2026-10-03.
  { name: 'GATE 2027 — important dates', authority: 'IIT', url: 'https://gate2027.iitm.ac.in/important_dates', kind: 'HTML', cadenceMinutes: DAILY, watchesExamSlug: 'gate', watchesCycleYear: 2027 },
  // Still showing the 2026 cycle as of 2026-10-03; no 2027 schedule yet.
  { name: 'JEE Advanced — official', authority: 'IIT', url: 'https://jeeadv.ac.in/', kind: 'HTML', cadenceMinutes: DAILY, watchesExamSlug: 'jee-advanced', watchesCycleYear: 2026 },
  // A JavaScript shell, so it yields nothing either way. Bound to 2026 because
  // the exam it announces, held in November 2026, is CAT 2026.
  { name: 'CAT — official', authority: 'IIM', url: 'https://iimcat.ac.in/', kind: 'HTML', cadenceMinutes: WEEKLY, watchesExamSlug: 'cat', watchesCycleYear: 2026 },

  // ── Law ───────────────────────────────────────────────────────────────────
  // CLAT is named for the admission year: CLAT 2027 is held on 6 Dec 2026.
  // Its schedule is in a PDF press release (the fetcher stores bodies as text,
  // so a PDF yields nothing) and the home page only links to it. Watched
  // anyway, so a date stated in the page's own HTML is picked up.
  { name: 'CLAT — Consortium of NLUs', authority: 'CNLU', url: 'https://consortiumofnlus.ac.in/', kind: 'HTML', cadenceMinutes: DAILY, watchesExamSlug: 'clat', watchesCycleYear: 2027 },
];

/**
 * Sources the fact extractor may read, i.e. those bound to exactly one exam.
 *
 * Derived, never hand-maintained — a second list would drift from the first,
 * and the failure mode of that drift is a date attributed to the wrong exam.
 */
export const EXTRACTABLE_SOURCE_SEEDS: readonly Required<
  Pick<SourceSeed, 'url' | 'watchesExamSlug' | 'watchesCycleYear'>
>[] = SOURCE_SEEDS.filter(
  (seed): seed is SourceSeed & { watchesExamSlug: string } => seed.watchesExamSlug !== undefined,
).map((seed) => {
  // A binding without a cycle is exactly the bug the field exists to prevent,
  // so it fails at import — in every test run — rather than at extraction.
  if (seed.watchesCycleYear === undefined) {
    throw new Error(`Source "${seed.name}" watches an exam but declares no watchesCycleYear`);
  }
  return {
    url: seed.url,
    watchesExamSlug: seed.watchesExamSlug,
    watchesCycleYear: seed.watchesCycleYear,
  };
});
