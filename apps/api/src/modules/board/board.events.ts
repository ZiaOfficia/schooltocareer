import { ROUTES } from '@stc/constants';

import { defineEvents } from '../../core/events/define-events.js';

/** Board domain events. Same three lines as exam.events.ts. */
export const boardEvents = defineEvents<{ id: string; slug: string }>(
  'board',
  'BOARD',
  (board) => ROUTES.board(board.slug),
);