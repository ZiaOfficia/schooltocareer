import 'katex/dist/katex.min.css';
import '@/styles/question-bank.css';

import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { AnswerProvenance, QuestionDetailDto } from '@stc/types';
import { LastUpdated, Section, Wrap } from '@stc/ui';

import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { QuestionPractice, type PracticeOption } from '@/components/question-practice';
import { ApiError, getQuestion } from '@/lib/api';
import { renderRich, renderRichInline } from '@/lib/rich-text';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata, clamp } from '@/lib/seo/metadata';

/**
 * ONE QUESTION — a real exam question, answered and explained.
 *
 * The URL is /exam/<exam>/questions/<slug>-<publicId>. Only the publicId is
 * read; the slug is for people. A request with an out-of-date slug (the stem
 * was edited) is redirected permanently to the current one, so there is one
 * address per question and old links keep working.
 *
 * What makes this page worth indexing, and what a copied page could not
 * honestly claim: the question is from the official paper, the solution is
 * written here, and the answer says which official key it was checked
 * against (PRINCIPLES.md #2, #3).
 */

export const revalidate = 86400;

type Params = { slug: string; question: string };

const PUBLIC_ID = /-([a-z0-9]{10})$/;

function publicIdOf(segment: string): string | null {
  return PUBLIC_ID.exec(segment)?.[1] ?? null;
}

async function load(params: Params): Promise<QuestionDetailDto | null> {
  const publicId = publicIdOf(params.question);
  if (!publicId) return null;
  try {
    const question = await getQuestion<QuestionDetailDto>(publicId);
    // A question belongs to one exam; the same id under another exam is a 404,
    // not a second copy of the page.
    return question && question.exam.slug === params.slug ? question : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 410) return null;
    throw error;
  }
}

const TYPE_LABEL: Record<QuestionDetailDto['type'], string> = {
  MCQ_SINGLE: 'Single correct',
  MCQ_MULTI: 'One or more correct',
  NUMERICAL: 'Numerical answer',
};

const PROVENANCE: Record<AnswerProvenance, { tone: 'ok' | 'wait' | 'urgent' | undefined; text: string }> = {
  OFFICIAL_FINAL: { tone: 'ok', text: 'Answer matches NTA’s final key' },
  OFFICIAL_PROVISIONAL: { tone: 'wait', text: 'Answer from NTA’s provisional key' },
  EDITORIAL: { tone: undefined, text: 'Our answer: no official key covers this question' },
  DROPPED: { tone: 'urgent', text: 'Dropped by NTA: marks given to all' },
};

function marks(question: QuestionDetailDto): string {
  const right = `+${question.marksRight}`;
  return question.marksWrong < 0 ? `${right} / ${question.marksWrong}` : `${right} / no negative`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const question = await load(await params);
  if (!question) return {};
  const preview = clamp(question.preview, 52);
  const official = question.answer.provenance.startsWith('OFFICIAL');
  return buildMetadata({
    template: 'question',
    values: {
      preview,
      exam: question.exam.shortName,
      year: question.paper.year,
      paper: question.paper.title,
      keyNote: official ? ', checked against the official answer key' : '',
      siteName: SITE.NAME,
    },
    path: question.path,
    modifiedTime: question.updatedAt,
  });
}

export default async function QuestionPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const question = await load(resolved);
  if (!question) notFound();

  const canonicalSegment = question.path.split('/').pop()!;
  if (resolved.question !== canonicalSegment) permanentRedirect(question.path);

  const { answer, chapter, paper } = question;
  const provenance = PROVENANCE[answer.provenance];

  const options: PracticeOption[] = question.options.map((option) => ({
    label: option.label,
    html: renderRichInline(option.body),
  }));
  const correct = question.options.filter((option) => option.isCorrect).map((option) => option.label);
  const numeric =
    question.type === 'NUMERICAL' && answer.numericValue !== null
      ? { value: Number(answer.numericValue), tolerance: Number(answer.numericTolerance ?? 0) }
      : null;

  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: question.exam.shortName, path: question.exam.path },
    ...(chapter ? [{ name: chapter.name, path: chapter.path }] : []),
    { name: `Question ${question.number}`, path: question.path },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />

      <PageHero
        trail={trail}
        title={`${question.exam.shortName} ${paper.year} · ${chapter?.name ?? 'Question'}`}
        subtitle={`${paper.title}, question ${question.number}`}
        meta={<LastUpdated iso={question.updatedAt} />}
      />

      <Wrap>
        <div className="mx-auto max-w-[820px] py-8 sm:py-10">
          <article className="q-card">
            <div className="q-meta mb-5">
              <span className="chip">{TYPE_LABEL[question.type]}</span>
              <span className="chip num">{marks(question)}</span>
              {chapter?.syllabusStatus === 'REMOVED' ? (
                <span className="chip" data-tone="wait">
                  Chapter no longer in the syllabus
                </span>
              ) : null}
              <span className="chip" data-tone={provenance.tone}>
                {provenance.text}
              </span>
            </div>

            <div className="rich" dangerouslySetInnerHTML={{ __html: renderRich(question.stem) }} />

            <div className="mt-7">
              <QuestionPractice
                type={question.type}
                options={options}
                correct={correct}
                numeric={numeric}
                dropped={answer.provenance === 'DROPPED'}
              >
                <h2 className="mb-3 text-[19px] font-semibold text-ink">Solution</h2>
                <div className="rich" dangerouslySetInnerHTML={{ __html: renderRich(answer.solution) }} />
                <p className="mt-5 text-[13.5px] text-ink-mute">
                  {answer.answerKeySourceUrl ? (
                    <>
                      Answer checked against{' '}
                      <a href={answer.answerKeySourceUrl} target="_blank" rel="noopener" className="underline">
                        the official answer key
                      </a>
                      . The solution is our own working.
                    </>
                  ) : (
                    'No official answer key covers this question. The answer and the working are our own.'
                  )}
                </p>
              </QuestionPractice>
            </div>
          </article>

          <nav aria-label="More questions" className="mt-6 grid gap-3 sm:grid-cols-2">
            {question.previous ? (
              <Link href={question.previous.path} className="q-card block text-[14.5px]">
                <span className="block text-[12.5px] text-ink-mute">Previous in this chapter</span>
                <span className="mt-1 block text-ink">{question.previous.preview}</span>
              </Link>
            ) : (
              <span />
            )}
            {question.next ? (
              <Link href={question.next.path} className="q-card block text-[14.5px] sm:text-right">
                <span className="block text-[12.5px] text-ink-mute">Next in this chapter</span>
                <span className="mt-1 block text-ink">{question.next.preview}</span>
              </Link>
            ) : null}
          </nav>
        </div>

        <Section title="Keep going">
          <ul className="grid gap-4 sm:grid-cols-2">
            {chapter ? (
              <li>
                <Link href={chapter.path} className="card flex h-full items-center justify-between gap-3 p-5">
                  <span className="font-display text-[16px] font-semibold text-ink">
                    All {chapter.name} questions
                  </span>
                  <ArrowRightIcon width={16} height={16} className="card-arrow text-ink-mute" />
                </Link>
              </li>
            ) : null}
            <li>
              <Link href={paper.path} className="card flex h-full items-center justify-between gap-3 p-5">
                <span className="font-display text-[16px] font-semibold text-ink">
                  The full {paper.shift ?? String(paper.year)} paper
                </span>
                <ArrowRightIcon width={16} height={16} className="card-arrow text-ink-mute" />
              </Link>
            </li>
          </ul>
        </Section>
      </Wrap>
    </>
  );
}
