import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';

import { Bullets, External, StaticPage } from '@/components/static-page';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Privacy policy.
 *
 * Describes what the site ACTUALLY does, checked against the code on the date
 * below: no accounts, no analytics script, mock-test progress kept in the
 * browser's localStorage (components/mock-test.tsx), standard server logs at
 * the hosts, and Google AdSense (components/adsense.tsx).
 *
 * The AdSense paragraphs are what Google's publisher policies require every
 * AdSense site to disclose: third-party vendors including Google use cookies,
 * Google's advertising cookies serve ads based on prior visits, and users can
 * opt out of personalised advertising.
 *
 * Adding analytics, a login, a newsletter or a contact form changes what is
 * true here. Update this page on the same commit.
 */
const UPDATED = '2026-11-01';

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.privacy(),
    title: 'Privacy Policy',
    description:
      'What data SchoolToCareer collects, how cookies and Google AdSense advertising work on this site, and how to opt out of personalised ads.',
    modifiedTime: UPDATED,
  });
}

export default function PrivacyPolicyPage() {
  const site = SITE.ORIGIN.replace('https://', '');

  return (
    <StaticPage
      name="Privacy policy"
      path={ROUTES.privacy()}
      title="Privacy policy"
      lede={`How ${SITE.NAME} (${site}) handles information about the people who use it. In short: you do not need an account, we do not ask for your name, and advertising on the site uses cookies that you can control.`}
      updated={UPDATED}
      sections={[
        {
          title: 'Who we are',
          body: (
            <p>
              {SITE.NAME} is an independent education information website for students in India,
              available at {site}. In this policy, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean{' '}
              {SITE.NAME}. You can reach us about anything in this policy at{' '}
              <span className="font-semibold text-ink">{SITE.CONTACT_EMAIL}</span>.
            </p>
          ),
        },
        {
          title: 'Information we collect',
          body: (
            <>
              <p>
                You can use the whole site without creating an account or telling us who you are. We
                do not run a login, a newsletter or a comment system.
              </p>
              <Bullets
                items={[
                  <>
                    <strong className="text-ink">Server logs.</strong> Like almost every website,
                    the servers that host {SITE.NAME} automatically record technical details of each
                    request: IP address, browser type, the page requested, the referring page and
                    the time. These logs are kept by our hosting providers for security and
                    troubleshooting and are deleted on their standard schedule.
                  </>,
                  <>
                    <strong className="text-ink">Mock test progress.</strong> When you take a mock
                    test, your answers and timer are saved in your own browser&rsquo;s local storage
                    so you can resume after a refresh. This stays on your device; it is not sent to
                    us. Clearing your browser data removes it.
                  </>,
                  <>
                    <strong className="text-ink">Emails you send us.</strong> If you write to us, we
                    receive your email address and whatever your message contains, and use them only
                    to reply.
                  </>,
                ]}
              />
            </>
          ),
        },
        {
          title: 'Cookies',
          body: (
            <>
              <p>
                Cookies are small text files a website stores in your browser. {SITE.NAME} itself
                does not set cookies to identify you. The cookies you may see on this site are set
                by our advertising partner, Google, as described below.
              </p>
              <p>
                You can block or delete cookies in your browser settings. The site will still work,
                though the ads you see may be less relevant.
              </p>
            </>
          ),
        },
        {
          title: 'Advertising and Google AdSense',
          body: (
            <>
              <p>{SITE.NAME} is free because it shows advertisements served by Google AdSense.</p>
              <Bullets
                items={[
                  'Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.',
                  "Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet.",
                  <>
                    You may opt out of personalised advertising by visiting Google&rsquo;s{' '}
                    <External href="https://adssettings.google.com">Ads Settings</External>.
                    Alternatively, you can opt out of some third-party vendors&rsquo; use of cookies
                    for personalised advertising at{' '}
                    <External href="https://www.aboutads.info/choices/">www.aboutads.info</External>
                    .
                  </>,
                  <>
                    Learn how Google uses information from sites that use its services at{' '}
                    <External href="https://policies.google.com/technologies/partner-sites">
                      policies.google.com/technologies/partner-sites
                    </External>
                    .
                  </>,
                ]}
              />
              <p>
                Advertisers do not receive your name or contact details from us, because we do not
                have them.
              </p>
            </>
          ),
        },
        {
          title: 'Visitors from the EEA, the UK and Switzerland',
          body: (
            <p>
              If you visit from the European Economic Area, the United Kingdom or Switzerland, a
              consent message from Google asks for your choice before personalised ads or
              advertising cookies are used. You can change that choice at any time from the link the
              message provides. If you do not consent, you may still see non-personalised ads.
            </p>
          ),
        },
        {
          title: 'Links to other websites',
          body: (
            <p>
              Exam pages link to official websites such as those of the National Testing Agency, the
              Staff Selection Commission and the Union Public Service Commission. Those sites have
              their own privacy policies, which we do not control.
            </p>
          ),
        },
        {
          title: 'Children',
          body: (
            <p>
              Many of our readers are school students. We do not knowingly collect personal
              information from anyone, and the site needs none to use it. If you are under 18,
              please ask a parent or guardian before contacting us by email. If you believe a child
              has sent us personal information, write to us and we will delete it.
            </p>
          ),
        },
        {
          title: 'Your choices and rights',
          body: (
            <>
              <p>
                You can ask us what information we hold about you, ask us to correct it, or ask us
                to delete it, by writing to{' '}
                <span className="font-semibold text-ink">{SITE.CONTACT_EMAIL}</span>. In practice,
                the only personal information we hold is the content of emails people send us.
              </p>
              <p>
                We handle personal data in line with India&rsquo;s Digital Personal Data Protection
                Act, 2023 and, for visitors from Europe and the UK, the GDPR.
              </p>
            </>
          ),
        },
        {
          title: 'Changes to this policy',
          body: (
            <p>
              If we change how the site handles information, for example by adding analytics or an
              account system, we will update this page and the date at the top before the change
              goes live. Questions? See the{' '}
              <Link href={ROUTES.contact()} className="underline">
                contact page
              </Link>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
