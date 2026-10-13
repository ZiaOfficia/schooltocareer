import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import {
  EntityBadge,
  LastUpdated,
  Provenance,
  ScrollX,
  Section,
  TableOfContents,
  Wrap,
  contentsOf,
} from '@stc/ui';

import { ArrowUpRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { SSC_ABBREVIATIONS, SSC_CALENDAR, type SscCalendarRow } from '@/lib/ssc-calendar';

/**
 * SSC's examination calendar for the year, as a table you can read on a phone.
 *
 * The dates are SSC's, unchanged. What this page adds is the order a candidate
 * needs them in: what is still ahead comes first, each exam carries the name
 * people actually search for, and the three date columns are explained once.
 *
 * Re-rendered daily, because "still ahead" depends on today's month.
 */
export const revalidate = 86400;

const FAQS = [
  {
    question: 'Are these dates final?',
    answer:
      'No. SSC publishes this as a tentative calendar, so any row can move. The dates that count are the ones in the notice for each exam and, later, on the admit card.',
  },
  {
    question: 'When is SSC CGL 2026 on this calendar?',
    answer:
      'The calendar puts the SSC CGL 2026 notice in March 2026, the last date to apply in April 2026, and the Tier 1 computer-based exam in May to June 2026. It gives months only, not days.',
  },
  {
    question: 'Why does the calendar show only a month for most exams?',
    answer:
      'That is how SSC publishes it. For most exams the calendar names the month of the notice, the month applications close and the months of the exam. The exact days are announced separately on ssc.gov.in.',
  },
  {
    question: 'Does it include Tier 2 or later stages?',
    answer:
      'No. Each row covers the first stage only — Tier 1 or Paper 1. Dates for later stages are announced by SSC after the first stage.',
  },
  {
    question: 'What does “computer-based” mean here?',
    answer:
      'SSC marks these stages CBE, short for Computer Based Examination: you answer on a computer at a test centre, not on paper.',
  },
  {
    question: 'Who can take the Limited Departmental exams?',
    answer:
      'They are promotion exams for staff already working in government offices, not open recruitment. SSC marks two of the three as being for DoPT only.',
  },
];

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.sscCalendar(),
    title: `${SSC_CALENDAR.title}: CGL, CHSL, MTS`,
    description:
      'SSC’s tentative exam calendar for 2026-27 in one table: notice date, last date to apply and exam month for CGL, CHSL, MTS, JE, CPO, Stenographer, Selection Post and GD Constable.',
    modifiedTime: SSC_CALENDAR.checkedOn,
  });
}

/** This month as `YYYY-MM`, in India — the calendar's own time zone. */
function currentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

