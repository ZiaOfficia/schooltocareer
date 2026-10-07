import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import { Wrap } from '@stc/ui';

import { Logo } from '@/components/logo';
import { LIVE } from '@/lib/site-sections';

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
      { label: 'NTA exam calendar', href: ROUTES.ntaCalendar() },
      ...(LIVE.results ? [{ label: 'Results', href: ROUTES.results() }] : []),
    ],
  },
  {
    title: 'Boards',
    links: [
      { label: 'All boards', href: ROUTES.boards() },
      ...(LIVE.blog ? [{ label: 'Articles', href: ROUTES.blog() }] : []),
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="night hero-bg mt-16">
      <Wrap className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div data-reveal>
            <Link href={ROUTES.home()} className="inline-block text-logo no-underline">
              <Logo className="h-10 w-auto" />
            </Link>
            <p className="mt-3 max-w-[38ch] text-[14px] text-ink-soft">{SITE.TAGLINE}</p>
          </div>

          {GROUPS.map((group) => (
            <div key={group.title} data-reveal>
              <h2 className="font-data text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-ink-soft no-underline hover:text-ink hover:underline"
                    >
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
        <p
          data-reveal
          className="glass mt-10 max-w-[86ch] rounded-[var(--radius-tile)] p-4 text-[13px] leading-relaxed text-ink-soft"
        >
          {SITE.NAME} is an independent education portal. Exam dates, eligibility and results are
          compiled from official notifications and can change without notice. Always confirm against
          the conducting body&rsquo;s official website before acting on a deadline.
        </p>

        <p className="mt-8 border-t border-rule pt-6 font-data text-[11.5px] text-ink-mute">
          © {new Date().getFullYear()} {SITE.NAME} · {SITE.ORIGIN.replace('https://', '')}
        </p>
      </Wrap>
    </footer>
  );
}
