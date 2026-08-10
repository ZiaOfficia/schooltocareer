import { ROUTES, SITE } from '@stc/constants';
import type { ResultListItemDto } from '@stc/types';

import { IndexPage, type IndexItem } from '@/components/index-page';
import { ApiError, listResults } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.results(),
    title: 'Exam Results: Declaration Dates & Direct Links',
    description:
      'Entrance exam and board results — declaration dates, direct links to the official scorecard, and what to do when a result is still awaited.',
  });
}

/** Awaited results are stated as awaited, never as a guess. */
function phaseLabel(result: ResultListItemDto): string {
  if (result.isDeclared) {
    return result.declaredAt
      ? `Declared ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(result.declaredAt))}`
      : 'Declared';
  }
  if (result.expectedAt && result.daysUntilExpected !== null && result.daysUntilExpected >= 0) {
    return `Expected in ${result.daysUntilExpected}d`;
  }
  return 'Awaited';
}

export default async function ResultsIndex() {
  let results: ResultListItemDto[] = [];
  try {
    results = await listResults<ResultListItemDto>('limit=60&sort=year&dir=desc');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[results] list unavailable: ${error.message}`);
  }

  const items: IndexItem[] = results.map((result) => ({
    href: result.path,
    title: result.title,
    meta: result.exam?.shortName ?? result.board?.shortName ?? null,
    aside: phaseLabel(result),
  }));

  return (
    <IndexPage
      kind="result"
      title="Results"
      lede="Declaration dates and direct links. Where a result has not been announced, this says so rather than estimating."
      items={items}
      unit="results"
      emptyNote="The result list could not be loaded. This is a temporary backend problem, not a missing page — try again shortly."
    />
  );
}
