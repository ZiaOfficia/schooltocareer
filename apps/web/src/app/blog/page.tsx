import { ROUTES, SITE } from '@stc/constants';
import type { PostListItemDto } from '@stc/types';

import { IndexPage, type IndexItem } from '@/components/index-page';
import { ApiError, listPosts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.blog(),
    title: 'Articles: Exam Strategy, Preparation & Guides',
    description:
      'Preparation strategy, subject guides and exam analysis for Indian entrance exams and school boards. Written to be useful, not to fill a keyword.',
  });
}

export default async function BlogIndex() {
  let posts: PostListItemDto[] = [];
  let failed = false;
  try {
    posts = await listPosts<PostListItemDto>('limit=60&sort=publishedAt&dir=desc');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    failed = true;
    console.error(`[blog] list request failed`, error);
  }

  const items: IndexItem[] = posts.map((post) => ({
    href: post.path,
    title: post.title,
    meta: post.category?.name ?? null,
    aside: post.readingMinutes ? `${post.readingMinutes} min` : null,
  }));

  return (
    <IndexPage
      kind="article"
      title="Articles"
      // The URL stays /blog because it is what the route map has always used;
      // the word shown to a reader is "Articles", everywhere, without exception.
      lede="Strategy, subject guides and exam analysis. Each one exists to answer a question a student actually asked."
      items={items}
      unit="articles"
      failed={failed}
      emptyNote="No articles have been published yet."
    />
  );
}
