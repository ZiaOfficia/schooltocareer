/**
 * SEO defaults and hard limits.
 *
 * The truncation limits are not style preferences — exceeding them means
 * Google rewrites your title or truncates your description in the SERP, which
 * measurably costs click-through.
 */

export const SEO_LIMITS = {
  TITLE_MIN: 30,
  TITLE_MAX: 60,
  DESCRIPTION_MIN: 70,
  DESCRIPTION_MAX: 160,
  OG_TITLE_MAX: 90,
  OG_DESCRIPTION_MAX: 200,
  SLUG_MAX: 96,
  H1_MAX: 70,
} as const;

export const ROBOTS = {
  INDEX_FOLLOW: 'index, follow',
  NOINDEX_FOLLOW: 'noindex, follow',
  NOINDEX_NOFOLLOW: 'noindex, nofollow',
  /** Blocks the SERP text snippet but still allows indexing. */
  MAX_SNIPPET: 'max-snippet:-1, max-image-preview:large, max-video-preview:-1',
} as const;

/**
 * Paths never served to crawlers. Consumed by robots.ts and by the
 * `noindex` decision in generateMetadata.
 */
export const NOINDEX_PATHS: readonly string[] = [
  '/search',
  '/login',
  '/api',
  '/admin',
  '/thank-you',
  '/404',
  '/500',
];

export const SITEMAP_SEGMENTS = [
  'static',
  'boards',
  'exams',
  'papers',
  'results',
  'blog',
  'news',
  'notes',
] as const;
export type SitemapSegment = (typeof SITEMAP_SEGMENTS)[number];

/** Per-segment sitemap priority and change frequency. */
export const SITEMAP_CONFIG: Record<
  SitemapSegment,
  { priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' }
> = {
  static: { priority: 0.3, changeFrequency: 'yearly' },
  boards: { priority: 0.9, changeFrequency: 'weekly' },
  exams: { priority: 1.0, changeFrequency: 'daily' },
  papers: { priority: 0.7, changeFrequency: 'monthly' },
  results: { priority: 0.9, changeFrequency: 'daily' },
  blog: { priority: 0.6, changeFrequency: 'weekly' },
  news: { priority: 0.8, changeFrequency: 'daily' },
  notes: { priority: 0.7, changeFrequency: 'monthly' },
};

/** schema.org @type values used across the site. */
export const SCHEMA_TYPES = {
  ORGANIZATION: 'Organization',
  WEBSITE: 'WebSite',
  BREADCRUMB: 'BreadcrumbList',
  ARTICLE: 'Article',
  NEWS_ARTICLE: 'NewsArticle',
  BLOG_POSTING: 'BlogPosting',
  FAQ_PAGE: 'FAQPage',
  QUESTION: 'Question',
  ANSWER: 'Answer',
  COURSE: 'Course',
  EDUCATIONAL_ORGANIZATION: 'EducationalOrganization',
  EVENT: 'Event',
  ITEM_LIST: 'ItemList',
  COLLECTION_PAGE: 'CollectionPage',
  DATASET: 'Dataset',
  PERSON: 'Person',
} as const;

export const OG_IMAGE = {
  WIDTH: 1200,
  HEIGHT: 630,
  TYPE: 'image/png',
} as const;

/** AdSense placement slots. Keys, not raw slot ids — ids live in env. */
export const AD_SLOTS = {
  HEADER: 'header',
  IN_ARTICLE_1: 'in-article-1',
  IN_ARTICLE_2: 'in-article-2',
  SIDEBAR_TOP: 'sidebar-top',
  SIDEBAR_STICKY: 'sidebar-sticky',
  FOOTER: 'footer',
  LIST_INLINE: 'list-inline',
} as const;

/**
 * Indexability is a SCORE, not a word-count gate.
 *
 * A hard `words < 300 → noindex` rule would deindex the pages that convert
 * best: a result page is a table with 120 words of prose, a scholarship page is
 * legitimately concise, a glossary entry is short by definition. Word count is
 * one signal among several, and an editor can always override.
 */
export const PAGE_KIND = [
  'ARTICLE',
  'NEWS',
  'NOTE',
  'SYLLABUS',
  'EXAM_HUB',
  'EXAM_SUBPAGE',
  'BOARD_HUB',
  'RESULT',
  'PAPER',
  'LISTING',
  'GLOSSARY',
  'STATIC',
] as const;
export type PageKind = (typeof PAGE_KIND)[number];

/**
 * Per-kind word floors. Structured page kinds sit low because their value is
 * in the data, not the prose. Editorial kinds sit high because a 200-word
 * "article" genuinely is thin.
 */
export const WORD_COUNT_FLOOR: Record<PageKind, number> = {
  ARTICLE: 600,
  NEWS: 250,
  NOTE: 400,
  SYLLABUS: 250,
  EXAM_HUB: 400,
  EXAM_SUBPAGE: 200,
  BOARD_HUB: 300,
  RESULT: 120,
  PAPER: 80,
  LISTING: 100,
  GLOSSARY: 60,
  STATIC: 100,
};

/** Signal weights. They sum to 100 so the score reads as a percentage. */
export const INDEXABILITY_WEIGHTS = {
  /** Body length relative to this page kind's floor. */
  WORD_COUNT: 30,
  /** Valid JSON-LD present (FAQPage, Article, Event, Dataset...). */
  STRUCTURED_DATA: 20,
  /** Required fields for this page kind are populated. */
  COMPLETENESS: 30,
  /** How much of the page is not boilerplate shared with sibling pages. */
  UNIQUENESS: 20,
} as const;

/** Score at or above this is indexable. Below it, the page is `noindex, follow`. */
export const INDEXABILITY_THRESHOLD = 60;

/**
 * Fields that must be populated for a page kind to count as complete.
 * Missing fields are what the admin's "not ready to index" list reports.
 */
export const REQUIRED_FIELDS: Record<PageKind, readonly string[]> = {
  ARTICLE: ['title', 'excerpt', 'bodyHtml', 'featuredImageId', 'categoryId', 'authorId'],
  NEWS: ['title', 'excerpt', 'bodyHtml', 'publishedAt'],
  NOTE: ['title', 'bodyHtml', 'chapterId'],
  SYLLABUS: ['title', 'bodyHtml'],
  EXAM_HUB: ['name', 'conductingBody', 'overview', 'level', 'mode'],
  EXAM_SUBPAGE: ['title', 'bodyHtml'],
  BOARD_HUB: ['name', 'shortName', 'description'],
  RESULT: ['title', 'year', 'resultType', 'officialUrl'],
  PAPER: ['title', 'year', 'paperType'],
  LISTING: ['title'],
  GLOSSARY: ['title', 'bodyHtml'],
  STATIC: ['title', 'bodyHtml'],
};

/**
 * Editor override. `AUTO` is the default and lets the score decide.
 * An explicit override is always logged to AuditLog — forcing a thin page into
 * the index is a decision someone should own.
 */
export const INDEX_OVERRIDE = ['AUTO', 'FORCE_INDEX', 'FORCE_NOINDEX'] as const;
export type IndexOverride = (typeof INDEX_OVERRIDE)[number];

/**
 * Below this, no override can save the page — an empty page in the sitemap is
 * a crawl-budget leak regardless of who insists.
 */
export const ABSOLUTE_MIN_WORD_COUNT = 40;
