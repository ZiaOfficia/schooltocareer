import { JEE_MAIN_CONTENT } from './jee-main';
import type { EditorialSection, ExamContent, ExamContentSet } from './types';

export { EDITORIAL_SECTIONS } from './types';
export type { ContentBlock, EditorialSection, ExamContent } from './types';

/** Keyed by exam slug. An exam with no entry has no editorial sections. */
const EXAM_CONTENT: Readonly<Record<string, ExamContentSet>> = {
  'jee-main': JEE_MAIN_CONTENT,
};

export function examContent(examSlug: string, section: EditorialSection): ExamContent | undefined {
  return EXAM_CONTENT[examSlug]?.[section];
}
