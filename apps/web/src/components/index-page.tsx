import Link from 'next/link';
import type { ReactNode } from 'react';

import { ROUTES } from '@stc/constants';
import { EntityBadge, Eyebrow, Wrap, type EntityKind } from '@stc/ui';

/**
 * The shared browse-page shell.
 *
 * Five index routes needed the same thing: a heading, a count, a grid of
 * linked cards, and an honest empty state. Writing that five times is how the
 * five drift apart — one gets a breadcrumb, another loses the empty state, and
 * a year later they look like different products.
 *
 * Each route supplies only what differs: the entity kind, the copy, and a
 * mapping from its own DTO to the three fields a card renders.
 */

export type IndexItem = {
  /** Stable key and link target. */
  href: string;
  title: string;
  /** One line under the title — a category, a state, a year. */
  meta?: string | null;
  /** Right-aligned detail, usually a count or a date. Monospaced. */
  aside?: string | null;
};

export function IndexPage({
  kind,
  title,
  lede,
  items,
  total,
  unit,
  emptyNote,
  children,
}: {
  kind: EntityKind;
  title: string;
  lede: string;
  items: readonly IndexItem[];
  /** Total known to the API, which may exceed what is shown. */
  total?: number | null;
  /** Plural noun for the count line: "exams", "papers". */
  unit: string;
  /** Shown when the list is empty. Say WHY, not "no results". */
  emptyNote: string;
  children?: ReactNode;
}) {
  return (
    <Wrap>
      <nav aria-label="Breadcrumb" className="pt-5 text-[12.5px] text-ink-soft">
        <ol className="flex flex-wrap items-center gap-x-1.5">
          <li>
            <Link href={ROUTES.home()} className="text-inherit no-underline hover:underline">
              Home
            </Link>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-ink-mute">›</span>
            <span className="font-semibold text-ink">{title}</span>
          </li>
        </ol>
      </nav>

      <header className="py-6">
        <EntityBadge kind={kind} />
        <h1 className="mt-3 text-[clamp(28px,5vw,42px)] leading-[1.08] tracking-tight">{title}</h1>
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-soft">{lede}</p>
        {items.length > 0 ? (
          <p className="mt-3 font-data text-[13px] text-ink-mute">
            Showing <span className="num text-ink">{items.length}</span>
            {typeof total === 'number' && total > items.length ? (
              <>
                {' '}
                of <span className="num text-ink">{total.toLocaleString('en-IN')}</span>
              </>
            ) : null}{' '}
            {unit}
          </p>
        ) : null}
      </header>

      {children}

      {items.length === 0 ? (
        <div className="border border-dashed border-rule-hard bg-paper p-5">
          <Eyebrow>Nothing to show</Eyebrow>
          <p className="mt-2 max-w-[60ch] text-[14px] text-ink-soft">{emptyNote}</p>
        </div>
      ) : (
        <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.href} className="bg-surface">
              <Link
                href={item.href}
                className="flex h-full flex-col gap-1 p-3 no-underline hover:bg-row-hover"
              >
                <span className="text-[15px] font-semibold leading-snug text-ink">
                  {item.title}
                </span>
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  {item.meta ? (
                    <span className="text-[12.5px] text-ink-mute">{item.meta}</span>
                  ) : (
                    <span />
                  )}
                  {item.aside ? (
                    <span className="num text-[12px] text-ink-mute">{item.aside}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="h-10" />
    </Wrap>
  );
}
