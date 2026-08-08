import type { EducationLevel, StreamType } from '@stc/types';

export type SubjectSeed = {
  readonly slug: string;
  readonly name: string;
  readonly educationLevel: EducationLevel;
  /** Class orders where this subject is normally offered. */
  readonly classOrders: readonly number[];
  /** Streams where it applies; empty means all/none-specific. */
  readonly streams?: readonly StreamType[];
};

export const SUBJECTS = {
  MATHEMATICS: 'mathematics',
  SCIENCE: 'science',
  PHYSICS: 'physics',
  CHEMISTRY: 'chemistry',
  BIOLOGY: 'biology',
  ENGLISH: 'english',
  HINDI: 'hindi',
  SOCIAL_SCIENCE: 'social-science',
  HISTORY: 'history',
  GEOGRAPHY: 'geography',
  POLITICAL_SCIENCE: 'political-science',
  ECONOMICS: 'economics',
  ACCOUNTANCY: 'accountancy',
  BUSINESS_STUDIES: 'business-studies',
  COMPUTER_SCIENCE: 'computer-science',
  INFORMATICS_PRACTICES: 'informatics-practices',
  PSYCHOLOGY: 'psychology',
  SOCIOLOGY: 'sociology',
  PHYSICAL_EDUCATION: 'physical-education',
  SANSKRIT: 'sanskrit',
  ENVIRONMENTAL_STUDIES: 'environmental-studies',
  GENERAL_KNOWLEDGE: 'general-knowledge',
  REASONING: 'reasoning',
  QUANTITATIVE_APTITUDE: 'quantitative-aptitude',
  CURRENT_AFFAIRS: 'current-affairs',
} as const;

export type SubjectSlug = (typeof SUBJECTS)[keyof typeof SUBJECTS];

const ALL_SCHOOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SENIOR = [11, 12] as const;

export const SUBJECT_SEEDS: readonly SubjectSeed[] = [
  { slug: SUBJECTS.ENGLISH, name: 'English', educationLevel: 'SCHOOL', classOrders: [...ALL_SCHOOL, ...SENIOR] },
  { slug: SUBJECTS.HINDI, name: 'Hindi', educationLevel: 'SCHOOL', classOrders: [...ALL_SCHOOL, ...SENIOR] },
  { slug: SUBJECTS.MATHEMATICS, name: 'Mathematics', educationLevel: 'SCHOOL', classOrders: [...ALL_SCHOOL, ...SENIOR] },
  { slug: SUBJECTS.ENVIRONMENTAL_STUDIES, name: 'Environmental Studies', educationLevel: 'SCHOOL', classOrders: [1, 2, 3, 4, 5] },
  { slug: SUBJECTS.SCIENCE, name: 'Science', educationLevel: 'SCHOOL', classOrders: [6, 7, 8, 9, 10] },
  { slug: SUBJECTS.SOCIAL_SCIENCE, name: 'Social Science', educationLevel: 'SCHOOL', classOrders: [6, 7, 8, 9, 10] },
  { slug: SUBJECTS.SANSKRIT, name: 'Sanskrit', educationLevel: 'SCHOOL', classOrders: [6, 7, 8, 9, 10] },
  { slug: SUBJECTS.COMPUTER_SCIENCE, name: 'Computer Science', educationLevel: 'SCHOOL', classOrders: [9, 10, 11, 12], streams: ['SCIENCE', 'COMMERCE'] },

  { slug: SUBJECTS.PHYSICS, name: 'Physics', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['SCIENCE'] },
  { slug: SUBJECTS.CHEMISTRY, name: 'Chemistry', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['SCIENCE'] },
  { slug: SUBJECTS.BIOLOGY, name: 'Biology', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['SCIENCE'] },

  { slug: SUBJECTS.ACCOUNTANCY, name: 'Accountancy', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['COMMERCE'] },
  { slug: SUBJECTS.BUSINESS_STUDIES, name: 'Business Studies', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['COMMERCE'] },
  { slug: SUBJECTS.ECONOMICS, name: 'Economics', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['COMMERCE', 'ARTS'] },
  { slug: SUBJECTS.INFORMATICS_PRACTICES, name: 'Informatics Practices', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['COMMERCE'] },

  { slug: SUBJECTS.HISTORY, name: 'History', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['ARTS'] },
  { slug: SUBJECTS.GEOGRAPHY, name: 'Geography', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['ARTS'] },
  { slug: SUBJECTS.POLITICAL_SCIENCE, name: 'Political Science', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['ARTS'] },
  { slug: SUBJECTS.PSYCHOLOGY, name: 'Psychology', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['ARTS', 'SCIENCE'] },
  { slug: SUBJECTS.SOCIOLOGY, name: 'Sociology', educationLevel: 'SCHOOL', classOrders: [...SENIOR], streams: ['ARTS'] },
  { slug: SUBJECTS.PHYSICAL_EDUCATION, name: 'Physical Education', educationLevel: 'SCHOOL', classOrders: [...SENIOR] },

  // Competitive-exam subjects — not tied to a class.
  { slug: SUBJECTS.GENERAL_KNOWLEDGE, name: 'General Knowledge', educationLevel: 'CERTIFICATE', classOrders: [] },
  { slug: SUBJECTS.REASONING, name: 'Reasoning', educationLevel: 'CERTIFICATE', classOrders: [] },
  { slug: SUBJECTS.QUANTITATIVE_APTITUDE, name: 'Quantitative Aptitude', educationLevel: 'CERTIFICATE', classOrders: [] },
  { slug: SUBJECTS.CURRENT_AFFAIRS, name: 'Current Affairs', educationLevel: 'CERTIFICATE', classOrders: [] },
];

/** Subjects offered for a given class + stream. Used by the seeder to build BoardClassSubject rows. */
export function subjectsForClass(
  classOrder: number,
  stream?: StreamType | null,
): readonly SubjectSeed[] {
  return SUBJECT_SEEDS.filter((s) => {
    if (!s.classOrders.includes(classOrder)) return false;
    if (!s.streams) return true;
    if (!stream) return false;
    return s.streams.includes(stream);
  });
}
