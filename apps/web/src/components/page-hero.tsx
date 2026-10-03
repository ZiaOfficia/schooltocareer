import Link from 'next/link';
import type { ReactNode } from 'react';

import { Wrap } from '@stc/ui';

import { Scene } from '@/components/scene';

export type Crumb = { name: string; path: string };

/**
 * The dark header band every inner page opens with.
 *
 * Breadcrumb, badges, H1, lede — the same four things in the same order on
 * every listing, exam hub and exam section, so they are written once. The
 * band is `.night`, which re-points the colour tokens to their dark values:
 * badges, stamps and fact tiles dropped in as `children` need no "on dark"
 * variant of their own.
 *
 * The last crumb is the current page, so it is text, not a link.
 */
export function PageHero({
  trail,
  badges,
  title,
  subtitle,
  lede,
  meta,
  children,
}: {
  trail: readonly Crumb[];
  /** Entity badge and any status stamps, above the title. */
  badges?: ReactNode;
  title: string;
  /** A quieter line directly under the H1 — an exam's full name. */
  subtitle?: string | null;
  lede?: string;
  /** The small line under the lede: counts, conducting body, last updated. */
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="night hero-bg">
      <Scene variant="waves" className="opacity-70" />

      <Wrap className="pb-12 pt-6 sm:pb-16">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-ink-mute">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {trail.map((crumb, index) => (
              <li key={crumb.path} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {index === trail.length - 1 ? (
                  <span aria-current="page" className="font-semibold text-ink">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    href={crumb.path}
                    className="text-inherit no-underline hover:text-ink hover:underline"
                  >
                    {crumb.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <header className="pt-8 sm:pt-10">
          {badges ? (
            <div data-reveal className="flex flex-wrap items-center gap-2">
              {badges}
            </div>
          ) : null}

          <h1 data-words className="mt-4 max-w-[24ch] text-[clamp(30px,5.4vw,52px)] leading-[1.06]">
            <Words text={title} />
          </h1>

          {subtitle ? (
            <p data-reveal className="mt-2 text-[15px] text-ink-mute">
              {subtitle}
            </p>
          ) : null}

          {lede ? (
            <p data-reveal className="mt-4 max-w-[64ch] text-[16.5px] text-ink-soft">
              {lede}
            </p>
          ) : null}

          {meta ? (
            <div
              data-reveal
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft"
            >
              {meta}
            </div>
          ) : null}

          {children ? <div className="mt-7">{children}</div> : null}
        </header>
      </Wrap>
    </div>
  );
}

/**
 * A headline split into words that can rise in one at a time.
 *
 * Split on the server, so the markup is identical with or without JavaScript
 * and a crawler reads an ordinary sentence. The spaces stay as real text
 * between the spans — that is what keeps it one sentence to a screen reader
 * and to copy-paste.
 */
export function Words({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ').filter(Boolean);
  return (
    <>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="word">
            <span className={`word-in ${className}`}>{word}</span>
          </span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </>
  );
}
