import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamDetailDto, ExamEventDto, PaperListItemDto, ResultListItemDto } from '@stc/types';
import { EntityBadge, LastUpdated, Provenance, Section, StatusStamp, Wrap } from '@stc/ui';

import { ApiError, getExam, listPapers, listResults } from '@/lib/api';
import { EXAM_SECTIONS, SECTION_EVENT, isExamSection, type ExamSection } from '@/lib/exam-sections';
import { JsonLd, breadcrumbSchema, examPageSchema } from '@/lib/seo/json-ld';
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
  if (!isExamSection(section)) return {};

  const exam = await getExam<ExamDetailDto>(slug);
  if (!exam) return {};

  const year = currentYear(exam);
  const config = EXAM_SECTIONS[section];
  const heading = config.heading(exam.shortName, year);

  return buildMetadata({
    template: 'exam',
    values: { name: exam.name, shortName: exam.shortName, year, siteName: SITE.NAME },
    path: config.path(exam.slug),
    title: heading,
    description: `${heading}. ${config.blurb}`,
    modifiedTime: exam.updatedAt,
  });
}

export default async function ExamSectionPage({ params }: { params: Promise<Params> }) {
  const { slug, section } = await params;

  // An unknown section is a 404, not a redirect. /exam/jee-main/syllabus does
  // not exist yet, and saying so honestly is better than silently sending the
  // visitor somewhere they did not ask for.
  if (!isExamSection(section)) notFound();

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
      papers = await listPapers<PaperListItemDto>(
        `limit=40&sort=year&dir=desc&examId=${encodeURIComponent(exam.id)}`,
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
        ]}
      />

      <Wrap>
        <nav aria-label="Breadcrumb" className="pt-5 text-[12.5px] text-ink-soft">
          <ol className="flex flex-wrap items-center gap-x-1.5">
            {trail.map((crumb, i) => (
              <li key={crumb.path} className="flex items-center gap-1.5">
                {i > 0 ? <span className="text-ink-mute">›</span> : null}
                {i === trail.length - 1 ? (
                  <span className="font-semibold text-ink">{crumb.name}</span>
                ) : (
                  <Link href={crumb.path} className="text-inherit no-underline hover:underline">
                    {crumb.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <header className="py-6">
          <EntityBadge kind={section === 'result' ? 'result' : 'paper'} label={config.label} />
          <h1 className="mt-3 text-[clamp(26px,5vw,40px)] leading-[1.08] tracking-tight">
            {heading}
          </h1>
          <p className="mt-3 max-w-[66ch] text-[15.5px] text-ink-soft">{config.blurb}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
            <span>
              Conducted by <strong className="text-ink">{exam.conductingBody}</strong>
            </span>
            <LastUpdated iso={exam.updatedAt} />
          </p>
        </header>

        {/* The date this page exists to answer, stated once and sourced. */}
        {SECTION_EVENT[section as ExamSection] ? (
          <Section title={`${config.label} date`} major>
            <div className="flex flex-wrap items-center gap-3">
              <span className="num text-[22px] font-bold">{formatDate(date)}</span>
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
            <Provenance
              className="mt-3"
              confidence={!date ? 'estimated' : event?.isTentative ? 'tentative' : 'official'}
              sourceUrl={event?.officialUrl ?? exam.officialWebsite}
              sourceName={exam.conductingBody}
            />
            {!date ? (
              <p className="mt-3 max-w-[66ch] text-[14px] text-ink-soft">
                {exam.conductingBody} has not announced this yet. This page is updated when the
                official notification is released — it does not carry a guessed date.
              </p>
            ) : null}
          </Section>
        ) : null}

        {section === 'previous-year-papers' ? (
          <Section
            title="Papers"
            lede={`${papers.length > 0 ? `${papers.length} papers` : 'Papers'} for ${exam.shortName}, newest first.`}
          >
            {papers.length === 0 ? (
              <p className="border border-dashed border-rule-hard bg-paper p-4 text-[14px] text-ink-soft">
                No papers are published for {exam.shortName} yet.
              </p>
            ) : (
              <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2">
                {papers.map((paper) => (
                  <li key={paper.id} className="bg-surface">
                    <Link
                      href={paper.path}
                      className="flex flex-col gap-1 p-3 no-underline hover:bg-row-hover"
                    >
                      <span className="text-[14.5px] font-semibold text-ink">{paper.title}</span>
                      <span className="num text-[12px] text-ink-mute">
                        {paper.year}
                        {paper.shift ? ` · ${paper.shift}` : ''}
                        {paper.hasSolution ? ' · solved' : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        {section === 'result' ? (
          <Section title="Declared results" lede={`${exam.shortName} results we hold, newest first.`}>
            {results.length === 0 ? (
              <p className="border border-dashed border-rule-hard bg-paper p-4 text-[14px] text-ink-soft">
                No results are published for {exam.shortName} yet.
              </p>
            ) : (
              <ul className="border-t-2 border-rule-hard">
                {results.map((result) => (
                  <li
                    key={result.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2.5"
                  >
                    <Link href={result.path} className="text-[14.5px] font-semibold no-underline">
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
          <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            <li className="bg-surface">
              <Link href={exam.path} className="block p-3 no-underline hover:bg-row-hover">
                <span className="text-[14px] font-semibold text-ink">Overview</span>
                <span className="mt-0.5 block text-[12.5px] text-ink-mute">Dates and summary</span>
              </Link>
            </li>
            {Object.entries(EXAM_SECTIONS)
              .filter(([key]) => key !== section)
              .map(([key, cfg]) => (
                <li key={key} className="bg-surface">
                  <Link
                    href={cfg.path(exam.slug)}
                    className="block p-3 no-underline hover:bg-row-hover"
                  >
                    <span className="text-[14px] font-semibold text-ink">{cfg.label}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-mute">
                      {cfg.label === 'Previous year papers' ? 'Year-wise PDFs' : `${year} dates`}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Section>

        {exam.officialWebsite ? (
          <Section title="Official source">
            <p className="max-w-[70ch] text-[14px] text-ink-soft">
              {exam.conductingBody} is the authority for {exam.name}. Confirm anything on this page
              against its site before acting on a deadline.
            </p>
            <a
              href={exam.officialWebsite}
              rel="nofollow noopener"
              target="_blank"
              className="mt-3 inline-block border-2 border-rule-hard px-3 py-1.5 text-[13.5px] font-semibold no-underline hover:bg-ink hover:text-paper"
            >
              Visit {exam.conductingBody} →
            </a>
          </Section>
        ) : null}

        <div className="h-10" />
      </Wrap>
    </>
  );
}
