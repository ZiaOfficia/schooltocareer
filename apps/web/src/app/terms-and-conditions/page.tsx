import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';

import { Bullets, StaticPage } from '@/components/static-page';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Terms of use. Plain-language, short, and consistent with the disclaimer and
 * privacy policy — the three are read together.
 */
const UPDATED = '2026-11-01';

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.terms(),
    title: 'Terms and Conditions',
    description:
      'The terms for using SchoolToCareer: how you may use its exam information, papers and mock tests, and the limits of what the site promises.',
    modifiedTime: UPDATED,
  });
}

export default function TermsPage() {
  const site = SITE.ORIGIN.replace('https://', '');

  return (
    <StaticPage
      name="Terms and conditions"
      path={ROUTES.terms()}
      title="Terms and conditions"
      lede={`The rules for using ${SITE.NAME} (${site}). By using the site you agree to them. They are written to be read, so they are short.`}
      updated={UPDATED}
      sections={[
        {
          title: 'Using the site',
          body: (
            <>
              <p>
                {SITE.NAME} is free to use for your own study and exam preparation. You do not need
                an account.
              </p>
              <Bullets
                items={[
                  'You may read, print and share links to any page for personal, non-commercial use.',
                  'You may not copy our written content, explanations, tables or mock tests in bulk, republish them on another website or app, or sell them.',
                  'You may not scrape the site with automated tools in a way that harms its performance, or try to break, overload or gain unauthorised access to it.',
                  'You may not use the site for anything unlawful.',
                ]}
              />
            </>
          ),
        },
        {
          title: 'Accuracy of information',
          body: (
            <p>
              We take exam information from official notices and work to keep it correct and
              current, but conducting bodies can change dates, eligibility, patterns and syllabi at
              any time. The official notice and website of the conducting body always take priority
              over anything on {SITE.NAME}. Read the full{' '}
              <Link href={ROUTES.disclaimer()} className="underline">
                disclaimer
              </Link>
              .
            </p>
          ),
        },
        {
          title: 'Previous-year papers and mock tests',
          body: (
            <p>
              Question papers belong to the bodies that set them and are reproduced for students to
              practise with. Our solutions, explanations and mock-test scores are a study aid only.
              A mock-test score does not predict or guarantee any result in the real exam.
            </p>
          ),
        },
        {
          title: 'Our content',
          body: (
            <p>
              The site&rsquo;s design, text, explanations and code belong to {SITE.NAME} unless
              stated otherwise. Names and logos of exams and conducting bodies belong to their
              owners and are used only to identify the exam being described.
            </p>
          ),
        },
        {
          title: 'Advertising and other websites',
          body: (
            <p>
              The site shows advertisements from Google AdSense and links to official and other
              websites. We do not control and are not responsible for advertisers&rsquo; products or
              the content of other websites. How advertising uses cookies is explained in our{' '}
              <Link href={ROUTES.privacy()} className="underline">
                privacy policy
              </Link>
              .
            </p>
          ),
        },
        {
          title: 'Limitation of liability',
          body: (
            <p>
              The site is provided &ldquo;as is&rdquo;, without warranties of any kind. To the
              extent the law allows, {SITE.NAME} is not liable for any loss arising from use of the
              site or reliance on its information, including a missed deadline or a rejected
              application.
            </p>
          ),
        },
        {
          title: 'Changes and governing law',
          body: (
            <>
              <p>
                We may update these terms. The date at the top of the page shows when they last
                changed, and continuing to use the site means you accept the current version.
              </p>
              <p>
                These terms are governed by the laws of India. Questions about them can be sent
                through the{' '}
                <Link href={ROUTES.contact()} className="underline">
                  contact page
                </Link>
                .
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
