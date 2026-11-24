import { BoardPrepPage, boardPrepMetadata } from '@/components/board-prep-page';

/** ICSE Class 10 board exam prep. Content: lib/board-prep/board-prep.json. */

export function generateMetadata() {
  return boardPrepMetadata('icse-class-10');
}

export default function Page() {
  return <BoardPrepPage slug="icse-class-10" />;
}
