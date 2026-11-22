import { BoardPrepPage, boardPrepMetadata } from '@/components/board-prep-page';

/** UP Board Class 10 board exam prep. Content: lib/board-prep/board-prep.json. */
export const revalidate = 86400;

export function generateMetadata() {
  return boardPrepMetadata('up-board-class-10');
}

export default function Page() {
  return <BoardPrepPage slug="up-board-class-10" />;
}
