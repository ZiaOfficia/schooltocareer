import type { OwnerType } from '@stc/types';

/**
 * The URL map. Every path in the product is built here — never by string
 * concatenation at a call site. This file is the reason a slug rename can
 * generate correct redirects for all of an entity's sub-pages automatically.
 */

export const ROUTES = {
  home: () => '/',
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : '/search'),

  boards: () => '/boards',
  board: (board: string) => `/board/${board}`,
  boardClass: (board: string, cls: string) => `/board/${board}/${cls}`,
  boardSubject: (board: string, cls: string, subject: string) =>
    `/board/${board}/${cls}/${subject}`,
  boardChapter: (board: string, cls: string, subject: string, chapter: string) =>
    `/board/${board}/${cls}/${subject}/${chapter}`,
  boardSyllabus: (board: string, cls: string) => `/board/${board}/${cls}/syllabus`,
  boardPapers: (board: string, cls: string) => `/board/${board}/${cls}/previous-year-papers`,

  exams: () => '/exams',
  examCategory: (category: string) => `/exams/${category}`,
  exam: (exam: string) => `/exam/${exam}`,
  examSyllabus: (exam: string) => `/exam/${exam}/syllabus`,
  examPattern: (exam: string) => `/exam/${exam}/exam-pattern`,
  examEligibility: (exam: string) => `/exam/${exam}/eligibility`,
  examApplication: (exam: string) => `/exam/${exam}/application-form`,
  examAdmitCard: (exam: string) => `/exam/${exam}/admit-card`,
  examAnswerKey: (exam: string) => `/exam/${exam}/answer-key`,
  examResult: (exam: string) => `/exam/${exam}/result`,
  examPapers: (exam: string) => `/exam/${exam}/previous-year-papers`,
  examPapersByYear: (exam: string, year: number) =>
    `/exam/${exam}/previous-year-papers/${year}`,

  papers: () => '/previous-year-papers',
  paper: (paper: string) => `/previous-year-papers/${paper}`,

  results: () => '/results',
  result: (result: string) => `/results/${result}`,

  blog: () => '/blog',
  blogCategory: (category: string) => `/blog/${category}`,
  blogPost: (category: string, post: string) => `/blog/${category}/${post}`,

  news: () => '/news',
  newsCategory: (category: string) => `/news/${category}`,
  newsArticle: (category: string, article: string) => `/news/${category}/${article}`,

  author: (author: string) => `/author/${author}`,

  about: () => '/about',
  contact: () => '/contact',
  privacy: () => '/privacy-policy',
  terms: () => '/terms-and-conditions',
  disclaimer: () => '/disclaimer',

  login: () => '/login',
} as const;

/**
 * Path TEMPLATES per entity, with `:slug` placeholders.
 *
 * Used by the redirect generator: renaming an exam expands these into one
 * Redirect row per template. Adding a new sub-page here automatically extends
 * redirect coverage for every rename that already happened.
 *
 * Deferred entity kinds are present but empty so Phase 2 fills them in rather
 * than restructuring this map.
 */
export const ENTITY_PATH_TEMPLATES: Partial<Record<OwnerType, readonly string[]>> = {
  EXAM: [
    '/exam/:slug',
    '/exam/:slug/syllabus',
    '/exam/:slug/exam-pattern',
    '/exam/:slug/eligibility',
    '/exam/:slug/application-form',
    '/exam/:slug/admit-card',
    '/exam/:slug/answer-key',
    '/exam/:slug/result',
    '/exam/:slug/previous-year-papers',
  ],
  BOARD: ['/board/:slug', '/board/:slug/syllabus', '/board/:slug/results'],
  BOARD_CLASS: ['/board/:parentSlug/:slug', '/board/:parentSlug/:slug/syllabus'],
  QUESTION_PAPER: ['/previous-year-papers/:slug'],
  RESULT: ['/results/:slug'],
  CATEGORY: ['/blog/:slug', '/news/:slug'],
  CONTENT_ENTRY: [],
} as const;

/**
 * Slugs that would collide with a route segment or a framework path. Checked
 * during slug generation — a board slugged "admin" would shadow the admin app.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'login',
  'logout',
  'register',
  'search',
  'sitemap',
  'sitemap.xml',
  'robots.txt',
  'rss',
  'feed',
  'static',
  'assets',
  'images',
  'public',
  '_next',
  '_vercel',
  'favicon.ico',
  'about',
  'contact',
  'privacy-policy',
  'terms-and-conditions',
  'disclaimer',
  'author',
  'tag',
  'category',
  'page',
  'null',
  'undefined',
  'new',
  'edit',
  'delete',
]);

/** API version prefix. Bumping this is how a breaking API change ships. */
export const API_PREFIX = '/api/v1' as const;

export const API_ROUTES = {
  exams: `${API_PREFIX}/exams`,
  exam: (slug: string) => `${API_PREFIX}/exams/${slug}`,
  boards: `${API_PREFIX}/boards`,
  board: (slug: string) => `${API_PREFIX}/boards/${slug}`,
  papers: `${API_PREFIX}/question-papers`,
  results: `${API_PREFIX}/results`,
  /** The blog module is mounted at /posts. `content` was wrong and 404'd, which
   *  the web client swallowed into an empty list — /blog rendered its empty
   *  state on a database holding 300 posts. */
  posts: `${API_PREFIX}/posts`,
  categories: `${API_PREFIX}/categories`,
  media: `${API_PREFIX}/media`,
  search: `${API_PREFIX}/search`,
  auth: `${API_PREFIX}/auth`,
  health: '/health',
} as const;
