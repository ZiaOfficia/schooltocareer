import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import { Wrap } from '@stc/ui';

import { SearchIcon } from '@/components/icons';
import { Logo } from '@/components/logo';
import { MobileMenu, type MenuGroup } from '@/components/mobile-menu';
import { LIVE } from '@/lib/site-sections';

type NavItem = { label: string; href: string };

/**
 * Only sections with something in them — see lib/site-sections.ts.
 *
 * Five top-level items, in the order students look for them: their exam,
 * their board exam, then things to practise with and read. The two calendars
 * share one "Calendars" menu, so the bar fits a 1024px laptop without
 * wrapping, which seven loose links did not.
 */
const NAV: readonly NavItem[] = [
  { label: 'Exams', href: ROUTES.exams() },
  { label: 'Board exams', href: ROUTES.boardPrepHub() },
  ...(LIVE.boards ? [{ label: 'Boards', href: ROUTES.boards() }] : []),
  ...(LIVE.practice ? [{ label: 'Mock tests', href: ROUTES.mockTests() }] : []),
  { label: 'Papers', href: ROUTES.papers() },
  ...(LIVE.results ? [{ label: 'Results', href: ROUTES.results() }] : []),
  ...(LIVE.blog ? [{ label: 'Articles', href: ROUTES.blog() }] : []),
];

const CALENDARS: readonly NavItem[] = [
  { label: 'NTA exam calendar', href: ROUTES.ntaCalendar() },
  { label: 'SSC exam calendar', href: ROUTES.sscCalendar() },
];

/** The phone menu, grouped so a long list of links is easy to scan. */
const MENU_GROUPS: readonly MenuGroup[] = [
  {
    title: 'Prepare',
    links: [
      { label: 'Board exams 2027', href: ROUTES.boardPrepHub(), note: 'CBSE, UP Board, ICSE, ISC' },
      { label: 'Entrance exams', href: ROUTES.exams(), note: 'JEE, NEET, CUET, CLAT, NDA' },
      ...(LIVE.blog
        ? [{ label: 'Articles', href: ROUTES.blog(), note: 'Study plans and strategy' }]
        : []),
    ],
  },
  {
    title: 'Practise',
    links: [
      ...(LIVE.practice ? [{ label: 'Mock tests', href: ROUTES.mockTests() }] : []),
      { label: 'Previous year papers', href: ROUTES.papers() },
    ],
  },
  {
    title: 'Calendars',
    links: CALENDARS,
  },
];

/** The one thing in the header a student can DO rather than read. */
const CTA: NavItem | null = LIVE.practice
  ? { label: 'Free mock test', href: ROUTES.mockTests() }
  : null;

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Server Component — the header ships no client JS of its own.
 *
 * The desktop "Calendars" menu opens on hover and on keyboard focus (CSS
 * only). The phone menu is a small client component (components/mobile-menu)
 * that slides in; everything else in the header is server-rendered, so it works before
 * hydration and without JavaScript at all.
 */
export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40">
      <Wrap className="flex h-16 items-center gap-x-4">
        <Link
          href={ROUTES.home()}
          className="shrink-0 text-logo no-underline"
          aria-label={SITE.NAME}
        >
          <Logo className="h-[34px] w-auto" />
        </Link>

        <nav
          aria-label="Primary"
          className="ml-4 hidden items-center gap-1 text-[15px] font-semibold lg:flex"
        >
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
          <div className="group relative">
            <button type="button" className="nav-link cursor-pointer" aria-haspopup="true">
              Calendars
              <ChevronDown />
            </button>
            <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul className="card w-[240px] p-2">
                {CALENDARS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-[10px] px-3 py-2.5 text-[14.5px] font-medium text-ink no-underline hover:bg-row-hover"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {LIVE.search ? (
            <form
              action={ROUTES.search()}
              method="get"
              role="search"
              className="hidden min-w-0 items-center rounded-[12px] border border-rule bg-paper pl-3.5 transition-colors focus-within:border-brand xl:flex xl:w-[240px]"
            >
              <SearchIcon width={16} height={16} className="shrink-0 text-ink-mute" />
              <label htmlFor="site-search" className="sr-only">
                Search {SITE.NAME}
              </label>
              <input
                id="site-search"
                name="q"
                type="search"
                placeholder="Search exams, papers…"
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[14.5px] text-ink outline-none placeholder:text-ink-mute"
              />
            </form>
          ) : null}

          {CTA ? (
            <Link
              href={CTA.href}
              className="btn btn-primary hidden !min-h-[40px] !py-2 text-[14.5px] sm:inline-flex"
            >
              {CTA.label}
            </Link>
          ) : null}

          {/* Below `lg` the nav lives in a slide-in panel. */}
          <MobileMenu groups={MENU_GROUPS} cta={CTA} />
        </div>
      </Wrap>
    </header>
  );
}
