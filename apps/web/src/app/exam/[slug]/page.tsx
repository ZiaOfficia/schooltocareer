import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamDetailDto, ExamEventDto } from '@stc/types';
import {
  EntityBadge,
  Eyebrow,
  FactGrid,
  LastUpdated,
  Provenance,
  Section,
  StatusStamp,
  Wrap,
} from '@stc/ui';

import { getExam } from '@/lib/api';
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

/** Picks the event a visitor most needs, by type keyword. */
function findEvent(events: readonly ExamEventDto[], keyword: string): ExamEventDto | undefined {
  const needle = keyword.toLowerCase();
  return events.find(
    (e) => e.type.toLowerCase().includes(needle) || e.title.toLowerCase().includes(needle),
  );
}

export default async function ExamPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const exam = await load(slug);
  if (!exam) notFound();

  const year = currentYear(exam);
  const cycle = exam.years.find((y) => y.isCurrent) ?? exam.years[0];
  const events = cycle?.events ?? [];

  const registration = findEvent(events, 'registration') ?? findEvent(events, 'application');
  const examDate = findEvent(events, 'exam');
  const result = findEvent(events, 'result');

  const closingIn = daysUntil(registration?.endDate ?? null);
  const isClosingSoon = closingIn !== null && closingIn >= 0 && closingIn <= 14;

  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Exams', path: ROUTES.exams() },
    ...(exam.category
      ? [{ name: exam.category.name, path: ROUTES.examCategory(exam.category.slug) }]
      : []),
    { name: exam.name, path: exam.path },
  ];

  // Written from what a visitor actually types into search, not invented to
  // fill a schema block. If we cannot answer a question honestly, it is not
  // here — fabricated FAQs are the fastest route to a manual action.
  const faqs = [
    {
      question: `What is the ${exam.name} ${year} exam date?`,
      answer: examDate?.startDate
        ? `${exam.name} ${year} is scheduled for ${formatDate(examDate.startDate)}${
            examDate.isTentative ? '. This date is tentative and may change.' : '.'
          }`
        : `The ${exam.name} ${year} exam date has not been announced by ${exam.conductingBody} yet. This page is updated when the official notification is released.`,
    },
    {
      question: `Who conducts ${exam.name}?`,
      answer: `${exam.name} is conducted by ${exam.conductingBody}${
        exam.frequency ? `, ${exam.frequency.toLowerCase().replace(/_/g, ' ')}` : ''
      }.`,
    },
    {
      question: `Where can I download ${exam.name} previous year question papers?`,
      answer: `Year-wise and shift-wise ${exam.name} papers are available on this site, free and without registration. Solutions are included where the conducting body published an official answer key.`,
    },
  ];

  const clusterLinks = [
    { label: 'Syllabus', href: ROUTES.examSyllabus(exam.slug), note: 'Subject-wise topics' },
    { label: 'Exam pattern', href: ROUTES.examPattern(exam.slug), note: 'Marks and duration' },
    { label: 'Eligibility', href: ROUTES.examEligibility(exam.slug), note: 'Age and qualification' },
    { label: 'Application form', href: ROUTES.examApplication(exam.slug), note: 'How to apply' },
    { label: 'Admit card', href: ROUTES.examAdmitCard(exam.slug), note: 'Download and issues' },
    { label: 'Answer key', href: ROUTES.examAnswerKey(exam.slug), note: 'Official and unofficial' },
    { label: 'Result', href: ROUTES.examResult(exam.slug), note: 'Date and direct link' },
    { label: 'Previous papers', href: ROUTES.examPapers(exam.slug), note: 'Year-wise PDFs' },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema(trail),
          examPageSchema({
            name: `${exam.name} ${year}`,
            description: exam.overview ?? `${exam.name} ${year} exam information.`,
            path: exam.path,
            modifiedTime: exam.updatedAt,
            conductingBody: exam.conductingBody,
            officialWebsite: exam.officialWebsite,
          }),
          faqSchema(faqs),
        ]}
      />

      <Wrap>
        {/* Breadcrumb leads; it places the page faster than the title does. */}
        <nav aria-label="Breadcrumb" className="pt-5 text-[12.5px] text-ink-soft">
          <ol className="flex flex-wrap items-center gap-x-1.5">
            {trail.map((crumb, index) => (
              <li key={crumb.path} className="flex items-center gap-1.5">
                {index > 0 ? <span className="text-ink-mute">›</span> : null}
                {index === trail.length - 1 ? (
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
          <div className="flex flex-wrap items-center gap-2">
            <EntityBadge kind="exam" />
            {isClosingSoon ? (
              <StatusStamp tone="urgent" dot>
                Closes in {closingIn} {closingIn === 1 ? 'day' : 'days'}
              </StatusStamp>
            ) : null}
            {exam.category ? (
              <Link
                href={ROUTES.examCategory(exam.category.slug)}
                className="border border-rule px-2 py-px font-data text-[10px] uppercase tracking-[0.09em] text-ink-soft no-underline hover:border-rule-hard"
              >
                {exam.category.name}
              </Link>
            ) : null}
          </div>

          <h1 className="mt-3 text-[clamp(28px,5vw,42px)] leading-[1.08] tracking-tight">
            {exam.name} {year}
          </h1>

          {exam.fullName ? (
            <p className="mt-1 text-[15px] text-ink-mute">{exam.fullName}</p>
          ) : null}

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
            <span>
              Conducted by <strong className="text-ink">{exam.conductingBody}</strong>
            </span>
            <LastUpdated iso={exam.updatedAt} />
          </p>

          {/* The four dates, above the fold. This is the answer for most
              visitors, and burying it under prose is the commonest mistake on
              competing exam pages. */}
          <div className="mt-5">
            <FactGrid
              items={[
                {
                  label: 'Registration',
                  value: registration?.endDate
                    ? `Ends ${formatDate(registration.endDate)}`
                    : formatDate(registration?.startDate ?? null),
                  tone: isClosingSoon ? 'urgent' : 'plain',
                },
                { label: 'Exam', value: formatDate(examDate?.startDate ?? null) },
                { label: 'Result', value: formatDate(result?.startDate ?? null) },
                {
                  label: 'Cycle',
                  value: cycle?.sessionName ? `${year} · ${cycle.sessionName}` : String(year),
                },
              ]}
            />

            {/* Provenance is required by the component's type, so a page
                physically cannot render dates without declaring where they
                came from. */}
            <Provenance
              className="mt-2"
              confidence={events.some((e) => e.isTentative) ? 'tentative' : 'official'}
              sourceUrl={exam.officialWebsite}
              sourceName={exam.conductingBody}
            />
          </div>
        </header>

        {exam.overview ? (
          <Section title={`About ${exam.shortName}`} major>
            <div className="max-w-[70ch] text-[15.5px] leading-relaxed text-ink-soft">
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
          <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            {clusterLinks.map((link) => (
              <li key={link.href} className="bg-surface">
                <Link
                  href={link.href}
                  className="flex h-full flex-col gap-1 p-3 no-underline hover:bg-row-hover"
                >
                  <span className="text-[14px] font-semibold text-ink">{link.label}</span>
                  <span className="text-[12.5px] text-ink-mute">{link.note}</span>
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
            <p className="border border-rule bg-paper p-4 text-[14px] text-ink-soft">
              {exam.conductingBody} has not published the {year} schedule yet. This page updates
              when the official notification is released.
            </p>
          ) : (
            <ol className="border-t-2 border-rule-hard">
              {events.map((event) => {
                const until = daysUntil(event.endDate ?? event.startDate);
                return (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-[14.5px] font-semibold text-ink">{event.title}</span>
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
                        <span className="ml-2 text-urgent">in {until}d</span>
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
          lede="Year-wise and shift-wise PDFs, free and without registration. Solutions are included where an official answer key was published."
          actions={
            <Link href={ROUTES.examPapers(exam.slug)} className="text-[13.5px]">
              All {exam.shortName} papers →
            </Link>
          }
        >
          <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6">
            {exam.years.slice(0, 6).map((y) => (
              <li key={y.id} className="bg-surface">
                <Link
                  href={ROUTES.examPapersByYear(exam.slug, y.year)}
                  className="flex flex-col gap-0.5 p-3 no-underline hover:bg-row-hover"
                >
                  <span className="num text-[15px] font-bold text-ink">{y.year}</span>
                  <span className="text-[12px] text-ink-mute">
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
          <dl className="border-t-2 border-rule-hard">
            {faqs.map((faq) => (
              <div key={faq.question} className="border-b border-rule py-3">
                <dt className="text-[15px] font-semibold text-ink">{faq.question}</dt>
                <dd className="mt-1 max-w-[70ch] text-[14px] text-ink-soft">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Official source">
          <Eyebrow>Always confirm before a deadline</Eyebrow>
          <p className="mt-2 max-w-[70ch] text-[14px] text-ink-soft">
            {exam.conductingBody} is the authority for {exam.name}. Everything on this page is
            compiled from its notifications and may lag a same-day change.
          </p>
          {exam.officialWebsite ? (
            <a
              href={exam.officialWebsite}
              rel="nofollow noopener"
              target="_blank"
              className="mt-3 inline-block border-2 border-rule-hard px-3 py-1.5 text-[13.5px] font-semibold no-underline hover:bg-ink hover:text-paper"
            >
              Visit {exam.conductingBody} →
            </a>
          ) : null}
        </Section>
      </Wrap>
    </>
  );
}
