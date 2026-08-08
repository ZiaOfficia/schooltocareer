import type { EducationLevel } from '@stc/types';

export type ExamCategorySeed = {
  readonly slug: string;
  readonly name: string;
  readonly parentSlug?: string;
  readonly order: number;
  readonly educationLevel: EducationLevel;
};

export const EXAM_CATEGORIES = {
  ENGINEERING: 'engineering',
  MEDICAL: 'medical',
  MANAGEMENT: 'management',
  LAW: 'law',
  DESIGN: 'design',
  ARCHITECTURE: 'architecture',
  GOVERNMENT: 'government-jobs',
  BANKING: 'banking',
  SSC: 'ssc',
  RAILWAY: 'railway',
  DEFENCE: 'defence',
  TEACHING: 'teaching',
  UPSC: 'upsc',
  SCHOLARSHIP: 'scholarship-exams',
  BOARD: 'board-exams',
} as const;

export type ExamCategorySlug = (typeof EXAM_CATEGORIES)[keyof typeof EXAM_CATEGORIES];

export const EXAM_CATEGORY_SEEDS: readonly ExamCategorySeed[] = [
  { slug: EXAM_CATEGORIES.ENGINEERING, name: 'Engineering', order: 1, educationLevel: 'UNDERGRADUATE' },
  { slug: EXAM_CATEGORIES.MEDICAL, name: 'Medical', order: 2, educationLevel: 'UNDERGRADUATE' },
  { slug: EXAM_CATEGORIES.MANAGEMENT, name: 'Management', order: 3, educationLevel: 'POSTGRADUATE' },
  { slug: EXAM_CATEGORIES.LAW, name: 'Law', order: 4, educationLevel: 'UNDERGRADUATE' },
  { slug: EXAM_CATEGORIES.DESIGN, name: 'Design', order: 5, educationLevel: 'UNDERGRADUATE' },
  { slug: EXAM_CATEGORIES.ARCHITECTURE, name: 'Architecture', order: 6, educationLevel: 'UNDERGRADUATE' },
  { slug: EXAM_CATEGORIES.GOVERNMENT, name: 'Government Jobs', order: 7, educationLevel: 'CERTIFICATE' },
  { slug: EXAM_CATEGORIES.BANKING, name: 'Banking', parentSlug: EXAM_CATEGORIES.GOVERNMENT, order: 8, educationLevel: 'CERTIFICATE' },
  { slug: EXAM_CATEGORIES.SSC, name: 'SSC', parentSlug: EXAM_CATEGORIES.GOVERNMENT, order: 9, educationLevel: 'CERTIFICATE' },
  { slug: EXAM_CATEGORIES.RAILWAY, name: 'Railway', parentSlug: EXAM_CATEGORIES.GOVERNMENT, order: 10, educationLevel: 'CERTIFICATE' },
  { slug: EXAM_CATEGORIES.DEFENCE, name: 'Defence', parentSlug: EXAM_CATEGORIES.GOVERNMENT, order: 11, educationLevel: 'CERTIFICATE' },
  { slug: EXAM_CATEGORIES.UPSC, name: 'UPSC', parentSlug: EXAM_CATEGORIES.GOVERNMENT, order: 12, educationLevel: 'POSTGRADUATE' },
  { slug: EXAM_CATEGORIES.TEACHING, name: 'Teaching', parentSlug: EXAM_CATEGORIES.GOVERNMENT, order: 13, educationLevel: 'CERTIFICATE' },
  { slug: EXAM_CATEGORIES.SCHOLARSHIP, name: 'Scholarship Exams', order: 14, educationLevel: 'SCHOOL' },
  { slug: EXAM_CATEGORIES.BOARD, name: 'Board Exams', order: 15, educationLevel: 'SCHOOL' },
];

/**
 * Exams to seed first. These carry the overwhelming majority of Indian
 * education search volume, and they are the set passed to
 * `generateStaticParams` so the highest-traffic pages are prebuilt rather than
 * generated on first request.
 */
export const PRIORITY_EXAMS = {
  JEE_MAIN: 'jee-main',
  JEE_ADVANCED: 'jee-advanced',
  NEET_UG: 'neet-ug',
  CUET_UG: 'cuet-ug',
  CAT: 'cat',
  CLAT: 'clat',
  GATE: 'gate',
  NDA: 'nda',
  SSC_CGL: 'ssc-cgl',
  SSC_CHSL: 'ssc-chsl',
  IBPS_PO: 'ibps-po',
  SBI_PO: 'sbi-po',
  RRB_NTPC: 'rrb-ntpc',
  UPSC_CSE: 'upsc-civil-services',
  CTET: 'ctet',
  BITSAT: 'bitsat',
  VITEEE: 'viteee',
  WBJEE: 'wbjee',
  MHT_CET: 'mht-cet',
  NIFT: 'nift',
} as const;

export type PriorityExamSlug = (typeof PRIORITY_EXAMS)[keyof typeof PRIORITY_EXAMS];

/** Category assignment for the priority exams above. */
export const PRIORITY_EXAM_CATEGORY: Record<PriorityExamSlug, ExamCategorySlug> = {
  [PRIORITY_EXAMS.JEE_MAIN]: EXAM_CATEGORIES.ENGINEERING,
  [PRIORITY_EXAMS.JEE_ADVANCED]: EXAM_CATEGORIES.ENGINEERING,
  [PRIORITY_EXAMS.BITSAT]: EXAM_CATEGORIES.ENGINEERING,
  [PRIORITY_EXAMS.VITEEE]: EXAM_CATEGORIES.ENGINEERING,
  [PRIORITY_EXAMS.WBJEE]: EXAM_CATEGORIES.ENGINEERING,
  [PRIORITY_EXAMS.MHT_CET]: EXAM_CATEGORIES.ENGINEERING,
  [PRIORITY_EXAMS.GATE]: EXAM_CATEGORIES.ENGINEERING,
  [PRIORITY_EXAMS.NEET_UG]: EXAM_CATEGORIES.MEDICAL,
  [PRIORITY_EXAMS.CAT]: EXAM_CATEGORIES.MANAGEMENT,
  [PRIORITY_EXAMS.CLAT]: EXAM_CATEGORIES.LAW,
  [PRIORITY_EXAMS.NIFT]: EXAM_CATEGORIES.DESIGN,
  [PRIORITY_EXAMS.CUET_UG]: EXAM_CATEGORIES.SCHOLARSHIP,
  [PRIORITY_EXAMS.NDA]: EXAM_CATEGORIES.DEFENCE,
  [PRIORITY_EXAMS.SSC_CGL]: EXAM_CATEGORIES.SSC,
  [PRIORITY_EXAMS.SSC_CHSL]: EXAM_CATEGORIES.SSC,
  [PRIORITY_EXAMS.IBPS_PO]: EXAM_CATEGORIES.BANKING,
  [PRIORITY_EXAMS.SBI_PO]: EXAM_CATEGORIES.BANKING,
  [PRIORITY_EXAMS.RRB_NTPC]: EXAM_CATEGORIES.RAILWAY,
  [PRIORITY_EXAMS.UPSC_CSE]: EXAM_CATEGORIES.UPSC,
  [PRIORITY_EXAMS.CTET]: EXAM_CATEGORIES.TEACHING,
};

/** How many exams/boards to prebuild with generateStaticParams. */
export const PREBUILD_TOP_N = {
  EXAMS: 100,
  BOARDS: 30,
  BOARD_CLASSES: 200,
} as const;
