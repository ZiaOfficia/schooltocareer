import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, SITE } from '@stc/constants';
import { EntityBadge, LastUpdated, Section, TableOfContents, Wrap, contentsOf } from '@stc/ui';

import { AdSlot } from '@/components/ad-slot';
import { ArticleBody, groupBlocks } from '@/components/article-body';
import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/page-hero';
import {
  ARTICLES,
  ARTICLE_CATEGORIES,
  articleImageUrl,
  articlePath,
  getArticle,
  readingMinutes,
  unsplashLink,
} from '@/lib/articles';
import { JsonLd, articleSchema, breadcrumbSchema, faqSchema } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * One article from lib/articles. Every page is built at deploy time; any other
 * /blog/<category>/<slug> is a 404.
 */

export const dynamicParams = false;

type Params = { category: string; slug: string };

export function generateStaticParams(): Params[] {
  return ARTICLES.map((a) => ({ category: a.category, slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { category, slug } = await params;
  const article = getArticle(category, slug);
  if (!article) return {};
  return buildMetadata({
    template: 'blogPost',
    values: { title: article.title, excerpt: article.description, siteName: SITE.NAME },
    path: articlePath(article),
    title: article.title,
    description: article.description,
    image: { url: articleImageUrl(article), alt: article.image.alt },
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
  });
}

const FAQ_TITLE = 'Frequently asked questions';
const SOURCES_TITLE = 'Sources';

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { category, slug } = await params;
  const article = getArticle(category, slug);
  if (!article) notFound();

  const path = articlePath(article);
  const trail = [
    { name: 'Home', path: ROUTES.home() },
    { name: 'Articles', path: ROUTES.blog() },
    { name: article.h1, path },
  ];
  const headings = groupBlocks(article.blocks)
    .map((group) => group.title)
    .filter((title): title is string => title !== null);
  const contents = contentsOf([
    ...headings,
    article.faqs.length > 0 ? FAQ_TITLE : null,
    SOURCES_TITLE,
  ]);
  const more = ARTICLES.filter((a) => a !== article)
    .sort(
      (a, b) => Number(b.category === article.category) - Number(a.category === article.category),
    )
    .slice(0, 3);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema(trail),
          articleSchema({
            headline: article.h1,
            description: article.description,
            path,
            publishedTime: article.publishedAt,
            modifiedTime: article.updatedAt,
            authorName: `${SITE.NAME} Editorial`,
            imageUrl: articleImageUrl(article),
          }),
          ...(article.faqs.length > 0 ? [faqSchema(article.faqs)] : []),
        ]}
      />

      <PageHero
        trail={trail}
        badges={<EntityBadge kind="article" label={ARTICLE_CATEGORIES[article.category]} />}
        title={article.h1}
        lede={article.description}
        meta={
          <span className="flex flex-wrap gap-x-3">
            <LastUpdated iso={article.updatedAt} />
            <span className="font-data text-xs text-ink-mute">
              {readingMinutes(article)} min read
            </span>
          </span>
        }
      />

      <Wrap>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-x-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="min-w-0">
            <figure>
              <Image
                src={articleImageUrl(article)}
                alt={article.image.alt}
                width={1200}
                height={630}
                priority
                className="w-full rounded-[20px] object-cover shadow-[var(--shadow-card)]"
                sizes="(min-width: 1180px) 820px, 100vw"
              />
              <figcaption className="mt-2 text-[12.5px] text-ink-mute">
                Photo by{' '}
                <a
                  href={unsplashLink(`@${article.image.username}`)}
                  rel="noopener"
                  className="underline"
                >
                  {article.image.photographer}
                </a>{' '}
                on{' '}
                <a
                  href={unsplashLink(`photos/${article.image.photo}`)}
                  rel="noopener"
                  className="underline"
                >
                  Unsplash
                </a>
              </figcaption>
            </figure>

            <TableOfContents className="mt-8 lg:hidden" items={contents} />

            <div className="mt-8">
              <ArticleBody blocks={article.blocks} adAfterSection={2} />
            </div>

            <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <p className="max-w-[48ch] text-[15.5px] text-ink-soft">
                <span className="block font-bold text-ink">
                  Want every unit and official paper?
                </span>
                The full guide has the complete chapter list, answer tips and links to the
                board&rsquo;s or conducting body&rsquo;s own papers.
              </p>
              <Link href={article.guide.href} className="btn btn-primary">
                {article.guide.label}
                <ArrowRightIcon width={14} height={14} />
              </Link>
            </div>

            {article.faqs.length > 0 ? <AdSlot kind="in-content" /> : null}

            {article.faqs.length > 0 ? (
              <Section title={FAQ_TITLE}>
                <dl className="grid max-w-[70ch] gap-3">
                  {article.faqs.map((faq) => (
                    <div key={faq.question} className="card p-5">
                      <dt className="text-[16.5px] font-bold text-ink">{faq.question}</dt>
                      <dd className="mt-1.5 text-[15.5px] leading-relaxed text-ink-soft">
                        {faq.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>
            ) : null}

            <Section title={SOURCES_TITLE}>
              <ul className="grid max-w-[70ch] list-disc gap-2 pl-5 text-[15px] text-ink-soft">
                {article.sources.map((source) => (
                  <li key={source.url + source.name}>
                    <a href={source.url} rel="noopener" className="underline">
                      {source.name}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-4 max-w-[70ch] text-[14px] text-ink-mute">
                Marks, dates and patterns are from the official documents above. Study plans and
                answer-writing advice are our own guidance.
              </p>
            </Section>
          </article>

          {/* Desktop only: the outline stays in reach while reading, and the
              one sidebar ad sits below it, apart from the links. */}
          <aside className="hidden lg:block" aria-label="On this page">
            <div className="sticky top-24 grid gap-4">
              <nav className="card p-5">
                <p className="eyebrow">On this page</p>
                <ol className="mt-3 grid gap-1.5 text-[14.5px]">
                  {contents.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="block rounded-[8px] py-1 leading-snug text-ink-soft no-underline hover:text-brand"
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <AdSlot kind="sidebar" />
            </div>
          </aside>
        </div>

        {more.length > 0 ? (
          <Section title="Read next">
            <ul className="grid gap-5 sm:grid-cols-3">
              {more.map((next) => (
                <li key={next.slug}>
                  <Link
                    href={articlePath(next)}
                    className="card group block h-full overflow-hidden"
                  >
                    <Image
                      src={articleImageUrl(next, 640)}
                      alt={next.image.alt}
                      width={640}
                      height={336}
                      className="aspect-[40/21] w-full object-cover"
                      sizes="(min-width: 640px) 33vw, 100vw"
                    />
                    <span className="block p-4">
                      <span className="eyebrow text-[11.5px]">
                        {ARTICLE_CATEGORIES[next.category]}
                      </span>
                      <span className="mt-1 block text-[15.5px] font-bold leading-snug text-ink group-hover:text-brand">
                        {next.h1}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </Wrap>
    </>
  );
}
