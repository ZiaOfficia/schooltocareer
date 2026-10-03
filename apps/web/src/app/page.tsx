import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamListItemDto } from '@stc/types';
import { EntityBadge, EntityMark, Section, Wrap, type EntityKind } from '@stc/ui';

import {
  ArrowRightIcon,
  ClockIcon,
  SearchIcon,
  ShieldCheckIcon,
  UnlockIcon,
} from '@/components/icons';
import { Words } from '@/components/page-hero';
import { Scene } from '@/components/scene';
import { ApiError, listExams } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.home(),
    title: `${SITE.NAME} — ${SITE.TAGLINE}`,
    description:
      'Exam dates, eligibility, syllabus, previous year question papers and results for India’s major exams and school boards. Free, and updated from official notifications.',
  });
}

/**
 * The five sections, as tiles. ONLY routes that resolve — the same rule the
 * footer follows, for the same reason.
 */
const BROWSE: ReadonlyArray<{
  kind: EntityKind;
  title: string;
  note: string;
  href: string;
}> = [
  {
    kind: 'exam',
    title: 'Exams',
    note: 'Dates and everything linked from them',
    href: ROUTES.exams(),
  },
  {
    kind: 'board',
    title: 'Boards',
    note: 'National and state school boards',
    href: ROUTES.boards(),
  },
  {
    kind: 'result',
    title: 'Results',
    note: 'Declared, or plainly marked awaited',
    href: ROUTES.results(),
  },
  {
    kind: 'paper',
    title: 'Papers',
    note: 'Previous year question papers',
    href: ROUTES.papers(),
  },
  {
    kind: 'article',
    title: 'Articles',
    note: 'Strategy and subject guides',
    href: ROUTES.blog(),
  },
];

/** What the hero already promises, said once each. No invented numbers. */
const PROMISES = [
  {
    Icon: ShieldCheckIcon,
    title: 'From official notifications',
    body: 'Dates are compiled from what the conducting body published, and labelled when they are only tentative.',
  },
  {
    Icon: ClockIcon,
    title: 'Dated, so you can judge it',
    body: 'Every page says when it was last updated, so you can see how current it is before you rely on it.',
  },
  {
    Icon: UnlockIcon,
    title: 'Free, without an account',
    body: 'Nothing here asks you to register, and nothing is held back behind a sign-up.',
  },
] as const;

export default async function HomePage() {
  // A listing may degrade to empty: the page is still useful, search still
  // works, and a backend blip should not take the homepage down. The sitemap
  // deliberately does NOT do this — see src/app/sitemap.ts.
  let exams: ExamListItemDto[] = [];
  try {
    exams = await listExams<ExamListItemDto>('perPage=8&sort=popularityScore&dir=desc');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[home] exam list unavailable: ${error.message}`);
  }

  return (
    <>
      <section className="night hero-bg">
        <div data-parallax className="absolute inset-0 -z-[1]">
          <Scene variant="orb" className="opacity-45 lg:opacity-100" />
        </div>

        <Wrap className="pb-20 pt-16 sm:pb-28 sm:pt-24">
          <div className="max-w-[640px]">
            <p data-reveal className="chip glass font-data text-[11px] uppercase tracking-[0.14em]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
              {SITE.COUNTRY === 'IN' ? 'India' : SITE.COUNTRY} · Exams · Boards · Results
            </p>

            <h1 data-words className="mt-6 text-[clamp(36px,7vw,68px)] leading-[1.02]">
              <Words text="Every exam date, paper and result." />{' '}
              <Words text="In one place." className="gradient-text" />
            </h1>

            <p data-reveal className="mt-6 max-w-[54ch] text-[17.5px] text-ink-soft">
              Compiled from official notifications, dated so you can see how current it is, and free
              without an account.
            </p>

            <form
              data-reveal
              action={ROUTES.search()}
              method="get"
              role="search"
              className="glass mt-8 flex max-w-[580px] items-center rounded-full p-1.5 pl-5 transition-colors focus-within:border-white/40"
            >
              <SearchIcon className="shrink-0 text-ink-mute" />
              <label htmlFor="home-search" className="sr-only">
                Search
              </label>
              <input
                id="home-search"
                name="q"
                type="search"
                placeholder="Try “JEE Main 2026” or “CBSE Class 10 Maths papers”"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink-mute"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>

            <ul data-reveal className="mt-6 flex flex-wrap gap-2">
              {BROWSE.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="chip glass">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Wrap>
      </section>

      <Wrap>
        {/* Pulled up over the hero's bottom edge, so the two bands read as one
            composition rather than a banner with a page under it. */}
        <ul className="relative z-10 -mt-10 grid gap-4 sm:-mt-14 md:grid-cols-3">
          {PROMISES.map(({ Icon, title, body }) => (
            <li key={title} data-reveal className="card p-5">
              <span
                className="grid h-10 w-10 place-items-center rounded-[12px] text-white"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                }}
              >
                <Icon width={20} height={20} />
              </span>
              <h2 className="mt-4 font-sans text-[16px] font-semibold tracking-normal">{title}</h2>
              <p className="mt-1.5 text-[14px] text-ink-soft">{body}</p>
            </li>
          ))}
        </ul>

        <Section title="Browse by section" lede="Five ways in. Each one opens a full list." major>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {BROWSE.map((item) => (
              <li key={item.href} data-reveal>
                <Link href={item.href} data-tilt className="card flex h-full flex-col gap-3 p-5">
                  <EntityMark kind={item.kind} size={44} />
                  <span className="mt-1 flex items-center justify-between gap-2 font-display text-[18px] font-semibold text-ink">
                    {item.title}
                    <ArrowRightIcon width={16} height={16} className="card-arrow text-ink-mute" />
                  </span>
                  <span className="text-[13.5px] text-ink-soft">{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Popular exams"
          lede="The hubs people reach for most, each with its dates and what we hold for it."
          major
          actions={
            <Link href={ROUTES.exams()} className="btn btn-ghost">
              All exams
              <ArrowRightIcon width={16} height={16} />
            </Link>
          }
        >
          {exams.length === 0 ? (
            <p className="card border-dashed p-5 text-[14px] text-ink-soft">
              No exams loaded. Start the API with <code className="font-data">pnpm dev</code> — this
              list is served from <code className="font-data">/api/v1/exams</code>.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {exams.map((exam) => (
                <li key={exam.id} data-reveal>
                  <Link href={exam.path} data-tilt className="card flex h-full flex-col gap-3 p-5">
                    <EntityBadge kind="exam" className="self-start" />
                    <span className="font-display text-[17px] font-semibold leading-snug text-ink">
                      {exam.name}
                    </span>
                    <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-[13px] text-ink-mute">
                      {exam.category ? exam.category.name : <span />}
                      <ArrowRightIcon width={16} height={16} className="card-arrow" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Wrap>
    </>
  );
}
