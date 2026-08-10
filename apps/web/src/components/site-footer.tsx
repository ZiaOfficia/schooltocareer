import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import { Wrap } from '@stc/ui';

/**
 * ONLY routes that resolve.
 *
 * This previously linked to /news, /about, /contact, /privacy-policy,
 * /terms-and-conditions and /disclaimer — none of which have been built. Every
 * one was a 404 on every page of the site, which is both a bad visitor
 * experience and a steady supply of crawl errors from the most-linked element
 * on the domain.
 *
 * ROUTES defines the whole URL map including pages that do not exist yet, so
 * "it's in ROUTES" is not evidence the page is there. Add a link here on the
 * same commit that adds the page.
 *
 * STILL OWED, and needed before AdSense review: privacy policy, terms,
 * disclaimer, contact. Tracked in docs/PROJECT-STATUS.md.
 */
const GROUPS = [
  {
    title: 'Exams',
    links: [
      { label: 'All exams', href: ROUTES.exams() },
      { label: 'Previous year papers', href: ROUTES.papers() },
      { label: 'Results', href: ROUTES.results() },
    ],
  },
  {
    title: 'Boards',
    links: [
      { label: 'All boards', href: ROUTES.boards() },
      { label: 'Articles', href: ROUTES.blog() },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t-[3px] border-rule-hard bg-surface">
      <Wrap className="py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="font-data text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-1.5 text-[13.5px]">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-ink-soft no-underline hover:text-link hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/*
          A real disclaimer, not boilerplate. Exam pages carry dates that change
          without notice, and a student who misses a deadline because we were
          stale has a legitimate grievance. Saying plainly that the agency is
          authoritative is both honest and the correct legal posture.
        */}
        <p className="mt-8 max-w-[80ch] border-l-2 border-rule-hard pl-4 text-[12.5px] text-ink-soft">
          {SITE.NAME} is an independent education portal. Exam dates, eligibility and results are
          compiled from official notifications and can change without notice. Always confirm against
          the conducting body&rsquo;s official website before acting on a deadline.
        </p>

        <p className="mt-6 font-data text-[11px] text-ink-mute">
          © {new Date().getFullYear()} {SITE.NAME} · {SITE.ORIGIN.replace('https://', '')}
        </p>
      </Wrap>
    </footer>
  );
}
