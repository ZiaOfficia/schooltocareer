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
import { NTA_CALENDAR, type CalendarRow } from '@/lib/nta-calendar';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * NTA's examination calendar as a table you can read, with the notice itself
 * as a download.
 *
 * The notice is a scanned image. This page is the same content as text: one
 * table per month, the dates exactly as NTA gives them, and the badge says
 * "Tentative" because NTA says so on the notice — not because we doubt it.
 */

const FAQS = [
  {
    question: 'Are these dates final?',
    answer:
      'No. NTA calls every date on this calendar tentative and says it may change. The firm dates come later, in the information bulletin and the notices for each exam.',
  },
  {
    question: 'Why is the April session of JEE Main not here?',
    answer:
      'This calendar stops at March 2027, so it only has Session 1 of JEE Main, in January. NTA has not published a date for the April session yet.',
  },
  {
    question: 'What is a buffer day?',
    answer:
      'A spare day NTA keeps free after an exam in case it is needed. No exam is planned for it.',
  },
];

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.ntaCalendar(),
    title: NTA_CALENDAR.title,
    description:
      'NTA exam dates from December 2026 to March 2027 in one table, including JEE Main Session 1, UGC NET, CMAT and CUET PG, with the official notice to download.',
    modifiedTime: NTA_CALENDAR.checkedOn,
  });
}

function examCell(row: CalendarRow) {
  if (!row.examSlug) return row.exam;
  return (
    <Link href={ROUTES.exam(row.examSlug)} className="underline">
      {row.exam}
    </Link>
  );
}

export default function NtaCalendarPage() {
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'NTA exam calendar', path: ROUTES.ntaCalendar() },
  ];

  const total = NTA_CALENDAR.months.reduce((sum, month) => sum + month.rows.length, 0);

  return (
    <>
      <JsonLd data={[breadcrumbSchema(trail), faqSchema(FAQS)]} />

      <PageHero
        trail={trail}
        badges={<EntityBadge kind="exam" label="Exam calendar" />}
        title={NTA_CALENDAR.title}
        lede={`The ${total} exams NTA plans to hold in these four months, with the dates as NTA has published them.`}
        meta={<LastUpdated iso={NTA_CALENDAR.checkedOn} />}
      />

      <Wrap>
        <div className="card mt-10 p-5">
          <Provenance
            confidence="tentative"
            sourceUrl={NTA_CALENDAR.source.url}
            sourceName={NTA_CALENDAR.source.name}
          />
          <p className="mt-2 max-w-[72ch] text-[14px] text-ink-soft">
            NTA’s own note on the calendar: the dates are tentative and may change for
            administrative, academic, statutory, logistical or other unforeseen reasons.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={NTA_CALENDAR.downloadUrl} className="btn btn-primary">
              Download the notice (PDF, {NTA_CALENDAR.downloadSize})
            </a>
            <a
              href={NTA_CALENDAR.source.url}
              className="btn btn-ghost"
              rel="nofollow noopener"
              target="_blank"
            >
              Open on nta.ac.in
              <ArrowUpRightIcon width={16} height={16} />
            </a>
          </div>
        </div>

        <TableOfContents
          className="mt-6"
          items={contentsOf([
            ...NTA_CALENDAR.months.map((month) => month.month),
            'Questions students ask',
          ])}
        />

        {NTA_CALENDAR.months.map((month, index) => (
          <Section key={month.month} title={month.month} major={index === 0}>
            <div>
              <ScrollX>
                <table className="w-full border-collapse text-left text-[14.5px]">
                  <caption className="sr-only">NTA exams in {month.month}</caption>
                  <thead>
                    <tr className="bg-row-hover">
                      {['Exam', 'Proposed dates', 'Days'].map((cell) => (
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
                    {month.rows.map((row: CalendarRow) => (
                      <tr key={row.exam} className="border-t border-rule align-top">
                        <th scope="row" className="px-4 py-3 font-semibold text-ink">
                          {examCell(row)}
                        </th>
                        <td className="num px-4 py-3 text-ink-soft">{row.dates}</td>
                        <td className="num whitespace-nowrap px-4 py-3 text-ink-soft">
                          {row.duration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
            </div>
          </Section>
        ))}

        <Section title="Questions students ask">
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
