import type { SchoolStage, StreamType } from '@stc/types';

/**
 * Class levels 1–12. `order` doubles as the class number and as the sort key
 * (ClassLevel.order is @unique in the schema).
 */

export type ClassLevelSeed = {
  readonly slug: string;
  readonly name: string;
  readonly order: number;
  readonly stage: SchoolStage;
};

export const CLASS_LEVELS: readonly ClassLevelSeed[] = [
  { slug: 'class-1', name: 'Class 1', order: 1, stage: 'PRIMARY' },
  { slug: 'class-2', name: 'Class 2', order: 2, stage: 'PRIMARY' },
  { slug: 'class-3', name: 'Class 3', order: 3, stage: 'PRIMARY' },
  { slug: 'class-4', name: 'Class 4', order: 4, stage: 'PRIMARY' },
  { slug: 'class-5', name: 'Class 5', order: 5, stage: 'PRIMARY' },
  { slug: 'class-6', name: 'Class 6', order: 6, stage: 'MIDDLE' },
  { slug: 'class-7', name: 'Class 7', order: 7, stage: 'MIDDLE' },
  { slug: 'class-8', name: 'Class 8', order: 8, stage: 'MIDDLE' },
  { slug: 'class-9', name: 'Class 9', order: 9, stage: 'SECONDARY' },
  { slug: 'class-10', name: 'Class 10', order: 10, stage: 'SECONDARY' },
  { slug: 'class-11', name: 'Class 11', order: 11, stage: 'SENIOR_SECONDARY' },
  { slug: 'class-12', name: 'Class 12', order: 12, stage: 'SENIOR_SECONDARY' },
];

/** Streams apply only to Class 11 and 12. */
export const STREAM_CLASS_ORDERS: readonly number[] = [11, 12];

export const STREAMS: readonly { value: StreamType; label: string; slugPart: string }[] = [
  { value: 'SCIENCE', label: 'Science', slugPart: 'science' },
  { value: 'COMMERCE', label: 'Commerce', slugPart: 'commerce' },
  { value: 'ARTS', label: 'Arts', slugPart: 'arts' },
  { value: 'VOCATIONAL', label: 'Vocational', slugPart: 'vocational' },
];

export const STAGE_LABELS: Record<SchoolStage, string> = {
  PRIMARY: 'Primary (Class 1–5)',
  MIDDLE: 'Middle (Class 6–8)',
  SECONDARY: 'Secondary (Class 9–10)',
  SENIOR_SECONDARY: 'Senior Secondary (Class 11–12)',
};

/**
 * Builds the BoardClass slug. Class 12 Science is `class-12-science`;
 * Class 10 has no stream and is just `class-10`.
 */
export function buildBoardClassSlug(classOrder: number, stream?: StreamType | null): string {
  const base = `class-${classOrder}`;
  if (!stream) return base;
  const found = STREAMS.find((s) => s.value === stream);
  return found ? `${base}-${found.slugPart}` : base;
}

/** Classes that carry the bulk of search demand — prebuilt at deploy time. */
export const HIGH_TRAFFIC_CLASS_ORDERS: readonly number[] = [9, 10, 11, 12];
