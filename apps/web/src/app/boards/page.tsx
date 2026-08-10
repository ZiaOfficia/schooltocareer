import { ROUTES, SITE } from '@stc/constants';
import type { BoardListItemDto } from '@stc/types';

import { IndexPage, type IndexItem } from '@/components/index-page';
import { ApiError, listBoards } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.boards(),
    title: 'School Boards in India: Syllabus, Date Sheets & Papers',
    description:
      'CBSE, ICSE and every state board — syllabus, date sheets, previous year question papers and results, organised by class and subject.',
  });
}

export default async function BoardsIndex() {
  let boards: BoardListItemDto[] = [];
  try {
    boards = await listBoards<BoardListItemDto>('limit=200&sort=popularityScore&dir=desc');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`[boards] list unavailable: ${error.message}`);
  }

  const items: IndexItem[] = boards.map((board) => ({
    href: board.path,
    title: board.name,
    meta: board.state?.name ?? 'National',
    aside: board.shortName !== board.name ? board.shortName : null,
  }));

  return (
    <IndexPage
      kind="board"
      title="Boards"
      lede="National and state school boards. Each opens onto its classes, subjects and papers."
      items={items}
      unit="boards"
      emptyNote="The board list could not be loaded. This is a temporary backend problem, not a missing page — try again shortly."
    />
  );
}
