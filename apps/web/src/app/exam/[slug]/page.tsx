import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamDetailDto, ExamEventDto } from '@stc/types';
import {
  EntityBadge,
  EntityMark,
  Eyebrow,
  FactGrid,
  LastUpdated,
  Provenance,
  Section,
  StatusStamp,
  TableOfContents,
  Wrap,
  contentsOf,
  type EntityKind,
} from '@stc/ui';

import { ArrowRightIcon, ArrowUpRightIcon, PlusIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { getExam } from '@/lib/api';
import { expectedFor } from '@/lib/exam-expected';
import { isOnNtaCalendar } from '@/lib/nta-calendar';
import { EXAM_SECTIONS, sectionsFor, type ExamSection } from '@/lib/exam-sections';
import { JsonLd, breadcrumbSchema, examPageSchema, faqSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * THE REFERENCE PAGE — the standard every other page is measured against.
 *
 * The brief was "own one search intent completely". For "JEE Main 2026" that
 * means a visitor should not need a second tab. So the page answers, in the
 * order a first-time visitor asks:
 *
 *   When is it?          the four dates, above the fold, colour-coded by urgency
 *   Can I take it?       eligibility, linked
 *   What's on it?        syllabus and pattern, linked
 *   Where are papers?    with counts, so the link is worth clicking
 *   What did it look     year-by-year timeline with tentative dates labelled
 *   like last year?
 *   What do people ask?  FAQs answered inline, not linked away
 *
 * Every one of those is a page in the cluster. This hub links to all of them
 * and each links back, which is what makes the cluster legible to a crawler
 * rather than a pile of URLs.
 *
 * TIERING: this depth is affordable for ~200 hub pages. It is NOT what the
 * 20,000 individual paper pages get, and pretending otherwise is how a site
 * ends up with 100,000 thin near-duplicates. See docs/architecture for the
 * tiering rule.
 */

export const revalidate = 3600;

type Params = { slug: string };

async function load(slug: string): Promise<ExamDetailDto | null> {
  return getExam<ExamDetailDto>(slug);
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const exam = await load(slug);
  if (!exam) return {};

  const year = currentYear(exam);

  return buildMetadata({
    template: 'exam',
    values: {
      name: exam.name,
      shortName: exam.shortName,
      year,
      siteName: SITE.NAME,
    },
    path: exam.path,
    modifiedTime: exam.updatedAt,
    image: exam.logo ? { url: exam.logo.url, alt: exam.logo.alt ?? exam.name } : null,
    // Scored by the API against REQUIRED_FIELDS.EXAM_HUB. The scoring engine
    // existed in @stc/utils from the start and was simply never called here,
    // which is how 100 pages of placeholder data went out as "index, follow".
    noindex: !exam.isIndexable,
  });
}

/** The live cycle if one is flagged, else the newest we hold. */
function currentYear(exam: ExamDetailDto): number {
  const current = exam.years.find((y) => y.isCurrent);
  if (current) return current.year;
  const years = exam.years.map((y) => y.year);
  return years.length > 0 ? Math.max(...years) : new Date().getFullYear();
}

const DAY = 86_400_000;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / DAY);
}

function formatDate(iso: string | null): string {
  if (!iso) return 'To be announced';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

/**
 * Finds an event by EXAM_EVENT_TYPE, exactly.
 *
 * An earlier version matched on a substring, which quietly picked
 * APPLICATION_START for the registration deadline — showing the day the form
 * OPENS where the page promises the day it CLOSES, and making the "closing
 * soon" warning unreachable. On the single most consequential number on the
 * page, a near-enough match is worse than no match.
 */
function findEvent(events: readonly ExamEventDto[], type: string): ExamEventDto | undefined {
  return events.find((e) => e.type.toUpperCase() === type);
}

/** The date a deadline actually falls on. */
function eventDate(event: ExamEventDto | undefined): string | null {
  if (!event) return null;
  return event.endDate ?? event.startDate;
}

/**
 * An event that runs over several days, stated as the whole span.
 *
 * `eventDate` is right for a deadline — the day it closes — and wrong for an
 * exam: GATE 2027 runs 6–21 Feb, and showing its end date alone told a
 * student the exam was on the 21st, a fortnight after the first paper.
 */
function formatSpan(event: ExamEventDto | undefined): string {
  if (!event?.startDate) return formatDate(eventDate(event));
  const end = event.endDate;
  if (!end || end.slice(0, 10) === event.startDate.slice(0, 10)) return formatDate(event.startDate);

  const part = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'Asia/Kolkata' }).format(
      new Date(iso),
    );
  const sameMonth =
    part(event.startDate, { month: 'numeric', year: 'numeric' }) ===
    part(end, { month: 'numeric', year: 'numeric' });

  return sameMonth
    ? `${part(event.startDate, { day: 'numeric' })}–${formatDate(end)}`
    : `${part(event.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(end)}`;
}