function CalendarTable({ rows, caption }: { rows: readonly SscCalendarRow[]; caption: string }) {
  return (
    <ScrollX>
      <table className="w-full min-w-[720px] border-collapse text-left text-[14.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-row-hover">
            {['Exam', 'Stage', 'Notice out', 'Apply by', 'Exam held in'].map((cell) => (
              <th
                key={cell}
                scope="col"
                className="whitespace-nowrap px-4 py-3 font-data text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-mute"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.exam} className="border-t border-rule align-top">
              <th scope="row" className="px-4 py-3 font-normal">
                {row.knownAs ? (
                  <span className="block text-[15.5px] font-semibold text-ink">
                    {row.examSlug ? (
                      <Link href={ROUTES.exam(row.examSlug)} className="underline">
                        {row.knownAs}
                      </Link>
                    ) : (
                      row.knownAs
                    )}
                  </span>
                ) : null}
                <span
                  className={
                    row.knownAs
                      ? 'mt-0.5 block text-[14px] text-ink-soft'
                      : 'block text-[15.5px] font-semibold text-ink'
                  }
                >
                  {row.exam}
                </span>
                {row.departmental ? (
                  <span className="mt-1 block text-[14px] text-ink-mute">
                    For serving staff only
                  </span>
                ) : null}
              </th>
              <td className="px-4 py-3 text-ink-soft">{row.stage}</td>
              <td className="num whitespace-nowrap px-4 py-3 text-ink-soft">{row.advertised}</td>
              <td className="num whitespace-nowrap px-4 py-3 text-ink-soft">{row.closes}</td>
              <td className="num whitespace-nowrap px-4 py-3 font-semibold text-ink">
                {row.examWindow}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

export default function SscCalendarPage() {
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'SSC exam calendar', path: ROUTES.sscCalendar() },
  ];

  const month = currentMonth();
  const rows: readonly SscCalendarRow[] = SSC_CALENDAR.rows;
  const ahead = rows.filter((row) => row.windowEnd >= month);
  const passed = rows.filter((row) => row.windowEnd < month);

  const AHEAD_TITLE = 'Exams still ahead';
  const PASSED_TITLE = 'Exam months already past';
  const READ_TITLE = 'How to read the dates';
  const SHORT_TITLE = 'Short forms used by SSC';
  const FAQ_TITLE = 'Questions candidates ask';

  return (
    <>
      <JsonLd data={[breadcrumbSchema(trail), faqSchema(FAQS)]} />

      <PageHero
        trail={trail}
        badges={<EntityBadge kind="exam" label="Exam calendar" />}
        title={SSC_CALENDAR.title}
        lede={`The ${rows.length} exams on the Staff Selection Commission’s calendar for ${SSC_CALENDAR.session}: when each notice comes out, the last date to apply, and the months the exam is planned for.`}
        meta={<LastUpdated iso={SSC_CALENDAR.checkedOn} />}
      />

      <Wrap>
        <div className="card mt-10 p-5">
          <Provenance
            confidence="tentative"
            sourceUrl={SSC_CALENDAR.source.url}
            sourceName={SSC_CALENDAR.source.name}
          />
          <p className="mt-2 max-w-[72ch] text-[14.5px] text-ink-soft">
            SSC itself calls this a tentative calendar, so treat every row as a plan that can
            change. The dates below are SSC’s, unchanged; confirm against the official page before
            you rely on one.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={SSC_CALENDAR.source.url}
              className="btn btn-primary"
              rel="nofollow noopener"
              target="_blank"
            >
              Open the calendar on ssc.gov.in
              <ArrowUpRightIcon width={16} height={16} />
            </a>
            <Link href={ROUTES.ntaCalendar()} className="btn btn-ghost">
              NTA exam calendar
            </Link>
          </div>
        </div>

        <TableOfContents
          className="mt-6"
          items={contentsOf([
            ahead.length > 0 ? AHEAD_TITLE : null,
            passed.length > 0 ? PASSED_TITLE : null,
            READ_TITLE,
            SHORT_TITLE,
            FAQ_TITLE,
          ])}
        />

        {ahead.length > 0 ? (
          <Section
            title={AHEAD_TITLE}
            lede="Exams whose planned months have not finished yet, in the order SSC lists them."
            major
          >
            <CalendarTable
              rows={ahead}
              caption={`SSC exams still ahead in ${SSC_CALENDAR.session}`}
            />
          </Section>
        ) : null}

        {passed.length > 0 ? (
          <Section
            title={PASSED_TITLE}
            lede="Exams whose planned months are over. This says what the calendar planned, not that the exam was held on time — SSC’s notices are the record of that."
            major={ahead.length === 0}
          >
            <CalendarTable
              rows={passed}
              caption={`SSC exams whose planned months in ${SSC_CALENDAR.session} are past`}
            />
          </Section>
        ) : null}

        <Section title={READ_TITLE}>
          <dl className="grid max-w-[72ch] gap-5">
            <div>
              <dt className="text-[16px] font-semibold text-ink">Notice out</dt>
              <dd className="mt-1.5 text-[15px] text-ink-soft">
                When SSC plans to publish the notice for the exam. Applications open with the
                notice, and it is the document that fixes eligibility, vacancies and the fee.
              </dd>
            </div>
            <div>
              <dt className="text-[16px] font-semibold text-ink">Apply by</dt>
              <dd className="mt-1.5 text-[15px] text-ink-soft">
                The planned last date to apply. Where SSC gives only a month, the exact day is in
                the notice.
              </dd>
            </div>
            <div>
              <dt className="text-[16px] font-semibold text-ink">Exam held in</dt>
              <dd className="mt-1.5 text-[15px] text-ink-soft">
                The month or months set aside for the first stage. An exam with many candidates runs
                over several days inside that window; your own day and shift come with the admit
                card.
              </dd>
            </div>
            <div>
              <dt className="text-[16px] font-semibold text-ink">Stage</dt>
              <dd className="mt-1.5 text-[15px] text-ink-soft">
                Which part of the exam the dates are for. The calendar lists the first stage only —
                Tier 1 or Paper 1 — and all of them are taken on a computer.
              </dd>
            </div>
          </dl>
        </Section>

        <Section title={SHORT_TITLE}>
          <ScrollX>
            <table className="w-full border-collapse text-left text-[14.5px]">
              <caption className="sr-only">
                Short forms in the SSC calendar and what they mean
              </caption>
              <thead>
                <tr className="bg-row-hover">
                  {['Short form', 'Stands for'].map((cell) => (
                    <th
                      key={cell}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-data text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-mute"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SSC_ABBREVIATIONS.map((item) => (
                  <tr key={item.short} className="border-t border-rule align-top">
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                      {item.short}
                    </th>
                    <td className="px-4 py-3 text-ink-soft">{item.full}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </Section>

        <Section title={FAQ_TITLE}>
          <dl className="grid max-w-[72ch] gap-5">
            {FAQS.map((faq) => (
              <div key={faq.question}>
                <dt className="text-[16px] font-semibold text-ink">{faq.question}</dt>
                <dd className="mt-1.5 text-[15px] text-ink-soft">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </Wrap>
    </>
  );
}
