import 'katex/dist/katex.min.css';
import '@/styles/question-bank.css';
import '@/styles/mock-test.css';

import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { MockTestDto } from '@stc/types';
import { Wrap } from '@stc/ui';

import { MockTest, type MockTestSection } from '@/components/mock-test';
import { PageHero } from '@/components/page-hero';
import { getMockTest } from '@/lib/api';
import { renderRich, renderRichInline } from '@/lib/rich-text';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * A digitised paper, taken as a timed test.
 *
 * NOINDEX. The same questions already have indexable pages of their own, one
 * per question; this page is a tool for using them, not more content. It is
 * linked from the menu, the homepage and the paper page, which is how
 * students find it.
 */

export const revalidate = 86400;

type Params = { slug: string; paper: string };

async function load({ slug, paper }: Params): Promise<MockTestDto | null> {
  const test = await getMockTest<MockTestDto>(paper);
  // A paper belongs to one exam; the same paper under another exam is a 404.
  return test && test.exam.slug === slug ? test : null;
}

const count = (test: MockTestDto) => test.sections.reduce((sum, s) => sum + s.questions.length, 0);

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const test = await load(resolved);
  if (!test) return {};
  return buildMetadata({
    template: 'mockTest',
    values: { exam: test.exam.shortName, paper: test.paper.shift ?? String(test.paper.year), count: count(test), siteName: SITE.NAME },
    path: ROUTES.mockTest(resolved.slug, resolved.paper),
    noindex: true,
  });
}

export default async function MockTestPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const test = await load(resolved);
  if (!test) notFound();

  const path = ROUTES.mockTest(resolved.slug, resolved.paper);
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Mock tests', path: ROUTES.mockTests() },
    { name: test.exam.shortName, path: ROUTES.examPractice(test.exam.slug) },
    { name: test.paper.shift ?? String(test.paper.year), path },
  ];

  // Typeset here, once, so the browser receives finished HTML.
  const sections: MockTestSection[] = test.sections.map((section) => ({
    subject: section.subject,
    questions: section.questions.map((q) => ({
      publicId: q.publicId,
      path: q.path,
      number: q.number,
      type: q.type,
      marksRight: q.marksRight,
      marksWrong: q.marksWrong,
      stemHtml: renderRich(q.stem),
      options: q.options.map((option) => ({ label: option.label, html: renderRichInline(option.body) })),
      correct: q.correct,
      numeric:
        q.type === 'NUMERICAL' && q.numericValue !== null
          ? { value: Number(q.numericValue), tolerance: Number(q.numericTolerance ?? 0) }
          : null,
      dropped: q.dropped,
    })),
  }));

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />
      <PageHero
        trail={trail}
        title={`${test.exam.shortName} mock test: ${test.paper.shift ?? test.paper.year}`}
        subtitle={test.paper.title}
        lede={`The real ${test.paper.year} paper, ${count(test)} questions, timed and marked the way the exam is. Free, and nothing to sign up for.`}
      />
      <Wrap>
        <div className="py-8 sm:py-10">
          <MockTest
            storageKey={`stc:mock-test:${test.paper.slug}:v1`}
            title={test.paper.shift ?? test.paper.title}
            examName={test.exam.shortName}
            durationMin={test.durationMin}
            totalMarks={test.totalMarks}
            sections={sections}
            paperPath={test.paper.path}
          />
        </div>
      </Wrap>
    </>
  );
}
