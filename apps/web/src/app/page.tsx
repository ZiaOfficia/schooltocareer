import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamListItemDto, PracticeExamDto } from '@stc/types';
import { Wrap } from '@stc/ui';

import { HeroPhotos } from '@/components/hero-photos';
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  ShieldCheckIcon,
  TargetIcon,
  TimerIcon,
  UnlockIcon,
} from '@/components/icons';
import { ApiError, listExams, listPractice } from '@/lib/api';
import { ARTICLES, articleImageUrl, articlePath, readingMinutes } from '@/lib/articles';
import { BOARD_PREP, paperOutOf, type BoardGuide } from '@/lib/board-prep';
import { examsWithContent } from '@/lib/exam-content';
import { examDisplayName } from '@/lib/exam-name';
import { EXAM_SECTIONS, isEditorialSection, sectionsFor } from '@/lib/exam-sections';
import { buildMetadata } from '@/lib/seo/metadata';
import { LIVE } from '@/lib/site-sections';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.home(),
    title: `${SITE.NAME}: Board Exam & Entrance Exam Preparation`,
    description:
      'Important chapters for CBSE, UP Board, ICSE and ISC 2027, plus JEE, NEET, CLAT and NDA patterns, past papers and free mock tests from official sources.',
  });
}

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/** What the site promises, said once each. No invented numbers. */
const PROMISES: ReadonlyArray<{ Icon: IconType; title: string; body: string }> = [
  {
    Icon: ShieldCheckIcon,
    title: 'From official sources',
    body: 'Every mark, date and pattern comes from the board’s or conducting body’s own documents.',
  },
  {
    Icon: ClockIcon,
    title: 'Dated, so you can judge it',
    body: 'Each page shows when it was last checked.',
  },
  {
    Icon: UnlockIcon,
    title: 'Free, no sign-up',
    body: 'Nothing is held back behind an account.',
  },
];

/** Quick picks under the hero headline: the pages students look for most. */
const QUICK_PICKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'CBSE Class 10', href: ROUTES.boardPrep('cbse-class-10') },
  { label: 'CBSE Class 12', href: ROUTES.boardPrep('cbse-class-12') },
  { label: 'UP Board Class 12', href: ROUTES.boardPrep('up-board-class-12') },
  { label: 'JEE Advanced', href: ROUTES.examPattern('jee-advanced') },
  { label: 'CLAT 2027', href: ROUTES.examPattern('clat') },
  { label: 'NDA', href: ROUTES.examPattern('nda') },
];

/** Compact links to the standing resources, shown near the end of the page. */
const RESOURCES: ReadonlyArray<{
  Icon: IconType;
  title: string;
  note: string;
  href: string;
  live: boolean;
}> = [
  {
    Icon: TimerIcon,
    title: 'Mock tests',
    note: 'Real papers, timed and marked',
    href: ROUTES.mockTests(),
    live: LIVE.practice,
  },
  {
    Icon: FileTextIcon,
    title: 'Previous year papers',
    note: 'Official papers, year by year',
    href: ROUTES.papers(),
    live: true,
  },
  {
    Icon: CalendarIcon,
    title: 'NTA exam calendar',
    note: 'JEE, NEET, CUET and more',
    href: ROUTES.ntaCalendar(),
    live: true,
  },
  {
    Icon: CalendarIcon,
    title: 'SSC exam calendar',
    note: 'CGL, CHSL, MTS and GD',
    href: ROUTES.sscCalendar(),
    live: true,
  },
];

/**
 * One fact to put on a board card: the unit with the biggest share of its
 * paper, e.g. "Calculus · 35 of 80 in Mathematics". Null for ICSE, where the
 * board publishes no chapter marks.
 */
function topUnit(guide: BoardGuide): string | null {
  let best: { text: string; share: number } | null = null;
  for (const subject of guide.subjects) {
    const outOf = paperOutOf(guide, subject);
    if (!outOf) continue;
    for (const unit of subject.units) {
      if (unit.marks === null) continue;
      const share = unit.marks / outOf;
      if (!best || share > best.share) {
        best = { text: `${unit.unit} · ${unit.marks} of ${outOf} in ${subject.name}`, share };
      }
    }
  }
  return best?.text ?? null;
}

