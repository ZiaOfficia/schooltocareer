import { CUET_UG_CONTENT } from './cuet-ug';
import { JEE_MAIN_CONTENT } from './jee-main';
import { NEET_UG_CONTENT } from './neet-ug';
import { SSC_CGL_CONTENT } from './ssc-cgl';
import type { EditorialSection, ExamContent, ExamContentSet } from './types';

export { EDITORIAL_SECTIONS } from './types';
export type { ContentBlock, EditorialSection, ExamContent } from './types';

/** Keyed by exam slug. An exam with no entry has no editorial sections. */
const EXAM_CONTENT: Readonly<Record<string, ExamContentSet>> = {
  'jee-main': JEE_MAIN_CONTENT,
  'neet-ug': NEET_UG_CONTENT,
  'cuet-ug': CUET_UG_CONTENT,
  'ssc-cgl': SSC_CGL_CONTENT,
};

export function examContent(examSlug: string, section: EditorialSection): ExamContent | undefined {
  return EXAM_CONTENT[examSlug]?.[section];
}
