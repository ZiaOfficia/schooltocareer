import 'katex/dist/katex.min.css';
import '@/styles/question-bank.css';

import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import type { AnswerProvenance, ChapterPageDto, QuestionDetailDto } from '@stc/types';
import { LastUpdated, Section, Wrap } from '@stc/ui';

import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import { QuestionPractice, type PracticeOption } from '@/components/question-practice';
import { ApiError, getExamChapter, getQuestion } from '@/lib/api';
import { examDisplayName } from '@/lib/exam-name';
import { questionHeadline } from '@/lib/question-headline';
import { renderRich, renderRichInline } from '@/lib/rich-text';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

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

const PROVENANCE: Record<
  AnswerProvenance,
  { tone: 'ok' | 'wait' | 'urgent' | undefined; text: string }
> = {
  OFFICIAL_FINAL: { tone: 'ok', text: 'Answer matches NTA’s final key' },
  OFFICIAL_PROVISIONAL: { tone: 'wait', text: 'Answer from NTA’s provisional key' },
  EDITORIAL: { tone: undefined, text: 'Our answer: no official key covers this question' },
  DROPPED: { tone: 'urgent', text: 'Dropped by NTA: marks given to all' },
};

function marks(question: QuestionDetailDto): string {
  const right = `+${question.marksRight}`;
  return question.marksWrong < 0 ? `${right} / ${question.marksWrong}` : `${right} / no negative`;
}

/** "JEE Main 2026", from the exam's short name and the paper's year. */
function examYear(question: QuestionDetailDto): string {
  return `${examDisplayName(question.exam.shortName)} ${question.paper.year}`;
}

/**
 * Title, description and heading are built from the question itself so no
 * two of the seventy-five pages in a paper read alike: the old title was the
 * stem's opening with maths blanked out, which made dozens of them identical.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const question = await load(await params);
  if (!question) return {};
  const chapter = question.chapter?.name ?? null;
  const exam = examYear(question);
  const suffix = ` | ${exam} Q${question.number}`;
  const official = question.answer.provenance.startsWith('OFFICIAL');
  const shift = question.paper.shift
    ? ` (${question.paper.shift.replace(` ${question.paper.year}`, '')})`
    : '';
  return buildMetadata({
    template: 'question',
    values: { siteName: SITE.NAME },
    path: question.path,
    absoluteTitle: true,
    title: `${questionHeadline(question.stem, chapter, 60 - suffix.length)}${suffix}`,
    description: `${questionHeadline(question.stem, chapter, 64)} ${exam}${shift} Q${question.number}: answer and worked solution${official ? ', checked against the official key' : ''}.`,
    modifiedTime: question.updatedAt,
  });
}

/** Other questions from the same chapter; empty when the chapter page is unavailable. */
async function chapterSiblings(question: QuestionDetailDto): Promise<ChapterPageDto['questions']> {
  if (!question.chapter) return [];
  try {
    const page = await getExamChapter<ChapterPageDto>(
      question.exam.slug,
      question.chapter.subject.slug,
      question.chapter.slug,
    );
    return (page?.questions ?? []).filter((row) => row.publicId !== question.publicId).slice(0, 6);
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
}

export default async function QuestionPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const question = await load(resolved);
  if (!question) notFound();

  const canonicalSegment = question.path.split('/').pop()!;
  if (resolved.question !== canonicalSegment) permanentRedirect(question.path);

  const { answer, chapter, paper } = question;
  const provenance = PROVENANCE[answer.provenance];
  const exam = examYear(question);
  const siblings = await chapterSiblings(question);

  const options: PracticeOption[] = question.options.map((option) => ({
    label: option.label,
    html: renderRichInline(option.body),
  }));
  const correct = question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.label);
  const numeric =
    question.type === 'NUMERICAL' && answer.numericValue !== null
      ? { value: Number(answer.numericValue), tolerance: Number(answer.numericTolerance ?? 0) }
      : null;

  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: examDisplayName(question.exam.shortName), path: question.exam.path },
    ...(chapter ? [{ name: chapter.name, path: chapter.path }] : []),
    { name: `Question ${question.number}`, path: question.path },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />

      <PageHero
        trail={trail}
        title={`${exam} question ${question.number}${chapter ? `: ${chapter.name}` : ''}`}
        subtitle={`${paper.title}. ${TYPE_LABEL[question.type]}, ${marks(question)} marks.`}
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
                <div
                  className="rich"
                  dangerouslySetInnerHTML={{ __html: renderRich(answer.solution) }}
                />
                <p className="mt-5 text-[13.5px] text-ink-mute">
                  {answer.answerKeySourceUrl ? (
                    <>
                      Answer checked against{' '}
                      <a
                        href={answer.answerKeySourceUrl}
                        target="_blank"
                        rel="noopener"
                        className="underline"
                      >
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

        {siblings.length > 0 && chapter ? (
          <Section
            title={`More ${chapter.name} questions`}
            lede={`Other ${chapter.name} questions from ${examDisplayName(question.exam.shortName)} papers, each with a worked solution.`}
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {siblings.map((row) => (
                <li key={row.publicId}>
                  <Link
                    href={row.path}
                    className="card block h-full p-4 text-[15px] text-ink no-underline"
                  >
                    <span className="block text-[13px] font-semibold text-ink-mute">
                      {row.paper.year}
                      {row.paper.shift ? `, ${row.paper.shift}` : ''} · Q{row.number}
                    </span>
                    <span className="mt-1 block leading-snug">{row.preview}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Keep going">
          <ul className="grid gap-4 sm:grid-cols-2">
            {chapter ? (
              <li>
                <Link
                  href={chapter.path}
                  className="card flex h-full items-center justify-between gap-3 p-5"
                >
                  <span className="font-display text-[16px] font-semibold text-ink">
                    All {chapter.name} questions
                  </span>
                  <ArrowRightIcon width={16} height={16} className="card-arrow text-ink-mute" />
                </Link>
              </li>
            ) : null}
            <li>
              <Link
                href={paper.path}
                className="card flex h-full items-center justify-between gap-3 p-5"
              >
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
