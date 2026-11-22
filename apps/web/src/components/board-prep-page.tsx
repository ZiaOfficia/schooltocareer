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

import { ArrowRightIcon, ArrowUpRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import {
  BOARD_PREP,
  paperOutOf,
  priorityOf,
  type BoardGuideSlug,
  type Priority,
} from '@/lib/board-prep';
import { JsonLd, articleSchema, breadcrumbSchema, faqSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * The board-exam prep page for one board and class (CBSE 10/12, UP Board
 * 10/12, ICSE 10, ISC 12). Every /<guide>-important-chapters route renders
 * this, from lib/board-prep.
 */

const OVERVIEW_TITLE = 'Which units carry the most marks';
const PAPERS_TITLE = 'Official question papers';
const PATTERN_TITLE = 'How the paper is set';
const PLAN_TITLE = '30-day plan and exam-day tips';
const DOWNLOAD_TITLE = 'Download this plan';
const FAQ_TITLE = 'Frequently asked questions';

function subjectTitle(name: string): string {
  return `${name}: important chapters and how to prepare`;
}

export function boardPrepMetadata(slug: BoardGuideSlug) {
  const cls = BOARD_PREP.guides[slug];
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.boardPrep(slug),
    title: cls.title,
    description: cls.description,
    modifiedTime: BOARD_PREP.checkedOn,
  });
}

const PRIORITY_STYLE: Record<Priority, string> = {
  High: 'bg-[color-mix(in_srgb,#dc2626_14%,transparent)] text-[#b91c1c]',
  Medium: 'bg-[color-mix(in_srgb,#d97706_14%,transparent)] text-[#b45309]',
  Low: 'bg-[color-mix(in_srgb,#16a34a_14%,transparent)] text-[#15803d]',
};

