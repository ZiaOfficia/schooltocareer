import Image from 'next/image';
import Link from 'next/link';

import { ROUTES, SITE } from '@stc/constants';
import { Section, Wrap } from '@stc/ui';

import { PageHero } from '@/components/page-hero';
import {
  ARTICLES,
  ARTICLE_CATEGORIES,
  articleImageUrl,
  articlePath,
  readingMinutes,
  type ArticleCategory,
} from '@/lib/articles';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { LIVE } from '@/lib/site-sections';

/**
 * The article index. It lists the articles kept in the repo (lib/articles).
 *
 * It used to list posts from the API, but no route renders an API post: every
 * link it produced was a 404. Those posts stay out until a post page exists
 * and their content has been reviewed.
 */

export function generateMetadata() {
  return buildMetadata({
    template: 'search',
    values: { siteName: SITE.NAME },
    path: ROUTES.blog(),
    title: 'Articles: Board Exam and Entrance Exam Preparation',
    description:
      'Preparation articles for CBSE, UP Board, ICSE and ISC board exams and for JEE Advanced, CLAT and NDA, built on the official syllabus and paper pattern.',
    noindex: !LIVE.blog || ARTICLES.length === 0,
  });
}

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export default function BlogIndex() {
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Articles', path: ROUTES.blog() },
  ];
  const categories = Object.keys(ARTICLE_CATEGORIES) as ArticleCategory[];

  return (
    <>
      <JsonLd data={breadcrumbSchema(trail)} />
      <PageHero
        trail={trail}
        title="Articles"
        lede="How to prepare for board exams and entrance exams, chapter by chapter. Every fact comes from the official syllabus, paper pattern or notice, and each article links to the full guide it is built on."
      />
      <Wrap>
        {categories.map((category) => {
          const items = ARTICLES.filter((a) => a.category === category);
          if (items.length === 0) return null;
          return (
            <Section key={category} title={ARTICLE_CATEGORIES[category]} major>
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((article) => (
                  <li key={article.slug} className="card overflow-hidden">
                    <Link href={articlePath(article)} className="group block">
                      <Image
                        src={articleImageUrl(article, 800)}
                        alt={article.image.alt}
                        width={800}
                        height={420}
                        className="aspect-[40/21] w-full object-cover"
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      />
                      <div className="p-5">
                        <h3 className="text-[17px] font-semibold leading-snug text-ink group-hover:underline">
                          {article.h1}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-[14.5px] text-ink-soft">
                          {article.description}
                        </p>
                        <p className="mt-3 font-data text-[12px] text-ink-mute">
                          {DATE.format(new Date(article.updatedAt))} · {readingMinutes(article)} min
                          read
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
      </Wrap>
    </>
  );
}
