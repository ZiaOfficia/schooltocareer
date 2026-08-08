import { ROUTES } from '@stc/constants';

import { defineEvents } from '../../core/events/define-events.js';

export const paperEvents = defineEvents<{ id: string; slug: string }>(
  'question-paper',
  'QUESTION_PAPER',
  (paper) => ROUTES.paper(paper.slug),
);