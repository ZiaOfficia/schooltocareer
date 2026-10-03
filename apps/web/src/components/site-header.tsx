import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import { Wrap } from '@stc/ui';

import { MenuIcon, SearchIcon } from '@/components/icons';

const NAV = [
  { label: 'Exams', href: ROUTES.exams() },
  { label: 'Boards', href: ROUTES.boards() },
  { label: 'Results', href: ROUTES.results() },
  { label: 'Papers', href: ROUTES.papers() },
  { label: 'Articles', href: ROUTES.blog() },
] as const;

/**
 * Server Component — the header ships no client JS of its own.
 *
 * The search control is a plain <form> with a GET action, and the mobile menu
 * is a <details>, so both work before hydration and without JavaScript at all.
 * The hide-on-scroll behaviour and the reading-progress bar are driven from
 * outside by <Motion> through the `data-header` / `data-progress` hooks; if
 * that never runs, this is simply a sticky header.
 */
export function SiteHeader() {
  return (
    <header data-header className="site-header sticky top-0 z-40">
      <Wrap className="flex items-center gap-x-6 py-3">
        <Link
          href={ROUTES.home()}
          className="flex items-center gap-2.5 font-display text-[17px] font-bold tracking-tight text-ink no-underline"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-[10px] text-[13px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed 55%, #06b6d4)',
            }}
          >
            S
          </span>
          <span>
            SchoolTo<span className="text-brand">Career</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden gap-6 text-[14px] font-medium md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <form
          action={ROUTES.search()}
          method="get"
          role="search"
          className="ml-auto hidden min-w-0 flex-1 items-center rounded-full border border-rule bg-paper pl-3.5 transition-colors focus-within:border-brand sm:flex sm:max-w-[300px]"
        >
          <SearchIcon width={16} height={16} className="shrink-0 text-ink-mute" />
          <label htmlFor="site-search" className="sr-only">
            Search {SITE.NAME}
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search exams, papers, results…"
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13.5px] text-ink outline-none placeholder:text-ink-mute"
          />
        </form>

        {/* Below `md` the nav lives in a disclosure. It was simply hidden on
            phones before, which left five sections reachable only from the
            footer. */}
        <details className="group relative ml-auto md:hidden sm:ml-0">
          <summary
            aria-label="Menu"
            className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-rule bg-surface text-ink [&::-webkit-details-marker]:hidden"
          >
            <MenuIcon />
          </summary>
          <div className="card absolute right-0 top-[calc(100%+10px)] w-[min(86vw,300px)] p-3">
            <form
              action={ROUTES.search()}
              method="get"
              role="search"
              className="mb-2 flex items-center rounded-full border border-rule bg-paper pl-3.5 sm:hidden"
            >
              <SearchIcon width={16} height={16} className="shrink-0 text-ink-mute" />
              <label htmlFor="menu-search" className="sr-only">
                Search {SITE.NAME}
              </label>
              <input
                id="menu-search"
                name="q"
                type="search"
                placeholder="Search…"
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[14px] text-ink outline-none placeholder:text-ink-mute"
              />
            </form>
            <nav aria-label="Primary" className="flex flex-col">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-ink no-underline hover:bg-row-hover"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </details>
      </Wrap>

      <div
        data-progress
        aria-hidden="true"
        className="scroll-progress absolute inset-x-0 bottom-0 h-[2px]"
      />
    </header>
  );
}
