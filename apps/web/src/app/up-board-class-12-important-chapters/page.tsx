import { BoardPrepPage, boardPrepMetadata } from '@/components/board-prep-page';

/** UP Board Class 12 board exam prep. Content: lib/board-prep/board-prep.json. */

export function generateMetadata() {
  return boardPrepMetadata('up-board-class-12');
}

export default function Page() {
  return <BoardPrepPage slug="up-board-class-12" />;
}