function SectionHead({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="max-w-[62ch]">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-[clamp(26px,3.6vw,36px)] leading-tight">{title}</h2>
        <p className="mt-3 text-[16.5px] text-ink-soft">{lede}</p>
      </div>
      {action ? (
        <Link href={action.href} className="btn btn-ghost">
          {action.label}
          <ArrowRightIcon width={16} height={16} />
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  // A listing may degrade to empty: the page is still useful and a backend
  // blip should not take the homepage down. The sitemap deliberately does NOT
  // do this — see src/app/sitemap.ts.
  //
  // Only exams with WRITTEN guides are featured, so the first thing a visitor
  // clicks is a finished page.
  let exams: ExamListItemDto[] = [];
  try {
    const guided = examsWithContent();
    const all = await listExams<ExamListItemDto>('perPage=100');
    exams = guided
      .map((slug) => all.find((exam) => exam.slug === slug))
      .filter((exam): exam is ExamListItemDto => exam !== undefined);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[home] exam list unavailable: ${error.message}`);
  }

  // The newest digitised paper of each exam, for the mock-test band. Empty
  // when nothing is digitised or the API is down; the band then hides.
  const practice = LIVE.practice ? await listPractice<PracticeExamDto>() : [];
  const test = practice
    .map((entry) => ({ entry, latest: entry.mockTests[0] }))
    .find((t) => t.latest !== undefined);

  const guides = BOARD_PREP.order.map((slug) => BOARD_PREP.guides[slug]);
  const latest = LIVE.blog ? ARTICLES.slice(0, 3) : [];
  const resources = RESOURCES.filter((item) => item.live);

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="hero-bg">
        <Wrap className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-12 pb-24 pt-12 sm:pb-32 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="max-w-[640px]">
            <p className="chip glass text-[13.5px] font-semibold text-ink">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-coral" />
              Board exams {BOARD_PREP.exam} · Entrance exams · Free
            </p>

            <h1 className="mt-6 text-[clamp(36px,6.4vw,64px)] leading-[1.04]">
              Know exactly what to study for your <span className="hl">next exam</span>.
            </h1>

            <p className="mt-6 max-w-[56ch] text-[17.5px] leading-relaxed text-ink-soft">
              Important chapters for CBSE, UP Board, ICSE and ISC, exam patterns for JEE, NEET, CLAT
              and NDA, previous year papers and free mock tests &mdash; compiled from official
              sources.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={ROUTES.boardPrepHub()} className="btn btn-primary">
                Board exam {BOARD_PREP.exam} guides
                <ArrowRightIcon width={16} height={16} />
              </Link>
              {test?.latest ? (
                <Link href={test.latest.path} className="btn btn-coral">
                  Take a free mock test
                </Link>
              ) : (
                <Link href={ROUTES.exams()} className="btn btn-ghost">
                  Explore entrance exams
                </Link>
              )}
            </div>

            <div className="mt-8">
              <p className="text-[13px] font-semibold text-ink-mute">Popular right now</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {QUICK_PICKS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="chip glass font-semibold text-ink-soft">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <HeroPhotos />
        </Wrap>
      </section>

      <Wrap>
        {/* Pulled up over the hero's bottom edge, so the two bands read as one. */}
        <ul className="card relative z-10 -mt-12 grid divide-y divide-rule sm:-mt-16 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {PROMISES.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-4 p-5 sm:p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--color-brand)_12%,transparent)] text-brand">
                <Icon width={21} height={21} />
              </span>
              <span>
                <span className="block text-[16px] font-bold text-ink">{title}</span>
                <span className="mt-1 block text-[14.5px] text-ink-soft">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* ── Board exams ─────────────────────────────────────────────── */}
        <section className="pt-20">
          <SectionHead
            eyebrow={`Board exams ${BOARD_PREP.exam}`}
            title="Important chapters, board by board"
            lede="Which units carry the most marks, how to write answers, and the board’s own past papers — for CBSE, UP Board, ICSE and ISC."
            action={{ label: 'All board guides', href: ROUTES.boardPrepHub() }}
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => {
              const fact = topUnit(guide);
              return (
                <li key={guide.slug}>
                  <Link
                    href={ROUTES.boardPrep(guide.slug)}
                    className="card group flex h-full flex-col p-6"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-hl px-3 py-1 text-[13px] font-bold text-[#16133a]">
                        {guide.board}
                      </span>
                      <span className="grid h-9 w-9 place-items-center rounded-full border border-rule">
                        <ArrowRightIcon
                          width={15}
                          height={15}
                          className="card-arrow text-ink-mute"
                        />
                      </span>
                    </span>
                    <h3 className="mt-4 text-[20px] font-bold text-ink">{guide.label}</h3>
                    <span className="mt-2 text-[14.5px] text-ink-soft">
                      {fact ? (
                        <>
                          <span className="font-semibold text-ink">Biggest unit:</span> {fact}
                        </>
                      ) : (
                        'No chapter marks are published, so the guide shows how the paper is set.'
                      )}
                    </span>
                    <span className="mt-auto pt-5 text-[14.5px] font-semibold text-brand">
                      See important chapters
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Entrance exams ──────────────────────────────────────────── */}
        {exams.length > 0 ? (
          <section className="pt-20">
            <SectionHead
              eyebrow="Entrance exams"
              title="Exam pattern and syllabus, from the official notice"
              lede="Marks, timing, negative marking and the full syllabus for the exams students ask about most."
              action={{ label: 'All exams', href: ROUTES.exams() }}
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {exams.map((exam) => (
                <li key={exam.id} className="card card-link flex h-full flex-col p-5">
                  <span className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--color-brand)_12%,transparent)] text-brand">
                      <TargetIcon width={19} height={19} />
                    </span>
                    <h3 className="text-[17px] font-bold leading-snug text-ink">
                      {examDisplayName(exam.shortName)}
                    </h3>
                  </span>
                  <ul className="mt-4 grid gap-1 border-t border-rule pt-3 text-[15px]">
                    {sectionsFor(exam.slug)
                      .filter(isEditorialSection)
                      .map((section) => (
                        <li key={section}>
                          <Link
                            href={EXAM_SECTIONS[section].path(exam.slug)}
                            className="flex items-center justify-between rounded-[8px] py-1.5 font-medium text-ink no-underline hover:text-brand"
                          >
                            {EXAM_SECTIONS[section].label}
                            <ArrowRightIcon width={14} height={14} className="text-ink-mute" />
                          </Link>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Mock test ───────────────────────────────────────────────── */}
        {test?.latest ? (
          <section className="night band-dark mt-20 overflow-hidden rounded-[28px] px-6 py-10 sm:px-10 sm:py-12">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="max-w-[58ch]">
                <p className="eyebrow">Test yourself</p>
                <h2 className="mt-2 text-[clamp(24px,3.4vw,34px)] leading-tight">
                  Take the real {examDisplayName(test.entry.exam.shortName)}{' '}
                  {test.latest.paper.year} paper as a timed mock test
                </h2>
                <p className="mt-3 text-[16px] text-ink-soft">
                  {test.latest.questionCount} questions
                  {test.latest.paper.shift ? ` from ${test.latest.paper.shift}` : ''}, marked the
                  way the exam is, with a worked solution for every question. Free, no sign-up.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={test.latest.path} className="btn btn-hl">
                  Start the test
                  <ArrowRightIcon width={16} height={16} />
                </Link>
                <Link
                  href={test.entry.practicePath}
                  className="btn glass text-ink hover:bg-white/15"
                >
                  Practise by chapter
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Latest articles ─────────────────────────────────────────── */}
        {latest.length > 0 ? (
          <section className="pt-20">
            <SectionHead
              eyebrow="Latest articles"
              title="Study plans and strategy"
              lede="Short, practical articles built on the official syllabus and paper pattern."
              action={{ label: 'All articles', href: ROUTES.blog() }}
            />
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={articlePath(article)}
                    className="card group block h-full overflow-hidden"
                  >
                    <Image
                      src={articleImageUrl(article, 640)}
                      alt={article.image.alt}
                      width={640}
                      height={336}
                      className="aspect-[40/21] w-full object-cover"
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    />
                    <div className="p-5">
                      <h3 className="text-[17px] font-bold leading-snug text-ink group-hover:text-brand">
                        {article.h1}
                      </h3>
                      <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-ink-mute">
                        <BookOpenIcon width={15} height={15} />
                        {readingMinutes(article)} min read
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Resources ───────────────────────────────────────────────── */}
        <section className="pt-20">
          <SectionHead
            eyebrow="Student resources"
            title="Practise, plan and look things up"
            lede="Free tools and reference pages, updated from official sources."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resources.map(({ Icon, title, note, href }) => (
              <li key={href}>
                <Link href={href} className="card flex h-full items-center gap-4 p-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-hl-soft text-ink">
                    <Icon width={20} height={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-ink">{title}</h3>
                    <p className="text-[14px] text-ink-soft">{note}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Wrap>
    </>
  );
}