function PriorityPill({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className="text-ink-mute">Whole paper</span>;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 font-data text-[12px] font-semibold ${PRIORITY_STYLE[priority]}`}
    >
      {priority}
    </span>
  );
}

const TH =
  'whitespace-nowrap px-4 py-3 font-data text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-mute';

function TableHead({ cells }: { cells: readonly string[] }) {
  return (
    <thead>
      <tr className="bg-row-hover">
        {cells.map((cell) => (
          <th key={cell} scope="col" className={TH}>
            {cell}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function FileLink({ href, label }: { href: string; label: string }) {
  const kind = href.toLowerCase().endsWith('.zip')
    ? 'ZIP'
    : href.toLowerCase().endsWith('.pdf')
      ? 'PDF'
      : null;
  return (
    <a href={href} rel="noopener" className="inline-flex items-center gap-1 underline">
      {label}
      {kind ? <span className="font-data text-[11.5px] text-ink-mute">({kind})</span> : null}
      <ArrowUpRightIcon width={13} height={13} />
    </a>
  );
}

function DownloadButtons({ slug }: { slug: BoardGuideSlug }) {
  const csv = BOARD_PREP.download.csv[slug];
  return (
    <div className="flex flex-wrap gap-2.5">
      <a href={BOARD_PREP.download.xlsx} download className="btn btn-primary">
        Download spreadsheet (.xlsx)
      </a>
      <a href={csv} download className="btn btn-ghost">
        Download {BOARD_PREP.guides[slug].label} as CSV
      </a>
      <a
        href={BOARD_PREP.download.googleSheet}
        target="_blank"
        rel="noopener"
        className="btn btn-ghost"
      >
        Open in Google Sheets
      </a>
    </div>
  );
}

export function BoardPrepPage({ slug }: { slug: BoardGuideSlug }) {
  const cls = BOARD_PREP.guides[slug];
  const others = BOARD_PREP.order.filter((s) => s !== slug).map((s) => BOARD_PREP.guides[s]);
  const path = ROUTES.boardPrep(slug);
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Board exams 2027', path: ROUTES.boardPrepHub() },
    { name: `${cls.label} important chapters`, path },
  ];

  // Every unit with marks, largest share first: the "study this first" list.
  const ranked = cls.subjects
    .flatMap((subject) =>
      subject.units
        .filter((unit) => unit.marks !== null)
        .map((unit) => {
          const outOf = paperOutOf(cls, subject);
          return {
            subject: subject.name,
            unit: unit.unit,
            marks: unit.marks as number,
            outOf,
            priority: priorityOf(unit.marks, outOf),
            share: outOf ? (unit.marks as number) / outOf : 0,
          };
        }),
    )
    .sort((a, b) => b.share - a.share);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema(trail),
          faqSchema(cls.faqs),
          articleSchema({
            headline: cls.h1,
            description: cls.description,
            path,
            publishedTime: BOARD_PREP.checkedOn,
            modifiedTime: BOARD_PREP.checkedOn,
          }),
        ]}
      />

      <PageHero
        trail={trail}
        badges={<EntityBadge kind="board" label={`${cls.label} · ${BOARD_PREP.exam}`} />}
        title={cls.h1}
        lede={cls.description}
        meta={<LastUpdated iso={BOARD_PREP.checkedOn} />}
      />

      <Wrap>
        <div className="card mt-10 p-5">
          <Provenance
            confidence="official"
            sourceUrl={cls.source.url}
            sourceName={cls.source.name}
          />
          <p className="mt-2 max-w-[72ch] text-[14.5px] text-ink-soft">
            {ranked.length > 0
              ? `The marks for each unit are the ${cls.board}'s own, for the ${BOARD_PREP.exam} exam. `
              : `${cls.board} does not publish marks for each chapter, so this guide shows how the paper is set instead. `}
            The priority labels and the answer and revision tips are our own guidance. Paper links
            open the board&rsquo;s own website or files.
          </p>
        </div>

        <div className="mt-8 grid max-w-[72ch] gap-4 text-[16px] leading-relaxed text-ink-soft">
          {cls.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-6">
          <DownloadButtons slug={slug} />
        </div>

        <TableOfContents
          className="mt-8"
          items={contentsOf([
            ranked.length > 0 ? OVERVIEW_TITLE : null,
            PATTERN_TITLE,
            ...cls.subjects.map((subject) => subjectTitle(subject.name)),
            PAPERS_TITLE,
            PLAN_TITLE,
            DOWNLOAD_TITLE,
            FAQ_TITLE,
          ])}
        />

        {ranked.length > 0 ? (
          <Section
            title={OVERVIEW_TITLE}
            lede="Every unit with a published mark, ranked by its share of the theory paper. Start at the top."
            major
          >
            <ScrollX>
              <table className="w-full min-w-[640px] border-collapse text-left text-[14.5px]">
                <caption className="sr-only">
                  CBSE {cls.label} units ranked by share of the theory paper
                </caption>
                <TableHead cells={['Subject', 'Unit', 'Marks', 'Share of paper', 'Priority']} />
                <tbody>
                  {ranked.map((row) => (
                    <tr
                      key={`${row.subject}-${row.unit}`}
                      className="border-t border-rule align-top"
                    >
                      <td className="px-4 py-3 text-ink-soft">{row.subject}</td>
                      <th scope="row" className="px-4 py-3 font-semibold text-ink">
                        {row.unit}
                      </th>
                      <td className="px-4 py-3 font-data">
                        {row.marks}
                        {row.outOf ? <span className="text-ink-mute"> / {row.outOf}</span> : null}
                      </td>
                      <td className="px-4 py-3 font-data">{Math.round(row.share * 100)}%</td>
                      <td className="px-4 py-3">
                        <PriorityPill priority={row.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
            <p className="mt-4 max-w-[72ch] text-[14.5px] text-ink-soft">
              High means at least 18% of the theory paper, medium 10&ndash;17%, low under 10%. Low
              priority means fewer marks, not none: revise every chapter at least once.
            </p>
          </Section>
        ) : null}

        <Section title={PATTERN_TITLE} major={ranked.length === 0}>
          <ul className="grid max-w-[72ch] list-disc gap-2 pl-5 text-[15px] text-ink-soft">
            {cls.notes.map((note) => (
              <li key={note.slice(0, 40)}>{note}</li>
            ))}
          </ul>
        </Section>

        {cls.subjects.map((subject) => {
          const outOf = paperOutOf(cls, subject);
          return (
            <Section
              key={subject.name}
              title={subjectTitle(subject.name)}
              lede={
                [
                  subject.code ? `Subject code ${subject.code}` : null,
                  outOf && subject.units.some((unit) => unit.marks !== null)
                    ? `theory paper of ${outOf} marks`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Chapters, how to answer, and how to revise fast.'
              }
            >
              {subject.units.some((unit) => unit.marks !== null) ? (
                <ScrollX>
                  <table className="w-full min-w-[640px] border-collapse text-left text-[14.5px]">
                    <caption className="sr-only">{subject.name} units and marks</caption>
                    <TableHead cells={['Unit', 'Chapters', 'Marks', 'Priority']} />
                    <tbody>
                      {subject.units.map((unit) => (
                        <tr key={unit.unit} className="border-t border-rule align-top">
                          <th scope="row" className="px-4 py-3 font-semibold text-ink">
                            {unit.unit}
                          </th>
                          <td className="px-4 py-3 text-ink-soft">{unit.chapters}</td>
                          <td className="px-4 py-3 font-data">{unit.marks ?? '—'}</td>
                          <td className="px-4 py-3">
                            <PriorityPill priority={priorityOf(unit.marks, outOf)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollX>
              ) : null}

              <div className="mt-6 grid gap-6">
                {subject.units.map((unit) => (
                  <div key={unit.unit} className="max-w-[72ch]">
                    <h3 className="text-[17px] font-semibold text-ink">
                      {unit.unit}
                      {unit.marks !== null ? (
                        <span className="font-normal text-ink-mute"> · {unit.marks} marks</span>
                      ) : null}
                    </h3>
                    {unit.marks === null ? (
                      <p className="mt-1 text-[14.5px] text-ink-mute">{unit.chapters}</p>
                    ) : null}
                    <dl className="mt-2 grid gap-2 text-[15px]">
                      <div>
                        <dt className="font-semibold text-ink">How to write the answer</dt>
                        <dd className="text-ink-soft">{unit.answer}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">How to prepare fast</dt>
                        <dd className="text-ink-soft">{unit.prep}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </Section>
          );
        })}

        <Section title={PAPERS_TITLE} lede={cls.papersNote} major>
          <ScrollX>
            <table className="w-full min-w-[560px] border-collapse text-left text-[14.5px]">
              <caption className="sr-only">{cls.label} official question papers</caption>
              <TableHead cells={['Subject', 'Official papers']} />
              <tbody>
                {cls.papers.map((paper) => (
                  <tr key={paper.subject} className="border-t border-rule align-top">
                    <th scope="row" className="px-4 py-3 font-semibold text-ink">
                      {paper.subject}
                    </th>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-x-4 gap-y-1">
                        {paper.links.map((link) => (
                          <FileLink
                            key={link.url + link.label}
                            href={link.url}
                            label={link.label}
                          />
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
          <p className="mt-4 max-w-[72ch] text-[14.5px] text-ink-soft">
            Official source:{' '}
            <a href={cls.source.papersUrl} rel="noopener" className="underline">
              {cls.source.papersUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
            . Solve each paper in the full exam time, then check it against the marking scheme or
            answer key.
          </p>
        </Section>

        <Section title={PLAN_TITLE}>
          <ScrollX>
            <table className="w-full min-w-[640px] border-collapse text-left text-[14.5px]">
              <caption className="sr-only">Revision plan and exam-day tips</caption>
              <TableHead cells={['When', 'What to do', 'Why it works']} />
              <tbody>
                {BOARD_PREP.tips.map(([when, what, why]) => (
                  <tr key={what} className="border-t border-rule align-top">
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                      {when}
                    </th>
                    <td className="px-4 py-3 text-ink-soft">{what}</td>
                    <td className="px-4 py-3 text-ink-soft">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </Section>

        <Section title={DOWNLOAD_TITLE}>
          <p className="mb-4 max-w-[72ch] text-[15px] text-ink-soft">
            Every board&rsquo;s guide in one spreadsheet &mdash; a tab each for CBSE, UP Board, ICSE
            and ISC, plus the official papers and the exam tips. It opens in Excel, and in Google
            Sheets with File &rarr; Import &rarr; Upload. The CSV opens anywhere, including Google
            Sheets.
          </p>
          <DownloadButtons slug={slug} />
          <h3 className="mt-8 text-[17px] font-semibold text-ink">Guides for other boards</h3>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
            {others.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={ROUTES.boardPrep(guide.slug)}
                  className="inline-flex items-center gap-1.5 underline"
                >
                  {guide.label}
                  <ArrowRightIcon width={14} height={14} />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={FAQ_TITLE}>
          <dl className="grid max-w-[72ch] gap-5">
            {cls.faqs.map((faq) => (
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
