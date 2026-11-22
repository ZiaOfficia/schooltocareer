/**
 * Questions a chapter page needs before it is worth a search result of its
 * own (PRINCIPLES.md #6). Below it the page renders but is noindex.
 *
 * Shared by the chapter route, which sets `noindex` from it, and the sitemap,
 * which lists only the chapters that pass it — so the two cannot disagree.
 */
export const CHAPTER_INDEX_THRESHOLD = 15;
