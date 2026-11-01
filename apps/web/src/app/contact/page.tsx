import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';

import { Bullets, StaticPage } from '@/components/static-page';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * How to reach the people who run the site.
 *
 * Email only, deliberately: a form needs a backend, spam handling and a
 * privacy notice of its own, and an address that works beats a form that
 * silently drops messages. The address is printed as text, not only as a
 * mailto link, because many phones have no mail app configured.
 */
const UPDATED = '2026-11-01';

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.contact(),
    title: 'Contact Us',
    description:
      'Email SchoolToCareer to report a wrong exam date, a broken link or a mistake, ask a question about the site, or raise a privacy request.',
    modifiedTime: UPDATED,
  });
}

export default function ContactPage() {
  return (
    <StaticPage
      name="Contact"
      path={ROUTES.contact()}
      title="Contact us"
      lede="The quickest way to reach us is by email. We read every message and reply to most within two working days."
      updated={UPDATED}
      sections={[
        {
          title: 'Email',
          body: (
            <>
              <p>
                <a
                  href={`mailto:${SITE.CONTACT_EMAIL}`}
                  className="text-[18px] font-semibold text-ink underline"
                >
                  {SITE.CONTACT_EMAIL}
                </a>
              </p>
              <p>
                Please write in English or Hindi. If your message is about a specific page, include
                its link, and for an exam date, the official notice you are comparing it with.
              </p>
            </>
          ),
        },
        {
          title: 'What to write to us about',
          body: (
            <Bullets
              items={[
                'A date, eligibility rule, syllabus topic or answer that looks wrong. These are checked against the official source and corrected first.',
                'A broken link, a page that will not load, or a mock test that misbehaves.',
                'An exam or board you would like us to cover.',
                <>
                  A privacy request: a question about the data described in our{' '}
                  <Link href={ROUTES.privacy()} className="underline">
                    privacy policy
                  </Link>
                  .
                </>,
                'Advertising, partnership or press enquiries.',
              ]}
            />
          ),
        },
        {
          title: 'What we cannot help with',
          body: (
            <>
              <p>
                We are an independent information site, not an exam authority. We cannot change your
                application, admit card, marks or result, extend a deadline, or pass messages to a
                conducting body.
              </p>
              <p>
                For those, contact the body that runs your exam through its official website or
                helpline. Each exam page on {SITE.NAME} links to the official site. See our{' '}
                <Link href={ROUTES.disclaimer()} className="underline">
                  disclaimer
                </Link>{' '}
                for more.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
