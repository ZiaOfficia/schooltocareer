import { ROUTES, SITE } from '@stc/constants';
import type { ExamListItemDto } from '@stc/types';

import { IndexPage, type IndexItem } from '@/components/index-page';
import { ApiError, listExams } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.exams(),
    title: 'All Entrance Exams in India: Dates, Syllabus & Papers',
    description:
      'Every entrance exam we cover — engineering, medical, management, law, banking and government. Dates, eligibility, syllabus, previous year papers and results for each.',
  });
}

export default async function ExamsIndex() {
  let exams: ExamListItemDto[] = [];
  try {
    exams = await listExams<ExamListItemDto>('limit=200&sort=popularityScore&dir=desc');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[exams] list unavailable: ${error.message}`);
  }

  const items: IndexItem[] = exams.map((exam) => ({
    href: exam.path,
    title: exam.name,
    meta: exam.category?.name ?? null,
    aside: exam.shortName !== exam.name ? exam.shortName : null,
  }));

  return (
    <IndexPage
      kind="exam"
      title="Exams"
      lede="Every exam we cover, most searched first. Each links to dates, syllabus, eligibility, previous papers and results."
      items={items}
      unit="exams"
      emptyNote="The exam list could not be loaded. This is a temporary backend problem, not a missing page — try again shortly."
    />
  );
}
