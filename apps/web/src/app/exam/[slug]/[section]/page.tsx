import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamDetailDto, ExamEventDto, PaperListItemDto, ResultListItemDto } from '@stc/types';
import {
  EntityBadge,
  LastUpdated,
  Provenance,
  Section,
  StatusStamp,
  TableOfContents,
  Wrap,
  contentsOf,
} from '@stc/ui';

import { ArrowUpRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { ApiError, getExam, listAllPapers, listResults } from '@/lib/api';
import { ContentBlocks } from '@/components/content-blocks';
import { examContent } from '@/lib/exam-content';
import {
  EXAM_SECTIONS,
  SECTION_EVENT,
  hasSection,
  isEditorialSection,
  isExamSection,
  sectionsFor,
  type ExamSection,
} from '@/lib/exam-sections';
import { PAPER_GUIDES } from '@/lib/paper-guides';
import { JsonLd, breadcrumbSchema, examPageSchema, faqSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * One route for the whole exam cluster.
 *
 * Four sections share a skeleton — breadcrumb, heading, the relevant date with
 * its provenance, the official link, and links back across the cluster. Only
 * the middle differs. Five near-identical files would have drifted; this
 * cannot, and adding a section is one entry in EXAM_SECTIONS.
 */

export const revalidate = 3600;

type Params = { slug: string; section: string };

/** The line under each "More about" card. Sections without one show the year's dates. */
const MORE_HINT: Partial<Record<ExamSection, string>> = {
  'exam-pattern': 'Questions, marks, time',
  syllabus: 'Unit-wise tables',
  'previous-year-papers': 'Year-wise PDFs',
};

function currentYear(exam: ExamDetailDto): number {
  const current = exam.years.find((y) => y.isCurrent);
  if (current) return current.year;
  const years = exam.years.map((y) => y.year);
  return years.length > 0 ? Math.max(...years) : new Date().getFullYear();
}

function eventsOf(exam: ExamDetailDto): readonly ExamEventDto[] {
  return (exam.years.find((y) => y.isCurrent) ?? exam.years[0])?.events ?? [];
}

function findEvent(exam: ExamDetailDto, type: string | undefined): ExamEventDto | undefined {
  if (!type) return undefined;
  return eventsOf(exam).find((e) => e.type.toUpperCase() === type);
}

function eventDate(event: ExamEventDto | undefined): string | null {
  return event ? (event.endDate ?? event.startDate) : null;
}

/**
 * Papers by year, newest first.
 *
 * The API already returns them sorted by year descending, so this preserves
 * that order rather than re-sorting — a Map keeps insertion order, and the one
 * thing that must not happen is the groups appearing in a different order from
 * the year tiles that link into them.
 */
function groupByYear(papers: readonly PaperListItemDto[]): Array<[number, PaperListItemDto[]]> {
  const byYear = new Map<number, PaperListItemDto[]>();
  for (const paper of papers) {
    const bucket = byYear.get(paper.year);
    if (bucket) bucket.push(paper);
    else byYear.set(paper.year, [paper]);
  }
  return [...byYear.entries()].map(([year, forYear]) => [year, [...forYear].sort(byExamDate)]);
}

/**
 * Within a year, newest sitting first.
 *
 * The API sorts by year only, so a year's 30 shifts arrive in no useful order.
 * Where `shift` opens with a date ("27 Jan 2024, Shift 1") that date decides;
 * papers without one fall back to their title, which keeps the order stable.
 */
function byExamDate(a: PaperListItemDto, b: PaperListItemDto): number {
  const diff = examDateOf(b) - examDateOf(a);
  if (diff !== 0) return diff;
  return (a.shift ?? a.title).localeCompare(b.shift ?? b.title, 'en', {
    numeric: true,
  });
}

function examDateOf(paper: PaperListItemDto): number {
  const match = paper.shift?.match(/^\d{1,2} [A-Za-z]{3,9} \d{4}/);
  const time = match ? Date.parse(`${match[0]} UTC`) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Not announced yet';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug, section } = await params;
  if (!isExamSection(section) || !hasSection(slug, section)) return {};

  const exam = await getExam<ExamDetailDto>(slug);
  if (!exam) return {};

  const year = currentYear(exam);
  const config = EXAM_SECTIONS[section];
  const heading = config.heading(exam.shortName, year);
  const written = isEditorialSection(section) ? examContent(exam.slug, section) : undefined;

  return buildMetadata({
    template: 'exam',
    values: {
      name: exam.name,
      shortName: exam.shortName,
      year,
      siteName: SITE.NAME,
    },
    path: config.path(exam.slug),
    title: heading,
    description: `${heading}. ${written?.lede ?? config.blurb}`,
    modifiedTime: written?.checkedOn ?? exam.updatedAt,
    // A cluster page inherits its parent's readiness. A result or admit-card
    // page for an exam whose facts are not sourced has nothing to say beyond
    // its own heading — it is the thinnest page on the site, and indexing it
    // spends crawl budget to tell a searcher we do not know.
    //
    // This was missed when noindex was wired into the hub: the hubs went
    // noindex while all 80 section pages kept serving "index, follow".
    noindex: !exam.isIndexable,
  });
}

export default async function ExamSectionPage({ params }: { params: Promise<Params> }) {
  const { slug, section } = await params;

  // An unknown section is a 404, not a redirect, and so is a written section
  // nobody has written for this exam yet. /exam/neet/syllabus does not exist,
  // and saying so honestly is better than a heading over an empty page.
  if (!isExamSection(section) || !hasSection(slug, section)) notFound();

  const exam = await getExam<ExamDetailDto>(slug);
  if (!exam) notFound();

  const year = currentYear(exam);
  const config = EXAM_SECTIONS[section as ExamSection];
  const event = findEvent(exam, SECTION_EVENT[section as ExamSection]);
  const date = eventDate(event);

  // Only the two data-backed sections pay for an extra request.
  let papers: PaperListItemDto[] = [];
  let results: ResultListItemDto[] = [];
  try {
    if (section === 'previous-year-papers') {
      // Every paper, not one page of them: the API ignores `limit` and returns
      // 20 rows by default, so the old `limit=40` request would have shown a
      // fraction of an exam's papers under a heading that counted them.
      papers = await listAllPapers<PaperListItemDto>(
        `sortBy=year&sortDir=desc&examId=${encodeURIComponent(exam.id)}`,
      );
    } else if (section === 'result') {
      results = await listResults<ResultListItemDto>(
        `limit=20&sort=year&dir=desc&examId=${encodeURIComponent(exam.id)}`,
      );
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[exam/${slug}/${section}] list unavailable: ${error.message}`);
  }

  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Exams', path: ROUTES.exams() },
    { name: exam.shortName, path: exam.path },
    { name: config.label, path: config.path(exam.slug) },
  ];

  const heading = config.heading(exam.shortName, year);

  const sourceUrl = event?.officialUrl ?? exam.officialWebsite;

  // Written guidance exists per exam, and only where we have papers to go with
  // it — advice on using papers above an empty list is the thin page again.
  const guide =
    section === 'previous-year-papers' && papers.length > 0 ? PAPER_GUIDES[exam.slug] : undefined;

  const written = isEditorialSection(section) ? examContent(exam.slug, section) : undefined;
  const faqs = written?.faqs ?? guide?.faqs;

  // The page's outline, in the order the sections render below. Built from the
  // same conditions as the sections themselves, so it cannot list one that is
  // not on the page. On the papers page each year is an entry of its own: a
  // year is what a visitor is scrolling for.
  const contents = [
    ...contentsOf([
      ...(written ? [...written.parts.map((part) => part.title), 'Questions students ask'] : []),
      SECTION_EVENT[section as ExamSection] ? `${config.label} date` : null,
      section === 'previous-year-papers' ? 'Papers' : null,
    ]),
    ...(section === 'previous-year-papers'
      ? groupByYear(papers).map(([paperYear]) => ({
          id: `year-${paperYear}`,
          title: `${paperYear} papers`,
        }))
      : []),
    ...contentsOf([
      ...(guide ? [...guide.sections.map((part) => part.title), 'Questions students ask'] : []),
      section === 'result' ? 'Declared results' : null,
      `More about ${exam.shortName}`,
      exam.officialWebsite ? 'Official source' : null,
    ]),
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema(trail),
          examPageSchema({
            name: heading,
            description: config.blurb,
            path: config.path(exam.slug),
            modifiedTime: exam.updatedAt,
            conductingBody: exam.conductingBody,
            officialWebsite: exam.officialWebsite,
          }),
          ...(faqs ? [faqSchema(faqs)] : []),
        ]}
      />

      <PageHero
        trail={trail}
        badges={
          <EntityBadge
            kind={section === 'result' ? 'result' : section === 'syllabus' ? 'syllabus' : 'paper'}
            label={config.label}
          />
        }
        title={heading}
        lede={written?.lede ?? config.blurb}
        meta={
          // `conductingBody` is nullable — "we have not sourced this yet" is a
          // real state, and the hub page already handles it. This did not,
          // and rendered a bare "Conducted by" followed by nothing on every
          // exam whose authority is not yet recorded. Today that is all of
          // them, so the string was on all 80 cluster pages.
          <>
            {exam.conductingBody ? (
              <span>
                Conducted by <strong className="text-ink">{exam.conductingBody}</strong>
              </span>
            ) : null}
            <LastUpdated iso={written?.checkedOn ?? exam.updatedAt} />
          </>
        }
      />

      <Wrap>
        <TableOfContents className="mt-10" items={contents} />

        {written ? (
          <>
            {/* Where this page comes from, before anything it says. The badge
              is "Official" because the link beside it is the conducting
              body's own document, and the type will not let it render
              without one. */}
            <div data-reveal className="card mt-10 p-5">
              <Provenance
                confidence="official"
                sourceUrl={written.source.url}
                sourceName={written.source.name}
              />
              {written.cycleNote ? (
                <p className="mt-2 max-w-[72ch] text-[13.5px] text-ink-mute">{written.cycleNote}</p>
              ) : null}
            </div>

            {written.parts.map((part, index) => (
              <Section key={part.title} title={part.title} major={index === 0}>
                <ContentBlocks blocks={part.blocks} />
              </Section>
            ))}

            <Section title="Questions students ask">
              <dl className="grid max-w-[72ch] gap-5">
                {written.faqs.map((faq) => (
                  <div key={faq.question} data-reveal>
                    <dt className="text-[16px] font-semibold text-ink">{faq.question}</dt>
                    <dd className="mt-1.5 text-[15px] text-ink-soft">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </>
        ) : null}

        {/* The date this page exists to answer, stated once and sourced. */}
        {SECTION_EVENT[section as ExamSection] ? (
          <Section title={`${config.label} date`} major>
            <div data-reveal className="card p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="num text-[clamp(24px,4vw,32px)] font-bold">
                  {formatDate(date)}
                </span>
                {event?.isTentative ? (
                  <StatusStamp tone="wait">Tentative</StatusStamp>
                ) : date ? (
                  <StatusStamp tone="ok" dot>
                    Announced
                  </StatusStamp>
                ) : (
                  <StatusStamp tone="quiet">Awaited</StatusStamp>
                )}
              </div>
              {/* "Estimated" used to be the no-date case, which claims an
                analysis we never made — the Estimated badge reads "our estimate
                from previous years". With no date and no source the honest
                badge is "Not sourced". And "official" now requires a URL by
                type, so it cannot be claimed with nothing to link to. */}
              {sourceUrl && date ? (
                event?.isTentative ? (
                  <Provenance
                    className="mt-3"
                    confidence="tentative"
                    sourceUrl={sourceUrl}
                    sourceName={exam.conductingBody}
                  />
                ) : (
                  <Provenance
                    className="mt-3"
                    confidence="official"
                    sourceUrl={sourceUrl}
                    sourceName={exam.conductingBody}
                  />
                )
              ) : (
                <Provenance
                  className="mt-3"
                  confidence="unsourced"
                  sourceName={exam.conductingBody}
                />
              )}
              {!date ? (
                <p className="mt-3 max-w-[66ch] text-[14px] text-ink-soft">
                  {exam.conductingBody ?? 'The conducting body'} has not announced this yet. This
                  page is updated when the official notification is released — it does not carry a
                  guessed date.
                </p>
              ) : null}
            </div>
          </Section>
        ) : null}

        {section === 'previous-year-papers' ? (
          <Section
            title="Papers"
            lede={`${papers.length > 0 ? `${papers.length} papers` : 'Papers'} for ${exam.shortName}, newest first.`}
          >
            {papers.length === 0 ? (
              <p data-reveal className="card border-dashed p-5 text-[14.5px] text-ink-soft">
                No papers are published for {exam.shortName} yet.
              </p>
            ) : (
              // GROUPED BY YEAR, with an `id` per group. The hub's year tiles
              // link to `#year-<year>`; without these headings those anchors
              // would resolve to the top of the page, which is the quiet
              // version of the dead link they replaced.
              groupByYear(papers).map(([year, forYear]) => (
                // scroll-mt clears the sticky header, or the year heading an
                // anchor jumps to would land underneath it.
                <div key={year} id={`year-${year}`} className="mb-8 scroll-mt-24">
                  <h3 data-reveal className="mb-3 num text-[20px] font-bold text-ink">
                    {year}
                    <span className="ml-2 font-normal text-[13px] text-ink-mute">
                      {forYear.length} {forYear.length === 1 ? 'paper' : 'papers'}
                    </span>
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {forYear.map((paper) => (
                      <li key={paper.id} data-reveal>
                        <Link
                          href={paper.path}
                          data-tilt
                          className="card flex h-full flex-col gap-1.5 p-4"
                        >
                          {/* Under a year heading on the exam's own page, the
                            exam name and year in a title are noise repeated on
                            every card. The sitting is what tells two cards
                            apart, so it leads where we have it. */}
                          <span className="text-[15px] font-semibold text-ink">
                            {paper.shift ?? paper.title}
                          </span>
                          <span className="num text-[12.5px] text-ink-mute">
                            {[
                              paper.setCode ?? (paper.shift ? 'Question paper' : 'All shifts'),
                              paper.hasSolution ? 'solved' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Section>
        ) : null}

        {guide ? (
          <>
            {guide.sections.map((part) => (
              <Section key={part.title} title={part.title}>
                <div data-reveal className="grid max-w-[72ch] gap-4 text-[15.5px] text-ink-soft">
                  {part.paragraphs.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                  {part.points ? (
                    <ul className="grid list-disc gap-2 pl-5">
                      {part.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Section>
            ))}

            <Section title="Questions students ask">
              <dl className="grid max-w-[72ch] gap-5">
                {guide.faqs.map((faq) => (
                  <div key={faq.question} data-reveal>
                    <dt className="text-[16px] font-semibold text-ink">{faq.question}</dt>
                    <dd className="mt-1.5 text-[15px] text-ink-soft">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </>
        ) : null}

        {section === 'result' ? (
          <Section
            title="Declared results"
            lede={`${exam.shortName} results we hold, newest first.`}
          >
            {results.length === 0 ? (
              <p data-reveal className="card border-dashed p-5 text-[14.5px] text-ink-soft">
                No results are published for {exam.shortName} yet.
              </p>
            ) : (
              <ul className="grid gap-3">
                {results.map((result) => (
                  <li
                    key={result.id}
                    data-reveal
                    className="card flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4"
                  >
                    <Link
                      href={result.path}
                      className="text-[15px] font-semibold no-underline hover:underline"
                    >
                      {result.title}
                    </Link>
                    <span className="num text-[13px] text-ink-soft">
                      {result.isDeclared ? formatDate(result.declaredAt) : 'Awaited'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        <Section title={`More about ${exam.shortName}`}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li data-reveal>
              <Link href={exam.path} data-tilt className="card block h-full p-5">
                <span className="font-display text-[16px] font-semibold text-ink">Overview</span>
                <span className="mt-1 block text-[13.5px] text-ink-soft">Dates and summary</span>
              </Link>
            </li>
            {/* Only the sections this exam has — a written section with no
              content for this exam is a 404, and must not be linked. */}
            {sectionsFor(exam.slug)
              .filter((key) => key !== section)
              .map((key) => (
                <li key={key} data-reveal>
                  <Link
                    href={EXAM_SECTIONS[key].path(exam.slug)}
                    data-tilt
                    className="card block h-full p-5"
                  >
                    <span className="font-display text-[16px] font-semibold text-ink">
                      {EXAM_SECTIONS[key].label}
                    </span>
                    <span className="mt-1 block text-[13.5px] text-ink-soft">
                      {MORE_HINT[key] ?? `${year} dates`}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Section>

        {exam.officialWebsite ? (
          <Section title="Official source">
            <div data-reveal className="card p-6">
              <p className="max-w-[70ch] text-[14.5px] text-ink-soft">
                {exam.conductingBody
                  ? `${exam.conductingBody} is the authority for ${exam.name}.`
                  : `This is the official site for ${exam.name}.`}{' '}
                Confirm anything on this page against it before acting on a deadline.
              </p>
              <a
                href={exam.officialWebsite}
                rel="nofollow noopener"
                target="_blank"
                className="btn btn-primary mt-4"
              >
                Visit {exam.conductingBody ?? 'official website'}
                <ArrowUpRightIcon width={16} height={16} />
              </a>
            </div>
          </Section>
        ) : null}
      </Wrap>
    </>
  );
}
