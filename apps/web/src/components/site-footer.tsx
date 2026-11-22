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
 * The five standing pages (about, contact, privacy policy, terms, disclaimer)
 * were added together with their links, and are in the sitemap.
 */
const GROUPS = [
  {
    title: 'Exams',
    links: [
      { label: 'All exams', href: ROUTES.exams() },
      { label: 'NTA exam calendar', href: ROUTES.ntaCalendar() },
      { label: 'SSC exam calendar', href: ROUTES.sscCalendar() },
      ...(LIVE.results ? [{ label: 'Results', href: ROUTES.results() }] : []),
    ],
  },
  {
    title: 'Board exams 2027',
    links: [
      { label: 'All board exam guides', href: ROUTES.boardPrepHub() },
      { label: 'CBSE Class 10', href: ROUTES.boardPrep('cbse-class-10') },
      { label: 'CBSE Class 12', href: ROUTES.boardPrep('cbse-class-12') },
      { label: 'UP Board Class 10', href: ROUTES.boardPrep('up-board-class-10') },
      { label: 'UP Board Class 12', href: ROUTES.boardPrep('up-board-class-12') },
      { label: 'ICSE Class 10', href: ROUTES.boardPrep('icse-class-10') },
      { label: 'ISC Class 12', href: ROUTES.boardPrep('isc-class-12') },
      ...(LIVE.boards ? [{ label: 'All boards', href: ROUTES.boards() }] : []),
    ],
  },
  {
    title: 'Practise and read',
    links: [
      ...(LIVE.practice ? [{ label: 'Mock tests', href: ROUTES.mockTests() }] : []),
      { label: 'Previous year papers', href: ROUTES.papers() },
      ...(LIVE.blog ? [{ label: 'Articles', href: ROUTES.blog() }] : []),
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'About us', href: ROUTES.about() },
      { label: 'Contact', href: ROUTES.contact() },
      { label: 'Privacy policy', href: ROUTES.privacy() },
      { label: 'Terms and conditions', href: ROUTES.terms() },
      { label: 'Disclaimer', href: ROUTES.disclaimer() },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="night hero-bg mt-20">
      <Wrap className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <Link href={ROUTES.home()} className="inline-block text-logo no-underline">
              <Logo className="h-10 w-auto" />
            </Link>
            <p className="mt-3 max-w-[38ch] text-[14px] text-ink-soft">{SITE.TAGLINE}</p>
          </div>

          {GROUPS.filter((group) => group.links.length > 0).map((group) => (
            <div key={group.title}>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-mute">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-3 text-[14.5px]">
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
        <p className="glass mt-10 max-w-[86ch] rounded-[var(--radius-tile)] p-4 text-[14px] leading-relaxed text-ink-soft">
          {SITE.NAME} is an independent education portal. Exam dates, eligibility and results are
          compiled from official notifications and can change without notice. Always confirm against
          the conducting body&rsquo;s official website before acting on a deadline.
        </p>

        <p className="mt-8 border-t border-rule pt-6 text-[13px] text-ink-mute">
          © {new Date().getFullYear()} {SITE.NAME} · {SITE.ORIGIN.replace('https://', '')}
        </p>
      </Wrap>
    </footer>
  );
}
