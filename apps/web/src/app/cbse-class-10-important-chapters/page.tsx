import { BoardPrepPage, boardPrepMetadata } from '@/components/board-prep-page';

/** CBSE Class 10 board exam prep. Content: lib/board-prep/board-prep.json. */

export function generateMetadata() {
  return boardPrepMetadata('cbse-class-10');
}

export default function Page() {
  return <BoardPrepPage slug="cbse-class-10" />;
}
