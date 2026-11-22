import { BoardPrepPage, boardPrepMetadata } from '@/components/board-prep-page';

/** ISC Class 12 board exam prep. Content: lib/board-prep/board-prep.json. */
export const revalidate = 86400;

export function generateMetadata() {
  return boardPrepMetadata('isc-class-12');
}

export default function Page() {
  return <BoardPrepPage slug="isc-class-12" />;
}
