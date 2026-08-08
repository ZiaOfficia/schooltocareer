import { ROUTES } from '@stc/constants';

import { defineEvents } from '../../core/events/define-events.js';

export const resultEvents = defineEvents<{ id: string; slug: string }>(
  'result',
  'RESULT',
  (result) => ROUTES.result(result.slug),
);