/**
 * The one-line hint under each cluster link.
 *
 * Kept here rather than in EXAM_SECTIONS because it is hub-page copy, not part
 * of the section's own contract — the section route renders its `blurb`, which
 * is a full sentence and far too long for a card.
 */
const SECTION_NOTE: Record<ExamSection, string> = {
  'exam-pattern': 'Questions, marks, time',
  syllabus: 'Unit-wise tables',
  'previous-year-papers': 'Year-wise PDFs',
  result: 'Date and direct link',
  'admit-card': 'Download and issues',
  'answer-key': 'Official and unofficial',
};

/**
 * Which entity mark each cluster card wears. A result is a result; the other
 * three are documents the conducting body issues, so they share the paper mark
 * — the same split the section route uses for its badge.
 */
const SECTION_KIND: Record<ExamSection, EntityKind> = {
  'exam-pattern': 'paper',
  syllabus: 'syllabus',
  'previous-year-papers': 'paper',
  result: 'result',
  'admit-card': 'paper',
  'answer-key': 'paper',
};

const FREQUENCY_PHRASE: Record<string, string> = {
  ANNUAL: 'once a year',
  BIANNUAL: 'twice a year',
  QUARTERLY: 'four times a year',
  MULTIPLE_SESSIONS: 'in multiple sessions each year',
  ONE_TIME: 'as a one-time exam',
};

