import { CLAT_CONTENT } from './clat';
import { CUET_UG_CONTENT } from './cuet-ug';
import { JEE_ADVANCED_CONTENT } from './jee-advanced';
import { JEE_MAIN_CONTENT } from './jee-main';
import { NDA_CONTENT } from './nda';
import { NEET_UG_CONTENT } from './neet-ug';
import { SSC_CGL_CONTENT } from './ssc-cgl';
import type { EditorialSection, ExamContent, ExamContentSet } from './types';

export { EDITORIAL_SECTIONS } from './types';
export type { ContentBlock, EditorialSection, ExamContent } from './types';

/** Keyed by exam slug. An exam with no entry has no editorial sections. */
const EXAM_CONTENT: Readonly<Record<string, ExamContentSet>> = {
  'jee-main': JEE_MAIN_CONTENT,
  'jee-advanced': JEE_ADVANCED_CONTENT,
  'neet-ug': NEET_UG_CONTENT,
  'cuet-ug': CUET_UG_CONTENT,
  'ssc-cgl': SSC_CGL_CONTENT,
  clat: CLAT_CONTENT,
  nda: NDA_CONTENT,
};

/**
 * Exams with at least one written section, in the order listed above. The
 * home page leads with these: they are the finished pages, where an exam hub
 * on its own may still be waiting for dates.
 */
export function examsWithContent(): readonly string[] {
  return Object.keys(EXAM_CONTENT);
}

export function examContent(examSlug: string, section: EditorialSection): ExamContent | undefined {
  return EXAM_CONTENT[examSlug]?.[section];
}
