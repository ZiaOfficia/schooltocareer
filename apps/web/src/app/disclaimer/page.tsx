import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';

import { Bullets, StaticPage } from '@/components/static-page';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * The long form of the footer disclaimer. PRINCIPLES 2: a wrong exam date
 * costs a student a year, so the site says plainly, in one findable place,
 * that the conducting body is the authority and we are not it.
 */
const UPDATED = '2026-11-01';

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.disclaimer(),
    title: 'Disclaimer',
    description:
      'SchoolToCareer is an independent site, not affiliated with NTA, SSC, UPSC, CBSE or any exam body. Always confirm dates on the official website.',
    modifiedTime: UPDATED,
  });
}

export default function DisclaimerPage() {
  return (
    <StaticPage
      name="Disclaimer"
      path={ROUTES.disclaimer()}
      title="Disclaimer"
      lede={`${SITE.NAME} is an independent information website. It is not an exam authority, and the official notice always comes first.`}
      updated={UPDATED}
      sections={[
        {
          title: 'Not an official website',
          body: (
            <p>
              {SITE.NAME} is not affiliated with, endorsed by or acting for any exam conducting
              body, school board, university or government department. That includes the National
              Testing Agency (NTA), the Staff Selection Commission (SSC), the Union Public Service
              Commission (UPSC), the Railway Recruitment Boards, the Central Board of Secondary
              Education (CBSE), the IITs, the IIMs, the Consortium of National Law Universities and
              state boards. Their names are used only to identify the exams we describe.
            </p>
          ),
        },
        {
          title: 'Always check the official source',
          body: (
            <>
              <p>
                Exam dates, eligibility rules, fees, patterns, syllabi and results are compiled from
                official notifications and can change without notice. Before you act on anything
                important, confirm it on the conducting body&rsquo;s official website:
              </p>
              <Bullets
                items={[
                  'application start and last dates, and fee payment deadlines;',
                  'eligibility conditions, age limits and category relaxations;',
                  'admit card, exam day and centre details;',
                  'answer keys, results, cut-offs and counselling schedules.',
                ]}
              />
              <p>
                Each exam page links to the official website. Where the next cycle has not been
                announced, we say so rather than guess, and any dates from a previous year are
                labelled with that year.
              </p>
            </>
          ),
        },
        {
          title: 'Study material',
          body: (
            <p>
              Previous-year papers, solutions, explanations and mock tests are provided to help you
              practise. We check them carefully, but errors are possible, and a mock-test score is
              not a prediction of your real result. If you spot a mistake, please{' '}
              <Link href={ROUTES.contact()} className="underline">
                tell us
              </Link>
              .
            </p>
          ),
        },
        {
          title: 'Advertisements and external links',
          body: (
            <p>
              Ads on this site are served by Google AdSense. We do not choose individual ads and do
              not endorse the products or services advertised. Links to other websites are provided
              for convenience, and we are not responsible for their content.
            </p>
          ),
        },
        {
          title: 'No liability',
          body: (
            <p>
              Information on {SITE.NAME} is provided in good faith and without warranty. We are not
              responsible for any loss caused by relying on it, including a missed deadline or a
              rejected application. The full terms are in our{' '}
              <Link href={ROUTES.terms()} className="underline">
                terms and conditions
              </Link>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
