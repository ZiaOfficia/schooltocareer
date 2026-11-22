/**
 * An article on /blog/<category>/<slug>.
 *
 * Articles live in the repo, like the board guides and the exam pattern pages:
 * each fact in one is taken from a page that already names its official
 * source, and the article links back to that page. A change is reviewed in a
 * pull request, not typed into a database.
 *
 * Inline text in `p`, `ul`, `ol` and `tip` blocks may contain [label](href)
 * links and **bold** — nothing else. See components/article-body.tsx.
 */

export type ArticleCategory = 'board-exams' | 'entrance-exams';

export type ArticleBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: readonly string[] }
  | { kind: 'ol'; items: readonly string[] }
  | {
      kind: 'table';
      caption: string;
      head: readonly string[];
      rows: ReadonlyArray<readonly string[]>;
    }
  | { kind: 'tip'; text: string };

/**
 * A free-licence photo from Unsplash (unsplash.com/license): free to use,
 * including commercially, with no permission needed. Unsplash+ photos are
 * NOT free and must never be used here. Credit is given anyway.
 */
export type ArticleImage = {
  /** The path on images.unsplash.com, e.g. `photo-1606326608606-aa0b62935f2b`. */
  id: string;
  alt: string;
  photographer: string;
  /** Unsplash username, without the @. */
  username: string;
  /** The photo page slug on unsplash.com/photos/. */
  photo: string;
};

export type Article = {
  slug: string;
  category: ArticleCategory;
  /** The <title>. The layout appends " | SchoolToCareer". */
  title: string;
  /** The on-page heading. */
  h1: string;
  description: string;
  /** ISO dates (YYYY-MM-DD). */
  publishedAt: string;
  updatedAt: string;
  image: ArticleImage;
  /** The guide this article is built on. Every article links to one. */
  guide: { label: string; href: string };
  blocks: readonly ArticleBlock[];
  faqs: ReadonlyArray<{ question: string; answer: string }>;
  /** The official documents behind the facts, as the guide names them. */
  sources: ReadonlyArray<{ name: string; url: string }>;
};
