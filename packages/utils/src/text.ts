import { SEO_LIMITS } from '@stc/constants';

const TAG_RE = /<[^>]*>/g;
const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(TAG_RE, ' ')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITY_MAP[m.toLowerCase()] ?? ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function wordCount(text: string): number {
  const plain = stripHtml(text);
  return plain ? plain.split(/\s+/).length : 0;
}

/** 200 wpm is the usual reading speed for informational content. */
export function readingMinutes(html: string, wordsPerMinute = 200): number {
  return Math.max(1, Math.ceil(wordCount(html) / wordsPerMinute));
}

/** Truncates on a word boundary and appends an ellipsis only if it cut. */
export function truncate(text: string, max: number, suffix = '…'): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - suffix.length);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}${suffix}`;
}

/**
 * `max: number` is annotated explicitly. Inferring it from
 * `SEO_LIMITS.DESCRIPTION_MAX` narrows the parameter to the literal type `160`,
 * so any other value becomes a compile error at the call site — a genuinely
 * confusing failure that `as const` objects cause more often than expected.
 */
export function buildExcerpt(html: string, max: number = SEO_LIMITS.DESCRIPTION_MAX): string {
  return truncate(stripHtml(html), max);
}

/** Fits a meta description into the SERP window without cutting mid-word. */
export function normalizeMetaDescription(input: string): string {
  return truncate(stripHtml(input), SEO_LIMITS.DESCRIPTION_MAX, '');
}

export function normalizeMetaTitle(input: string): string {
  return truncate(input.trim(), SEO_LIMITS.TITLE_MAX, '');
}

/** Normalises a search query for logging and synonym lookup. */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function titleCase(input: string): string {
  return input.replace(/\w\S*/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}

/** Heading id for the table of contents and anchor links. */
export function headingId(text: string): string {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
}
