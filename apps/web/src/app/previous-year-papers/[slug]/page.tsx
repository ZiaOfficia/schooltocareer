import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { PaperDetailDto, PaperFileDto } from '@stc/types';
import { EntityBadge, FactGrid, LastUpdated, Section, Wrap } from '@stc/ui';

import { ArrowRightIcon, ArrowUpRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { ApiError, getPaper } from '@/lib/api';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * ONE PAPER — the page every paper card on the site links to.
 *
 * It was missing: ROUTES.paper() existed and both paper listings linked to it,
 * so the first published paper would have sent every visitor to a 404.
 *
 * Deliberately a thin page, per the tiering note on the exam hub. Someone who
 * lands here wants the file, so the download is the first thing after the
 * heading and everything else is the few facts that help them decide whether
 * this is the paper they meant.
 */

export const revalidate = 3600;

type Params = { slug: string };

type Fact = { label: string; value: string | number };

/** A renamed or deleted paper answers 410; to a reader that is a 404. */
async function load(slug: string): Promise<PaperDetailDto | null> {
  try {
    return await getPaper<PaperDetailDto>(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 410) return null;
    throw error;
  }
}

const FILE_LABEL: Record<PaperFileDto['role'], string> = {
  PAPER: 'Question paper',
  ANSWER_KEY: 'Answer key',
  SOLUTION: 'Solutions',
};

/** The paper first, then whatever helps check it. */
const FILE_ORDER: PaperFileDto['role'][] = ['PAPER', 'ANSWER_KEY', 'SOLUTION'];

function sortedFiles(paper: PaperDetailDto): PaperFileDto[] {
  return [...paper.files].sort((a, b) => FILE_ORDER.indexOf(a.role) - FILE_ORDER.indexOf(b.role));
}

function fileDetail(file: PaperFileDto): string {
  return ['PDF', file.pageCount ? `${file.pageCount} pages` : null, file.sizeLabel]
    .filter(Boolean)
    .join(' · ');
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const paper = await load(slug);
  if (!paper) return {};

  const hasKey = paper.files.some((file) => file.role === 'ANSWER_KEY');

  return buildMetadata({
    template: 'paper',
    values: { title: paper.title, siteName: SITE.NAME },
    path: paper.path,
    // The template promises solutions. Most papers have none, so the title and
    // description are written from what this paper actually has.
    title: `${paper.title} PDF`,
    description: `${paper.title}: free PDF download${hasKey ? ', with the official answer key' : ''}. No sign-up needed.`,
    modifiedTime: paper.updatedAt,
  });
}

export default async function PaperPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const paper = await load(slug);
  if (!paper) notFound();

  const files = sortedFiles(paper);
  const examPapersPath = paper.exam ? ROUTES.examPapers(paper.exam.slug) : null;

  const trail = [
    { name: 'Home', path: ROUTES.home() },
    ...(paper.exam && examPapersPath
      ? [
          { name: paper.exam.shortName, path: paper.exam.path },
          { name: 'Previous year papers', path: examPapersPath },
        ]
      : [{ name: 'Previous year papers', path: ROUTES.papers() }]),
    { name: paper.shift ?? String(paper.year), path: paper.path },
  ];

  // Only what the row actually holds: a missing duration is left out, not
  // filled in from what the exam usually is.
  const known: Array<Fact | null> = [
    { label: 'Year', value: paper.year },
    paper.shift ? { label: 'Exam date and shift', value: paper.shift } : null,
    paper.setCode ? { label: 'Paper', value: paper.setCode } : null,
    paper.durationMin ? { label: 'Time allowed', value: `${paper.durationMin} minutes` } : null,
    paper.totalMarks ? { label: 'Maximum marks', value: paper.totalMarks } : null,
    paper.totalQuestions ? { label: 'Questions', value: paper.totalQuestions } : null,
  ];
  const facts = known.filter((fact): fact is Fact => fact !== null);

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />

      <PageHero
        trail={trail}
        badges={<EntityBadge kind="paper" />}
        title={paper.title}
        meta={<LastUpdated iso={paper.updatedAt} />}
      >
        <FactGrid items={facts} />
      </PageHero>

      <Wrap>
        <Section title="Download" major>
          <ul className="grid gap-3 sm:grid-cols-2">
            {files.map((file) => (
              <li key={`${file.role}-${file.locale}`} data-reveal>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener"
                  className="card flex h-full items-center justify-between gap-4 p-5"
                >
                  <span>
                    <span className="block font-display text-[16.5px] font-semibold text-ink">
                      {FILE_LABEL[file.role]}
                    </span>
                    <span className="num mt-1 block text-[12.5px] text-ink-mute">
                      {fileDetail(file)}
                    </span>
                  </span>
                  <ArrowUpRightIcon width={18} height={18} className="shrink-0 text-ink-mute" />
                </a>
              </li>
            ))}
          </ul>
          <p data-reveal className="mt-4 max-w-[68ch] text-[14px] text-ink-soft">
            The file opens in a new tab. It is the paper as the exam body issued it, not a retyped
            or memory-based copy.
            {files.some((file) => file.role === 'ANSWER_KEY')
              ? ' The answer key lists the correct option against each question ID printed in the paper.'
              : ''}
          </p>
        </Section>

        {paper.exam && examPapersPath ? (
          <Section title={`More ${paper.exam.shortName} papers`}>
            <ul className="grid gap-4 sm:grid-cols-2">
              <li data-reveal>
                <Link
                  href={`${examPapersPath}#year-${paper.year}`}
                  data-tilt
                  className="card flex h-full items-center justify-between gap-3 p-5"
                >
                  <span className="font-display text-[16px] font-semibold text-ink">
                    Other {paper.year} shifts
                  </span>
                  <ArrowRightIcon width={16} height={16} className="card-arrow text-ink-mute" />
                </Link>
              </li>
              <li data-reveal>
                <Link
                  href={examPapersPath}
                  data-tilt
                  className="card flex h-full items-center justify-between gap-3 p-5"
                >
                  <span className="font-display text-[16px] font-semibold text-ink">All years</span>
                  <ArrowRightIcon width={16} height={16} className="card-arrow text-ink-mute" />
                </Link>
              </li>
            </ul>
          </Section>
        ) : null}
      </Wrap>
    </>
  );
}
