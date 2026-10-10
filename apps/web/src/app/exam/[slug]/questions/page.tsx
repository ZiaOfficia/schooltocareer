import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamPracticeDto } from '@stc/types';
import { FactGrid, Section, Wrap } from '@stc/ui';

import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { getExamPractice } from '@/lib/api';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * An exam's previous year questions, chapter by chapter: the way into the
 * question bank. Every chapter listed has at least one published question,
 * with its count; chapters with none are left out rather than shown empty.
 */

export const revalidate = 3600;

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const hub = await getExamPractice<ExamPracticeDto>(slug);
  if (!hub) return {};
  return buildMetadata({
    template: 'examPractice',
    values: { exam: hub.exam.shortName, count: hub.totalQuestions, siteName: SITE.NAME },
    path: hub.practicePath,
  });
}

export default async function ExamPracticePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const hub = await getExamPractice<ExamPracticeDto>(slug);
  if (!hub) notFound();

  const latest = hub.mockTests[0] ?? null;
  const chapterCount = hub.subjects.reduce((sum, s) => sum + s.chapters.length, 0);
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: hub.exam.shortName, path: hub.exam.path },
    { name: 'Previous year questions', path: hub.practicePath },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />
      <PageHero
        trail={trail}
        title={`${hub.exam.shortName} previous year questions`}
        lede="Real questions from official papers, sorted by chapter. Each one has a step-by-step solution, and its answer is checked against the official key."
      >
        <FactGrid
          items={[
            { label: 'Questions', value: hub.totalQuestions },
            { label: 'Chapters with questions', value: chapterCount },
            { label: 'Papers digitised', value: hub.mockTests.length },
          ]}
        />
        {latest ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={latest.path} className="btn btn-primary">
              Take a timed mock test
            </Link>
            <a href="#chapters" className="btn btn-ghost">
              Practise by chapter
            </a>
          </div>
        ) : null}
      </PageHero>

      <Wrap>
        <div id="chapters" />
        {hub.subjects.map((group) => (
          <Section
            key={group.subject.slug}
            title={group.subject.name}
            lede={`${group.questionCount} ${group.questionCount === 1 ? 'question' : 'questions'} across ${group.chapters.length} ${group.chapters.length === 1 ? 'chapter' : 'chapters'}`}
          >
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.chapters.map((chapter) => (
                <li key={chapter.slug}>
                  <Link href={chapter.path} className="card flex h-full items-center justify-between gap-3 p-4">
                    <span className="min-w-0">
                      {chapter.unit ? (
                        <span className="block text-[12px] uppercase tracking-[0.08em] text-ink-mute">
                          {chapter.unit.name}
                        </span>
                      ) : null}
                      <span className="block font-semibold text-ink">{chapter.name}</span>
                      <span className="num mt-0.5 block text-[13px] text-ink-mute">
                        {chapter.questionCount} {chapter.questionCount === 1 ? 'question' : 'questions'}
                      </span>
                    </span>
                    <ArrowRightIcon width={16} height={16} className="card-arrow shrink-0 text-ink-mute" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ))}

        <Section
          title="Full papers as mock tests"
          lede="The whole paper, timed and marked as in the exam, with your score and a solution for every question at the end."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {hub.mockTests.map((mock) => (
              <li key={mock.paper.slug}>
                <Link href={mock.path} className="card flex h-full items-center justify-between gap-3 p-5">
                  <span>
                    <span className="block font-display text-[16px] font-semibold text-ink">
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
          </ul>
        </Section>
      </Wrap>
    </>
  );
}
