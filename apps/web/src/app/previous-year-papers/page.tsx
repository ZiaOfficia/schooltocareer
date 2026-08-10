import { ROUTES, SITE } from '@stc/constants';
import type { PaperListItemDto } from '@stc/types';

import { IndexPage, type IndexItem } from '@/components/index-page';
import { ApiError, listPapers } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.papers(),
    title: 'Previous Year Question Papers PDF: Free Download',
    description:
      'Year-wise and shift-wise previous year question papers for entrance exams and school boards. Free PDF download, no registration, with solutions where an official answer key exists.',
  });
}

export default async function PapersIndex() {
  let papers: PaperListItemDto[] = [];
  try {
    // Newest first — a paper's value decays with age, so the default order
    // should match what most people are looking for.
    papers = await listPapers<PaperListItemDto>('limit=60&sort=year&dir=desc');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[papers] list unavailable: ${error.message}`);
  }

  const items: IndexItem[] = papers.map((paper) => ({
    href: paper.path,
    title: paper.title,
    meta: [paper.exam?.shortName, paper.subject?.name].filter(Boolean).join(' · ') || null,
    aside: `${paper.year}${paper.hasSolution ? ' · solved' : ''}`,
  }));

  return (
    <IndexPage
      kind="paper"
      title="Previous year papers"
      lede="Free PDFs, no registration. Solutions are included where the conducting body published an official answer key — and only then."
      items={items}
      unit="papers"
      emptyNote="The paper list could not be loaded. This is a temporary backend problem, not a missing page — try again shortly."
    />
  );
}
