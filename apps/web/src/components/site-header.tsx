import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import { Wrap } from '@stc/ui';

const NAV = [
  { label: 'Exams', href: ROUTES.exams() },
  { label: 'Boards', href: ROUTES.boards() },
  { label: 'Results', href: ROUTES.results() },
  { label: 'Papers', href: ROUTES.papers() },
  { label: 'Articles', href: ROUTES.blog() },
] as const;

/**
 * Server Component — no client JS ships for the header.
 *
 * The search control is a plain <form> with a GET action, so it works before
 * hydration and without JavaScript at all. The `/` shortcut and the overlay are
 * a progressive enhancement layered on top later; they are not what makes
 * search reachable.
 */
export function SiteHeader() {
  return (
    <header className="border-b-2 border-rule-hard bg-surface">
      <Wrap className="flex flex-wrap items-center gap-x-6 gap-y-3 py-2">
        <Link href={ROUTES.home()} className="font-display text-[17px] font-bold tracking-tight text-ink no-underline">
          SchoolTo<span className="font-normal text-ink-mute">Career</span>
        </Link>

        <nav aria-label="Primary" className="hidden gap-4 text-[13px] text-ink-soft sm:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-inherit no-underline hover:text-link hover:underline">
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={ROUTES.search()} method="get" role="search" className="ml-auto flex min-w-0 flex-1 sm:max-w-[320px]">
          <label htmlFor="site-search" className="sr-only">
            Search {SITE.NAME}
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search exams, papers, results…"
            className="min-w-0 flex-1 border-2 border-rule-hard bg-paper px-3 py-1 text-[13px] text-ink outline-none placeholder:text-ink-mute"
          />
          <button
            type="submit"
            className="border-2 border-l-0 border-rule-hard bg-ink px-3 py-1 text-[13px] font-semibold text-paper"
          >
            Search
          </button>
        </form>
      </Wrap>
    </header>
  );
}
