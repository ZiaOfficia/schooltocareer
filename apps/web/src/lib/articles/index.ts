import { ROUTES } from '@stc/constants';

import { cbseClass10Article } from './cbse-class-10-score-90';
import { cbseClass12Article } from './cbse-class-12-weightage';
import { clatArticle } from './clat-2027-last-two-weeks';
import { icseClass10Article } from './icse-class-10-no-weightage';
import { iscClass12Article } from './isc-class-12-weightage';
import { jeeAdvancedArticle } from './jee-advanced-2027-preparation';
import { ndaArticle } from './nda-2027-preparation';
import type { Article, ArticleCategory } from './types';
import { upBoardClass10Article } from './up-board-class-10-pass-and-score';
import { upBoardClass12Article } from './up-board-class-12-weightage';

export type { Article, ArticleBlock, ArticleCategory, ArticleImage } from './types';

export const ARTICLE_CATEGORIES: Record<ArticleCategory, string> = {
  'board-exams': 'Board exams',
  'entrance-exams': 'Entrance exams',
};

/** Newest first; ties keep the order written here. */
export const ARTICLES: readonly Article[] = [
  clatArticle,
  cbseClass10Article,
  cbseClass12Article,
  upBoardClass10Article,
  upBoardClass12Article,
  icseClass10Article,
  iscClass12Article,
  jeeAdvancedArticle,
  ndaArticle,
].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function articlePath(article: Pick<Article, 'category' | 'slug'>): string {
  return ROUTES.blogPost(article.category, article.slug);
}

export function getArticle(category: string, slug: string): Article | null {
  return ARTICLES.find((a) => a.category === category && a.slug === slug) ?? null;
}

/** Articles built on a given guide page, for the "Read next" links on that page. */
export function articlesForGuide(href: string): Article[] {
  return ARTICLES.filter((a) => a.guide.href === href);
}

/** A cropped 1200×630 image, the size Open Graph and the article header both use. */
export function articleImageUrl(article: Article, width = 1200): string {
  const height = Math.round((width * 630) / 1200);
  return `https://images.unsplash.com/${article.image.id}?auto=format&fit=crop&w=${width}&h=${height}&q=75`;
}

/** Unsplash asks that credit links carry these parameters. */
export function unsplashLink(path: string): string {
  return `https://unsplash.com/${path}?utm_source=schooltocareer&utm_medium=referral`;
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function articleWords(article: Article): number {
  let total = words(article.description);
  for (const block of article.blocks) {
    if (block.kind === 'ul' || block.kind === 'ol')
      total += block.items.reduce((n, i) => n + words(i), 0);
    else if (block.kind === 'table')
      total += block.rows.reduce((n, row) => n + row.reduce((m, cell) => m + words(cell), 0), 0);
    else total += words(block.text);
  }
  for (const faq of article.faqs) total += words(faq.question) + words(faq.answer);
  return total;
}

export function readingMinutes(article: Article): number {
  return Math.max(1, Math.round(articleWords(article) / 200));
}
