/**
 * Title/description templates. Every page title in the product is produced
 * here, so a sitewide format change is one edit rather than 40.
 *
 * `{year}` is substituted at render time — "JEE Main Syllabus 2026" outranks
 * "JEE Main Syllabus" for the query people actually type, and it must never be
 * hardcoded into content.
 */

export const SITE = {
  NAME: 'SchoolToCareer',
  SHORT_NAME: 'STC',
  TAGLINE: 'Exams, Boards, Papers & Careers — all in one place',
  DEFAULT_LOCALE: 'en_IN',
  TWITTER_HANDLE: '@schooltocareer',

  /**
   * THE canonical origin. Apex, no `www`, no trailing slash.
   *
   * Every absolute URL the site emits derives from this one constant —
   * canonical tags, sitemap entries, the robots.txt sitemap line, og:url,
   * JSON-LD @id values, and the IndexNow keyLocation. Spreading the domain
   * across eight env vars is how a site ends up with canonicals pointing at a
   * host it does not own, and that is close to unrecoverable once indexed.
   *
   * `www` is a permanent 301 to this. Serving both is duplicate content, and
   * switching later costs a full re-crawl.
   */
  ORIGIN: 'https://schooltocareer.in',

  /** `.in` is a ccTLD, so India geo-targeting is implicit and cannot be overridden. */
  COUNTRY: 'IN',
} as const;

/** Absolute URL from a site-relative path. The only way to build one. */
export function absoluteUrl(path: string, origin: string = SITE.ORIGIN): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${origin.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/$/, '') || origin;
}

export const TITLE_TEMPLATE = {
  DEFAULT: `%s | ${SITE.NAME}`,
  HOME: `${SITE.NAME} — ${SITE.TAGLINE}`,
} as const;

export const META_TEMPLATES = {
  exam: {
    title: '{name} {year}: Dates, Syllabus, Pattern, Eligibility & Result',
    description:
      '{name} {year} — check exam dates, eligibility, syllabus, exam pattern, admit card, answer key and result. Complete {shortName} guide by {siteName}.',
  },
  examSyllabus: {
    title: '{name} Syllabus {year}: Subject-wise Topics & Weightage',
    description:
      'Download the complete {name} {year} syllabus with subject-wise topics, marks weightage and preparation tips.',
  },
  examResult: {
    title: '{name} Result {year}: Date, Direct Link & How to Check',
    description:
      '{name} {year} result — declaration date, direct download link, scorecard details and step-by-step instructions to check your result.',
  },
  examPapers: {
    title: '{name} Previous Year Question Papers ({fromYear}-{toYear}) PDF Download',
    description:
      'Download {name} previous year question papers with solutions in PDF. Year-wise and shift-wise papers, free.',
  },
  board: {
    title: '{name} {year}: Syllabus, Date Sheet, Result & Question Papers',
    description:
      '{name} — syllabus, date sheet, previous year papers, sample papers and results for all classes. Updated for {year}.',
  },
  boardClass: {
    title: '{boardShortName} Class {classNumber} {year}: Syllabus, Papers & Notes',
    description:
      '{boardName} Class {classNumber} — subject-wise syllabus, chapter notes, previous year question papers and sample papers for {year}.',
  },
  subject: {
    title: '{boardShortName} Class {classNumber} {subject}: Syllabus, Notes & Papers',
    description:
      'Complete {subject} resources for {boardName} Class {classNumber} — chapter-wise notes, syllabus and previous year papers.',
  },
  chapter: {
    title: '{chapter} — {subject} Class {classNumber} Notes ({boardShortName})',
    description:
      '{chapter} notes for {boardShortName} Class {classNumber} {subject}. Key concepts, important questions and revision points.',
  },
  paper: {
    title: '{title} PDF Download with Solutions',
    description:
      'Download {title} in PDF. Includes the question paper{withSolution} — free and printable.',
  },
  result: {
    title: '{title}: Direct Link, Date & How to Check',
    description:
      '{title} — declaration date, direct link, statistics and step-by-step instructions to download your scorecard.',
  },
  blogPost: {
    title: '{title}',
    description: '{excerpt}',
  },
  category: {
    title: '{name} — Latest Articles & Updates',
    description: 'Latest {name} articles, guides and updates from {siteName}.',
  },
  search: {
    title: 'Search results for "{query}"',
    description: 'Search exams, boards, question papers and articles on {siteName}.',
  },
} as const;

export type MetaTemplateKey = keyof typeof META_TEMPLATES;

/**
 * Fills `{placeholder}` tokens. Unresolved tokens are stripped rather than
 * rendered literally — a title reading "JEE Main {year} Syllabus" in the SERP
 * is worse than one missing the year.
 */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) =>
      values[key] !== undefined ? String(values[key]) : '',
    )
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .trim();
}

export const BREADCRUMB_LABELS: Record<string, string> = {
  boards: 'Boards',
  board: 'Boards',
  exams: 'Exams',
  exam: 'Exams',
  'previous-year-papers': 'Previous Year Papers',
  results: 'Results',
  blog: 'Blog',
  news: 'News',
  syllabus: 'Syllabus',
  'exam-pattern': 'Exam Pattern',
  eligibility: 'Eligibility',
  'admit-card': 'Admit Card',
  'answer-key': 'Answer Key',
  result: 'Result',
  'application-form': 'Application Form',
};
