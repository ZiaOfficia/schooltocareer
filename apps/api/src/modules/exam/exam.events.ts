import { ROUTES } from '@stc/constants';

import { defineEvents } from '../../core/events/define-events.js';

/**
 * Exam domain events.
 *
 * Three lines, because `defineEvents` builds the seven constructors. Every
 * Phase 5 module has a file exactly this shape - only the name, OwnerType and
 * path builder change.
 */
export const examEvents = defineEvents<{ id: string; slug: string }>(
  'exam',
  'EXAM',
  (exam) => ROUTES.exam(exam.slug),
);