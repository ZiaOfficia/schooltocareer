import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import type { PracticeExamDto } from '@stc/types';
import { Section, Wrap } from '@stc/ui';

import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { listPractice } from '@/lib/api';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Every mock test and every practice hub, exam by exam. Built from what is
 * actually digitised, so it only ever lists tests that open.
 */

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'mockTests',
    values: { siteName: SITE.NAME },
    path: ROUTES.mockTests(),
  });
}

export default async function MockTestsPage() {
  const exams = await listPractice<PracticeExamDto>();
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Mock tests', path: ROUTES.mockTests() },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />
      <PageHero
        trail={trail}
        title="Mock tests and practice"
        lede="Take a real previous year paper as a timed test, marked the way the exam is, then see a worked solution for every question. Or practise one chapter at a time."
      />

      <Wrap>
        {exams.length === 0 ? (
          <p className="py-12 text-[16px] text-ink-soft">
            The first papers are being digitised. Until then, the papers themselves are on{' '}
            <Link href={ROUTES.papers()} className="underline">
              previous year papers
            </Link>
            .
          </p>
        ) : null}

        {exams.map((entry) => (
          <Section
            key={entry.exam.slug}
            title={entry.exam.shortName}
            lede={`${entry.mockTests.length} ${entry.mockTests.length === 1 ? 'paper' : 'papers'} · ${entry.totalQuestions} questions with solutions`}
            major
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {entry.mockTests.map((mock) => (
                <li key={mock.paper.slug}>
                  <Link href={mock.path} className="card flex h-full items-center justify-between gap-3 p-5">
                    <span>
                      <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
                        Mock test
                      </span>
                      <span className="mt-1 block font-display text-[16px] font-semibold text-ink">
                        {mock.paper.shift ?? mock.paper.title}
                      </span>
                      <span className="num mt-1 block text-[13px] text-ink-mute">
                        {mock.paper.year} · {mock.questionCount} questions
                      </span>
                    </span>
                    <span className="btn btn-primary shrink-0">Start</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href={entry.practicePath} className="card flex h-full items-center justify-between gap-3 p-5">
                  <span>
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
                      Practice
                    </span>
                    <span className="mt-1 block font-display text-[16px] font-semibold text-ink">
                      {entry.exam.shortName} questions by chapter
                    </span>
                    <span className="num mt-1 block text-[13px] text-ink-mute">
                      {entry.totalQuestions} questions, each with a solution
                    </span>
                  </span>
                  <ArrowRightIcon width={18} height={18} className="card-arrow shrink-0 text-ink-mute" />
                </Link>
              </li>
            </ul>
          </Section>
        ))}
      </Wrap>
    </>
  );
}
