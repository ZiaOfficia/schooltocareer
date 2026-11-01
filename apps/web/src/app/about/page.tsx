import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';

import { Bullets, StaticPage } from '@/components/static-page';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Who runs the site and how its information is put together.
 *
 * Required reading for AdSense reviewers and, more to the point, for a student
 * deciding whether to trust a date found here. Everything said about method
 * must stay true of the product: if the sourcing changes, this page changes on
 * the same commit.
 */
const UPDATED = '2026-11-01';

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.about(),
    title: 'About Us',
    description:
      'Who runs SchoolToCareer, what it covers, and how exam dates, syllabi and papers are sourced from official notices and kept up to date.',
    modifiedTime: UPDATED,
  });
}

export default function AboutPage() {
  return (
    <StaticPage
      name="About"
      path={ROUTES.about()}
      title={`About ${SITE.NAME}`}
      lede="A free, independent guide to Indian entrance and recruitment exams: dates, eligibility, syllabus, exam pattern, previous-year papers and mock tests, in one place and in plain English."
      updated={UPDATED}
      sections={[
        {
          title: 'Why this site exists',
          body: (
            <>
              <p>
                Every year millions of students in India prepare for an entrance or recruitment
                exam. The information they need is public, but it is scattered across long PDF
                notices, separate portals for each conducting body, and pages that change without
                warning. Missing one date can cost a student a full year.
              </p>
              <p>
                {SITE.NAME} brings that information together for each exam and lays it out the way a
                candidate actually needs it: what the exam leads to, who can take it, what it tests,
                when the important dates fall, and what to practise next. It is free to use and
                needs no account.
              </p>
            </>
          ),
        },
        {
          title: 'What you will find here',
          body: (
            <Bullets
              items={[
                <>
                  <Link href={ROUTES.exams()} className="underline">
                    Exam guides
                  </Link>{' '}
                  for engineering, medical, law, management, SSC, banking, railway, UPSC, teaching
                  and design exams.
                </>,
                'Syllabus and exam pattern pages written from the official information bulletin.',
                <>
                  <Link href={ROUTES.papers()} className="underline">
                    Previous-year papers
                  </Link>{' '}
                  and timed{' '}
                  <Link href={ROUTES.mockTests()} className="underline">
                    mock tests
                  </Link>{' '}
                  with a solution for every question.
                </>,
                <>
                  Exam calendars for the{' '}
                  <Link href={ROUTES.ntaCalendar()} className="underline">
                    National Testing Agency
                  </Link>{' '}
                  and the{' '}
                  <Link href={ROUTES.sscCalendar()} className="underline">
                    Staff Selection Commission
                  </Link>
                  .
                </>,
              ]}
            />
          ),
        },
        {
          title: 'How the information is sourced',
          body: (
            <>
              <p>
                Dates, eligibility rules, syllabi and exam patterns are taken from the conducting
                body&rsquo;s own notices and websites: the National Testing Agency, the Staff
                Selection Commission, the Union Public Service Commission, the IITs and IIMs that
                run JEE Advanced, GATE and CAT, and the other official bodies named on each exam
                page. Each page links to its official source.
              </p>
              <Bullets
                items={[
                  'If a date has not been announced, we say so. We do not estimate or guess dates.',
                  'Pages show when they were last updated, so you can judge how fresh they are.',
                  'Information from a previous exam cycle is labelled with its year.',
                  'The explanations, summaries and guides are written by us, not copied from other sites.',
                ]}
              />
              <p>
                Official bodies can change dates and rules at short notice. Always confirm a
                deadline on the official website before acting on it; our{' '}
                <Link href={ROUTES.disclaimer()} className="underline">
                  disclaimer
                </Link>{' '}
                explains this in full.
              </p>
            </>
          ),
        },
        {
          title: 'Who runs it',
          body: (
            <>
              <p>
                {SITE.NAME} is an independent project built and run by Mohammad Abdullah from India.
                It is not affiliated with, endorsed by or connected to any exam conducting body,
                board, university or government department.
              </p>
              <p>
                The site is funded by advertising, which is how it stays free for students.
                Advertising never decides what an exam page says.
              </p>
            </>
          ),
        },
        {
          title: 'Corrections and feedback',
          body: (
            <p>
              Found a wrong date, a broken link or something unclear? Write to{' '}
              <span className="font-semibold text-ink">{SITE.CONTACT_EMAIL}</span> or use the{' '}
              <Link href={ROUTES.contact()} className="underline">
                contact page
              </Link>
              . Corrections to dates and eligibility are checked against the official source and
              fixed first.
            </p>
          ),
        },
      ]}
    />
  );
}
