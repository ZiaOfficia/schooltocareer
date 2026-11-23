import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import { EntityBadge, LastUpdated, Section, Wrap } from '@stc/ui';

import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { BOARD_PREP } from '@/lib/board-prep';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/** The hub for every board-exam prep guide. Lists what lib/board-prep holds. */
export const revalidate = 86400;

const TITLE = 'Board Exam 2027 Preparation: CBSE, UP Board, ICSE, ISC';

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.boardPrepHub(),
    title: TITLE,
    description:
      'Important chapters with official unit marks, answer-writing tips, a 30-day plan and official papers for CBSE, UP Board, ICSE and ISC Class 10 and 12 board exams 2027.',
    modifiedTime: BOARD_PREP.checkedOn,
  });
}

export default function BoardPrepHub() {
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Board exams 2027', path: ROUTES.boardPrepHub() },
  ];
  const boards = [...new Set(BOARD_PREP.order.map((slug) => BOARD_PREP.guides[slug].board))];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />
      <PageHero
        trail={trail}
        badges={<EntityBadge kind="board" label={`Board exams ${BOARD_PREP.exam}`} />}
        title="Board Exam 2027: Important Chapters, Answer Tips and Papers"
        lede="Pick your board and class. Each guide ranks the chapters by the marks the board itself gives them, explains how to write answers and revise fast, and links to the board's official papers."
        meta={<LastUpdated iso={BOARD_PREP.checkedOn} />}
      />
      <Wrap>
        {boards.map((board) => (
          <Section key={board} title={board} major>
            <ul className="grid gap-4 sm:grid-cols-2">
              {BOARD_PREP.order
                .filter((slug) => BOARD_PREP.guides[slug].board === board)
                .map((slug) => {
                  const guide = BOARD_PREP.guides[slug];
                  return (
                    <li key={slug}>
                      <Link
                        href={ROUTES.boardPrep(slug)}
                        className="card flex h-full flex-col gap-2 p-5"
                      >
                        <span className="flex items-center justify-between gap-2 font-display text-[18px] font-semibold text-ink">
                          {guide.label}
                          <ArrowRightIcon
                            width={16}
                            height={16}
                            className="card-arrow text-ink-mute"
                          />
                        </span>
                        <span className="text-[14.5px] text-ink-soft">{guide.description}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </Section>
        ))}

        <Section title="Download everything">
          <p className="mb-4 max-w-[72ch] text-[15px] text-ink-soft">
            One spreadsheet with a tab for every guide, the official papers and the exam tips. It
            opens in Excel, or open the read-only Google Sheet and use File &rarr; Make a copy.
          </p>
          <div className="grid gap-2.5 sm:flex sm:flex-wrap">
            <a href={BOARD_PREP.download.xlsx} download className="btn btn-primary">
              Download spreadsheet (.xlsx)
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
        </Section>
      </Wrap>
    </>
  );
}