export default async function ExamPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const exam = await load(slug);
  if (!exam) notFound();

  const year = currentYear(exam);
  const cycle = exam.years.find((y) => y.isCurrent) ?? exam.years[0];
  const events = cycle?.events ?? [];

  const applicationOpens = findEvent(events, 'APPLICATION_START');
  const applicationCloses = findEvent(events, 'APPLICATION_END');
  const examDate = findEvent(events, 'EXAM_DATE');
  const result = findEvent(events, 'RESULT');

  const deadline = eventDate(applicationCloses);
  const closingIn = daysUntil(deadline);
  const isClosingSoon = closingIn !== null && closingIn >= 0 && closingIn <= 14;

  // Our own estimate, used ONLY for a tile the authority has left empty. An
  // official date always wins; see lib/exam-expected.ts for the rules.
  const expected = expectedFor(exam.slug, year);
  const expectedRegistration = !deadline && !applicationOpens ? expected?.registration : undefined;
  const expectedResult = !eventDate(result) ? expected?.result : undefined;
  const showsEstimate = Boolean(expectedRegistration ?? expectedResult);

  // What we can honestly claim about where these dates came from.
  //
  // "Official" requires BOTH dates and a source to point at. Without either,
  // the honest badge is "Not sourced" — which is also what tells a student to
  // go and check the authority themselves.
  const provenance:
    { confidence: 'official'; sourceUrl: string } | { confidence: 'tentative' | 'unsourced' } =
    events.length > 0 && exam.officialWebsite
      ? events.some((e) => e.isTentative)
        ? { confidence: 'tentative' }
        : { confidence: 'official', sourceUrl: exam.officialWebsite }
      : { confidence: 'unsourced' };

  // No category crumb: /exams/[category] has no route yet, so it rendered a
  // 404 link here and a 404 `item` in the BreadcrumbList JSON-LD. Put it back
  // when the category page exists.
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Exams', path: ROUTES.exams() },
    { name: exam.name, path: exam.path },
  ];

  // Written from what a visitor actually types into search, not invented to
  // fill a schema block. If we cannot answer a question honestly, it is not
  // here — fabricated FAQs are the fastest route to a manual action.
  const faqs = [
    {
      question: `What is the ${exam.name} ${year} exam date?`,
      answer: eventDate(examDate)
        ? `${exam.name} ${year} is scheduled for ${formatSpan(examDate)}${
            examDate?.isTentative ? '. This date is tentative and may change.' : '.'
          }`
        : `The ${exam.name} ${year} exam date has not been announced${
            exam.conductingBody ? ` by ${exam.conductingBody}` : ''
          } yet. This page is updated when the official notification is released.`,
    },
    {
      question: `Who conducts ${exam.name}?`,
      // A phrase map, not `frequency.toLowerCase()` — that produced
      // "conducted by the National Testing Agency, annual", which is the kind
      // of machine-generated sentence that makes a page read as spun.
      answer: exam.conductingBody
        ? `${exam.name} is conducted by ${exam.conductingBody}, held ${
            FREQUENCY_PHRASE[exam.frequency] ?? 'on a published schedule'
          }.`
        : `The conducting authority for ${exam.name} is not recorded on this page yet. We publish it once it is confirmed from the official notification.`,
    },
    {
      question: `Where can I download ${exam.name} previous year question papers?`,
      // Describes the policy, not an inventory. The page has no paper count,
      // so "papers are available on this site" was a claim it could not check
      // — and it stayed on screen when the paper table was empty.
      answer: `Where we hold ${exam.name} papers they are listed year-wise and shift-wise on this site, free and without registration. Solutions are included where the conducting body published an official answer key.`,
    },
  ];

  /**
   * Built from EXAM_SECTIONS — the same registry the section route and the
   * sitemap read.
   *
   * This list used to be written out by hand from ROUTES, and named all eight
   * intended cluster pages. Only four of them render: syllabus, exam-pattern,
   * eligibility and application-form have no content behind them, so
   * `isExamSection` rejects those slugs and the route calls `notFound()`.
   * The hub was therefore shipping four 404s per exam, in the one block on the
   * page whose entire job is internal linking — 80 dead links across the
   * cluster, all of them followed by a crawler on every pass.
   *
   * The sitemap had already been moved onto this registry for exactly this
   * reason. The page had not, which is how the two came to disagree again.
   */
  const clusterLinks = sectionsFor(exam.slug).map((key) => ({
    label: EXAM_SECTIONS[key].label,
    href: EXAM_SECTIONS[key].path(exam.slug),
    note: SECTION_NOTE[key],
    kind: SECTION_KIND[key],
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema(trail),
          examPageSchema({
            name: `${exam.name} ${year}`,
            // No overview means no description. A generated one adds nothing
            // a crawler cannot already read from the page, and asserts the
            // page has content when it may not.
            description: exam.overview,
            path: exam.path,
            modifiedTime: exam.updatedAt,
            conductingBody: exam.conductingBody,
            officialWebsite: exam.officialWebsite,
          }),
          faqSchema(faqs),
        ]}
      />

      {/* Breadcrumb leads; it places the page faster than the title does. */}
      <PageHero
        trail={trail}
        badges={
          <>
            <EntityBadge kind="exam" />
            {isClosingSoon ? (
              <StatusStamp tone="urgent" dot>
                Closes in {closingIn} {closingIn === 1 ? 'day' : 'days'}
              </StatusStamp>
            ) : null}
            {/* A label, not a link, until /exams/[category] exists. */}
            {exam.category ? <span className="chip">{exam.category.name}</span> : null}
          </>
        }
        title={`${exam.name} ${year}`}
        subtitle={exam.fullName}
        meta={
          <>
            {exam.conductingBody ? (
              <span>
                Conducted by <strong className="text-ink">{exam.conductingBody}</strong>
              </span>
            ) : null}
            <LastUpdated iso={exam.updatedAt} />
          </>
        }
      >
        {/* The four dates, above the fold. This is the answer for most
              visitors, and burying it under prose is the commonest mistake on
              competing exam pages. */}
        <div>
          <FactGrid
            items={[
              {
                label: 'Registration',
                value: deadline
                  ? `Ends ${formatDate(deadline)}`
                  : applicationOpens
                    ? `Opens ${formatDate(eventDate(applicationOpens))}`
                    : (expectedRegistration?.label ?? 'To be announced'),
                tone: isClosingSoon ? 'urgent' : 'plain',
              },
              { label: 'Exam', value: formatSpan(examDate) },
              {
                label: 'Result',
                value: expectedResult?.label ?? formatDate(eventDate(result)),
              },
              {
                label: 'Cycle',
                value: cycle?.sessionName ? `${year} · ${cycle.sessionName}` : String(year),
              },
            ]}
          />

          {/* Provenance is required by the component's type, so a page
                physically cannot render dates without declaring where they
                came from.

                The confidence is derived from what we ACTUALLY hold. The
                previous expression — `events.some(isTentative) ? … : 'official'`
                — returned 'official' for an exam with no events at all, since
                `[].some()` is false. That stamped a green Official badge on a
                page whose dates did not exist. */}
          {provenance.confidence === 'official' ? (
            <Provenance
              className="mt-4"
              confidence="official"
              sourceUrl={provenance.sourceUrl}
              sourceName={exam.conductingBody}
            />
          ) : (
            <Provenance
              className="mt-4"
              confidence={provenance.confidence}
              sourceName={exam.conductingBody}
            />
          )}

          {/* A second, separate line for anything above that is OUR guess.
                It never shares a badge with the official dates: a student has
                to be able to tell which tiles they can plan around. */}
          {showsEstimate && expected ? (
            <div className="mt-3 max-w-[78ch]">
              <Provenance confidence="estimated" />
              <p className="mt-1.5 text-[13.5px] text-ink-soft">
                {expected.basis} Based on{' '}
                {expected.sources.map((source, index) => (
                  <span key={source.url}>
                    {index > 0 ? ' and ' : ''}
                    <a
                      href={source.url}
                      className="underline"
                      rel="nofollow noopener"
                      target="_blank"
                    >
                      {source.name}
                    </a>
                  </span>
                ))}
                .
              </p>
            </div>
          ) : null}

          {/* NTA's calendar names this exam: point at the table and the
                notice, so a visitor can see the proposed date in NTA's own
                words even before it has been reviewed into the tiles above. */}
          {isOnNtaCalendar(exam.slug) ? (
            <p className="mt-3 text-[13.5px] text-ink-soft">
              NTA has listed this exam in its calendar up to March 2027.{' '}
              <Link href={ROUTES.ntaCalendar()} className="underline">
                See the calendar and download the notice
              </Link>
              .
            </p>
          ) : null}
        </div>
      </PageHero>

      <Wrap>
        <TableOfContents
          className="mt-10"
          items={contentsOf([
            exam.overview ? `About ${exam.shortName}` : null,
            `Everything about ${exam.shortName}`,
            'Important dates',
            'Previous year question papers',
            'Frequently asked questions',
            'Official source',
          ])}
        />

        {exam.overview ? (
          <Section title={`About ${exam.shortName}`} major>
            <div
              data-reveal
              className="card max-w-[78ch] p-6 text-[16px] leading-relaxed text-ink-soft"
            >
              {exam.overview}
            </div>
          </Section>
        ) : null}

        {/* PHASE 2 — the knowledge cluster, made navigable. Each of these is a
            page that links back here, so the hub is the centre of the cluster
            rather than one more leaf. */}
        <Section
          title={`Everything about ${exam.shortName}`}
          lede="Each section is a full page, kept current with the official notification."
          major
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {clusterLinks.map((link) => (
              <li key={link.href} data-reveal>
                <Link href={link.href} data-tilt className="card flex h-full flex-col gap-3 p-5">
                  <EntityMark kind={link.kind} />
                  <span className="mt-1 flex items-center justify-between gap-2 font-display text-[16.5px] font-semibold text-ink">
                    {link.label}
                    <ArrowRightIcon width={16} height={16} className="card-arrow text-ink-mute" />
                  </span>
                  <span className="text-[13.5px] text-ink-soft">{link.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Important dates"
          lede={`All announced ${exam.shortName} ${year} dates. Tentative entries are labelled — the agency has announced them but not finalised them.`}
        >
          {events.length === 0 ? (
            <p data-reveal className="card border-dashed p-5 text-[14.5px] text-ink-soft">
              {exam.conductingBody ?? 'The conducting body'} has not published the {year} schedule
              yet. This page updates when the official notification is released.
            </p>
          ) : (
            // A timeline: the rail and its nodes are drawn by the list items
            // themselves, so it is still an ordinary ordered list underneath.
            <ol className="relative ml-2 border-l-2 border-rule pl-6">
              {events.map((event) => {
                const until = daysUntil(event.endDate ?? event.startDate);
                return (
                  <li
                    key={event.id}
                    data-reveal
                    className="card relative mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[33px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-paper"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--color-brand), var(--color-cyan))',
                      }}
                    />
                    <div className="min-w-0">
                      <span className="text-[15px] font-semibold text-ink">{event.title}</span>
                      {event.isTentative ? (
                        <StatusStamp tone="wait" className="ml-2 align-middle">
                          Tentative
                        </StatusStamp>
                      ) : null}
                      {event.officialUrl ? (
                        <a
                          href={event.officialUrl}
                          rel="nofollow noopener"
                          target="_blank"
                          className="ml-2 text-[12.5px] underline"
                        >
                          Official notice
                        </a>
                      ) : null}
                    </div>
                    <div className="num shrink-0 text-[13.5px] text-ink-soft">
                      {formatDate(event.startDate)}
                      {event.endDate && event.endDate !== event.startDate
                        ? ` – ${formatDate(event.endDate)}`
                        : ''}
                      {until !== null && until >= 0 && until <= 30 ? (
                        <span className="ml-2 font-semibold text-urgent">in {until}d</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section
          title="Previous year question papers"
          lede="Where we hold them: year-wise and shift-wise PDFs, free and without registration. Solutions are included where an official answer key was published."
          actions={
            <Link href={ROUTES.examPapers(exam.slug)} className="btn btn-ghost">
              All {exam.shortName} papers
              <ArrowRightIcon width={16} height={16} />
            </Link>
          }
        >
          {/* Year tiles jump to an ANCHOR on the papers page, not to a
              per-year URL.

              They used to use ROUTES.examPapersByYear, which builds
              /exam/<slug>/previous-year-papers/<year> — a three-segment path
              with no route behind it. Every tile was a 404, up to six per exam
              hub, in a block whose whole purpose is to send a visitor deeper
              into the cluster. Same failure as the section grid above: ROUTES
              describes the URL space we INTEND, and linking to it before the
              route exists ships dead ends.

              An anchor is also the better answer on its own merits: a per-year
              page for an exam we hold no papers for would be a thin page, and
              there would be one for every exam-year pair. */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {exam.years.slice(0, 6).map((y) => (
              <li key={y.id} data-reveal>
                <Link
                  href={`${ROUTES.examPapers(exam.slug)}#year-${y.year}`}
                  data-tilt
                  className="card flex flex-col gap-0.5 p-4"
                >
                  <span className="num text-[20px] font-bold text-ink">{y.year}</span>
                  <span className="text-[12.5px] text-ink-mute">
                    {y.sessionName ?? 'All sessions'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Frequently asked questions"
          lede="Answered here rather than linked away. If a question cannot be answered honestly yet, it is not listed."
        >
          {/* Native <details>, so every answer is in the HTML a crawler reads
              and each one opens without JavaScript. The first starts open:
              it is the exam date, the question most visitors arrived with. */}
          <div className="grid gap-3">
            {faqs.map((faq, index) => (
              <details
                key={faq.question}
                data-reveal
                open={index === 0}
                className="faq card px-5 py-4"
              >
                <summary className="flex items-center justify-between gap-4 text-[15.5px] font-semibold text-ink">
                  {faq.question}
                  <PlusIcon className="faq-mark shrink-0 text-brand" />
                </summary>
                <p className="mt-3 max-w-[72ch] text-[14.5px] text-ink-soft">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section title="Official source">
          <div data-reveal className="card p-6">
            <Eyebrow>Always confirm before a deadline</Eyebrow>
            <p className="mt-2 max-w-[70ch] text-[14.5px] text-ink-soft">
              {exam.conductingBody
                ? `${exam.conductingBody} is the authority for ${exam.name}.`
                : `The conducting body for ${exam.name} is not recorded yet.`}{' '}
              Everything on this page is compiled from official notifications and may lag a same-day
              change.
            </p>
            {exam.officialWebsite ? (
              <a
                href={exam.officialWebsite}
                rel="nofollow noopener"
                target="_blank"
                className="btn btn-primary mt-4"
              >
                Visit {exam.conductingBody ?? 'official website'}
                <ArrowUpRightIcon width={16} height={16} />
              </a>
            ) : null}
          </div>
        </Section>
      </Wrap>
    </>
  );
}
