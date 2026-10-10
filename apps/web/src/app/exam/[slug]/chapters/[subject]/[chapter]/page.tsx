import '@/styles/question-bank.css';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { ChapterPageDto, ChapterYearStatDto } from '@stc/types';
import { FactGrid, LastUpdated, Section, Wrap } from '@stc/ui';

import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { getExamChapter } from '@/lib/api';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * ONE CHAPTER of an exam syllabus: every digitised question on it, newest
 * paper first, and what the papers say about it year by year.
 *
 * INDEXING (PRINCIPLES.md #6). A chapter with a handful of questions is a
 * thin list, so it is noindex until it holds INDEX_THRESHOLD of them. It still
 * renders and links: a student who reaches it is helped, and the question
 * pages it links to are indexable on their own merit.
 */

export const revalidate = 86400;

/** Questions a chapter needs before it is worth a search result of its own. */
const INDEX_THRESHOLD = 15;

type Params = { slug: string; subject: string; chapter: string };

async function load(params: Params): Promise<ChapterPageDto | null> {
  return getExamChapter<ChapterPageDto>(params.slug, params.subject, params.chapter);
}

const pct = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)}%`;

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const chapter = await load(await params);
  if (!chapter) return {};
  return buildMetadata({
    template: 'examChapter',
    values: {
      chapter: chapter.name,
      subject: chapter.subject.name,
      exam: chapter.exam.shortName,
      siteName: SITE.NAME,
    },
    path: chapter.path,
    modifiedTime: chapter.updatedAt,
    noindex: chapter.totalQuestions < INDEX_THRESHOLD,
  });
}

function YearStats({ stats }: { stats: ChapterYearStatDto[] }) {
  // Bars are scaled to the chapter's own busiest year, so the shape over time
  // reads at a glance; every bar also states its raw counts.
  const widest = Math.max(...stats.map((stat) => stat.weightagePct), 1);
  return (
    <ul className="grid gap-3">
      {stats.map((stat) => (
        <li key={stat.year} className="grid grid-cols-[3.5em_1fr] items-center gap-x-4 gap-y-1">
          <span className="num text-[14px] font-semibold text-ink">{stat.year}</span>
          <span
            aria-hidden="true"
            className="block h-2.5 rounded-full"
            style={{
              width: `${Math.max((stat.weightagePct / widest) * 100, 2)}%`,
              background: 'var(--color-brand)',
            }}
          />
          <span className="col-start-2 text-[13.5px] text-ink-soft">
            <span className="num font-semibold text-ink">{pct(stat.weightagePct)}</span> of the subject:{' '}
            <span className="num">
              {stat.questions} of {stat.subjectQuestions}
            </span>{' '}
            questions, from {stat.papersInYear} {stat.papersInYear === 1 ? 'paper' : 'papers'} we have digitised
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ChapterPage({ params }: { params: Promise<Params> }) {
  const chapter = await load(await params);
  if (!chapter) notFound();

  const latest = chapter.stats[0] ?? null;
  const years = chapter.stats.map((stat) => stat.year);
  const official = chapter.questions.filter((q) => q.provenance.startsWith('OFFICIAL')).length;

  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: chapter.exam.shortName, path: chapter.exam.path },
    { name: chapter.name, path: chapter.path },
  ];

  const facts = [
    { label: 'Questions here', value: chapter.totalQuestions },
    ...(years.length
      ? [{ label: 'Years', value: years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : years[0]! }]
      : []),
    ...(latest ? [{ label: `Weightage in ${latest.year}`, value: pct(latest.weightagePct) }] : []),
    { label: 'Answers on the official key', value: `${official} of ${chapter.totalQuestions}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />

      <PageHero
        trail={trail}
        title={`${chapter.name}: ${chapter.exam.shortName} previous year questions`}
        subtitle={`${chapter.subject.name}${chapter.unit ? ` · ${chapter.unit.name}` : ''}`}
        meta={<LastUpdated iso={chapter.updatedAt} />}
      >
        <FactGrid items={facts} />
      </PageHero>

      <Wrap>
        {chapter.syllabusStatus !== 'IN_SYLLABUS' ? (
          <p className="mt-8 max-w-[68ch] rounded-xl border border-rule p-4 text-[14.5px] text-ink-soft">
            {chapter.syllabusStatus === 'REMOVED'
              ? 'This chapter has been removed from the current syllabus. Its past questions are kept here as a record.'
              : 'Part of this chapter has been removed from the current syllabus.'}
            {chapter.syllabusSourceUrl ? (
              <>
                {' '}
                <a href={chapter.syllabusSourceUrl} target="_blank" rel="noopener" className="underline">
                  See the official notice
                </a>
                .
              </>
            ) : null}
          </p>
        ) : null}

        {chapter.description ? (
          <p className="mt-8 max-w-[68ch] text-[16px] leading-relaxed text-ink-soft">{chapter.description}</p>
        ) : null}

        {chapter.stats.length ? (
          <Section
            title="How often it is asked"
            lede="Share of the subject's questions on this chapter, counted from the papers we have digitised so far. As more papers are added these figures firm up."
          >
            <YearStats stats={chapter.stats} />
          </Section>
        ) : null}

        <Section title={`All ${chapter.totalQuestions} questions`} major>
          <ol className="border-t border-rule">
            {chapter.questions.map((q) => (
              <li key={q.publicId}>
                <Link href={q.path} className="q-row">
                  <span className="num text-[13px] text-ink-mute">Q{q.number}</span>
                  <span className="q-row-preview">{q.preview}</span>
                  <span className="q-row-paper">
                    {q.paper.title}
                    {q.provenance === 'DROPPED' ? ' · dropped by NTA' : ''}
                  </span>
                  <ArrowRightIcon width={16} height={16} className="q-row-arrow" />
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      </Wrap>
    </>
  );
}
