import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import type { ExamListItemDto } from '@stc/types';
import { EntityBadge, Eyebrow, Section, Wrap } from '@stc/ui';

import { ApiError, listExams } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.home(),
    title: `${SITE.NAME} — ${SITE.TAGLINE}`,
    description:
      'Exam dates, eligibility, syllabus, previous year question papers and results for India’s major exams and school boards. Free, and updated from official notifications.',
  });
}

export default async function HomePage() {
  // A listing may degrade to empty: the page is still useful, search still
  // works, and a backend blip should not take the homepage down. The sitemap
  // deliberately does NOT do this — see src/app/sitemap.ts.
  let exams: ExamListItemDto[] = [];
  try {
    exams = await listExams<ExamListItemDto>('limit=8&sort=popularityScore&dir=desc');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[home] exam list unavailable: ${error.message}`);
  }

  return (
    <Wrap>
      <section className="py-10">
        <Eyebrow>{SITE.COUNTRY === 'IN' ? 'India' : SITE.COUNTRY}</Eyebrow>
        <h1 className="mt-3 max-w-[20ch] text-[clamp(30px,6vw,52px)] leading-[1.04] tracking-tight">
          Every exam date, paper and result. In one place.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[17px] text-ink-soft">
          Compiled from official notifications, dated so you can see how current it is, and free
          without an account.
        </p>

        <form action={ROUTES.search()} method="get" role="search" className="mt-6 flex max-w-[560px]">
          <label htmlFor="home-search" className="sr-only">
            Search
          </label>
          <input
            id="home-search"
            name="q"
            type="search"
            placeholder="Try “JEE Main 2026” or “CBSE Class 10 Maths papers”"
            className="min-w-0 flex-1 border-[2.5px] border-rule-hard bg-surface px-4 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink-mute"
          />
          <button
            type="submit"
            className="border-[2.5px] border-l-0 border-rule-hard bg-ink px-5 py-2.5 text-[15px] font-semibold text-paper"
          >
            Search
          </button>
        </form>
      </section>

      <Section
        title="Popular exams"
        lede="The hubs people reach for most. Each links to syllabus, pattern, papers and results."
        major
        actions={
          <Link href={ROUTES.exams()} className="text-[13.5px]">
            All exams →
          </Link>
        }
      >
        {exams.length === 0 ? (
          <p className="border border-dashed border-rule-hard bg-paper p-4 text-[14px] text-ink-soft">
            No exams loaded. Start the API with <code className="font-data">pnpm dev</code> — this
            list is served from <code className="font-data">/api/v1/exams</code>.
          </p>
        ) : (
          <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            {exams.map((exam) => (
              <li key={exam.id} className="bg-surface">
                <Link href={exam.path} className="flex h-full flex-col gap-2 p-3 no-underline hover:bg-row-hover">
                  <EntityBadge kind="exam" />
                  <span className="text-[15px] font-semibold leading-snug text-ink">{exam.name}</span>
                  {exam.category ? (
                    <span className="text-[12.5px] text-ink-mute">{exam.category.name}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Wrap>
  );
}
