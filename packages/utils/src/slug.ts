import { RESERVED_SLUGS, SEO_LIMITS } from '@stc/constants';

/**
 * Slug generation. Pure functions only — uniqueness is the database's job via
 * the unique constraint; these helpers just produce good candidates.
 */

const DIACRITIC_RE = /[̀-ͯ]/g;
const NON_SLUG_RE = /[^a-z0-9\s-]/g;
const WHITESPACE_RE = /[\s_]+/g;
const MULTI_HYPHEN_RE = /-{2,}/g;
const TRIM_HYPHEN_RE = /^-+|-+$/g;

/** Words dropped from slugs — they add length without adding search value. */
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'in', 'on', 'to']);

export function slugify(input: string, options: { keepStopWords?: boolean } = {}): string {
  const base = input
    .normalize('NFD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(NON_SLUG_RE, ' ')
    .replace(WHITESPACE_RE, '-')
    .replace(MULTI_HYPHEN_RE, '-')
    .replace(TRIM_HYPHEN_RE, '');

  const parts = base.split('-').filter(Boolean);
  const filtered =
    options.keepStopWords || parts.length <= 3
      ? parts
      : parts.filter((p, i) => i === 0 || !STOP_WORDS.has(p));

  return truncateSlug(filtered.join('-'));
}

/** Truncates on a word boundary so slugs never end mid-word. */
export function truncateSlug(slug: string, max = SEO_LIMITS.SLUG_MAX): string {
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const lastHyphen = cut.lastIndexOf('-');
  return (lastHyphen > max * 0.6 ? cut.slice(0, lastHyphen) : cut).replace(TRIM_HYPHEN_RE, '');
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= SEO_LIMITS.SLUG_MAX;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Candidate slugs in priority order. Prefer a domain-meaningful discriminator
 * over a numeric one: `jee-main-2026` tells a user and a crawler something;
 * `jee-main-2` tells them nothing.
 */
export function slugCandidates(
  base: string,
  hints: { year?: number; qualifier?: string } = {},
): string[] {
  const root = slugify(base);
  const out = [root];
  if (hints.qualifier) out.push(slugify(`${base} ${hints.qualifier}`));
  if (hints.year) out.push(slugify(`${base} ${hints.year}`));
  for (let i = 2; i <= 6; i++) out.push(truncateSlug(`${root}-${i}`));
  return [...new Set(out)];
}

const TOMBSTONE_RE = /__d\d{10,}$/;

/**
 * Frees a slug on soft delete while preserving recoverability. Keeping the
 * plain `@unique` (rather than a partial index) is what lets `findUnique` and
 * `upsert` keep working across the codebase — see packages/database/README.md.
 */
export function tombstoneSlug(slug: string, at: Date = new Date()): string {
  const suffix = `__d${Math.floor(at.getTime() / 1000)}`;
  const room = SEO_LIMITS.SLUG_MAX - suffix.length;
  return `${slug.slice(0, Math.max(1, room))}${suffix}`;
}

export function isTombstoned(slug: string): boolean {
  return TOMBSTONE_RE.test(slug);
}

export function untombstoneSlug(slug: string): string {
  return slug.replace(TOMBSTONE_RE, '');
}

/**
 * Deterministic dedupe key for question papers. Nulls become an explicit '-'
 * because PostgreSQL treats NULLs as distinct in a unique constraint, which
 * would let bulk imports insert the same paper repeatedly.
 */
export function buildPaperDedupeKey(parts: {
  examSlug?: string | null;
  boardSlug?: string | null;
  classSlug?: string | null;
  subjectSlug?: string | null;
  year: number;
  shift?: string | null;
  setCode?: string | null;
  locale: string;
  paperType: string;
}): string {
  const norm = (v: string | number | null | undefined): string =>
    v === null || v === undefined || v === '' ? '-' : slugify(String(v)) || '-';

  return [
    norm(parts.examSlug),
    norm(parts.boardSlug),
    norm(parts.classSlug),
    norm(parts.subjectSlug),
    parts.year,
    norm(parts.shift),
    norm(parts.setCode),
    parts.locale,
    parts.paperType,
  ].join('|');
}
