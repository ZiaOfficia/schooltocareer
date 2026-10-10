'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

import { ArrowRightIcon, SearchIcon } from '@/components/icons';

export type IndexItem = {
  /**
   * Link target, and the React key. `null` when the destination page is not
   * built yet: the card renders unlinked rather than pointing at a 404.
   */
  href: string | null;
  title: string;
  /** One line under the title — a category, a state, a year. */
  meta?: string | null;
  /** Right-aligned detail, usually a count or a date. Monospaced. */
  aside?: string | null;
};

/** Below this, the whole list fits on a screen and a filter box is clutter. */
const FILTER_FROM = 9;

/**
 * The card grid of a browse page, with a box that narrows it as you type.
 *
 * The full list is in the server-rendered HTML — the filter only hides cards,
 * so the page reads the same to a crawler and works with JavaScript off. Every
 * word typed has to appear somewhere on a card (title, the line under it, or
 * the detail on the right), so "jee 2024 shift 2" finds what it says.
 */
export function IndexList({ items, unit }: { items: readonly IndexItem[]; unit: string }) {
  const [query, setQuery] = useState('');
  const inputId = useId();

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return items;
    return items.filter((item) => {
      const text = `${item.title} ${item.meta ?? ''} ${item.aside ?? ''}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [items, query]);

  const filterable = items.length >= FILTER_FROM;

  return (
    <>
      {filterable ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center rounded-[var(--radius-tile)] border border-rule-hard bg-surface pl-3.5 focus-within:border-brand sm:max-w-[420px]">
            <SearchIcon width={18} height={18} className="shrink-0 text-ink-mute" />
            <label htmlFor={inputId} className="sr-only">
              Find in these {unit}
            </label>
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Type to find in these ${unit}…`}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[16px] text-ink outline-none placeholder:text-ink-mute"
            />
          </div>
          <p aria-live="polite" className="text-[14px] text-ink-soft">
            {query.trim() ? (
              <>
                <span className="num font-semibold text-ink">
                  {visible.length.toLocaleString('en-IN')}
                </span>{' '}
                of <span className="num">{items.length.toLocaleString('en-IN')}</span> {unit} match
              </>
            ) : (
              <>
                <span className="num font-semibold text-ink">
                  {items.length.toLocaleString('en-IN')}
                </span>{' '}
                {unit}
              </>
            )}
          </p>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="card border-dashed p-6">
          <p className="text-[15px] text-ink-soft">
            Nothing here matches “{query.trim()}”. Try fewer or shorter words.
          </p>
          <button type="button" onClick={() => setQuery('')} className="btn btn-ghost mt-4">
            Show all {unit}
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const body = (
              <>
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-[16.5px] font-semibold leading-snug text-ink">
                    {item.title}
                  </span>
                  {item.href ? (
                    <ArrowRightIcon
                      width={16}
                      height={16}
                      className="card-arrow mt-1 shrink-0 text-ink-mute"
                    />
                  ) : null}
                </span>
                <span className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 pt-1">
                  {item.meta ? (
                    <span className="text-[14px] text-ink-soft">{item.meta}</span>
                  ) : (
                    <span />
                  )}
                  {item.aside ? (
                    <span className="num rounded-full bg-row-hover px-2 py-0.5 text-[12.5px] text-ink-soft">
                      {item.aside}
                    </span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li key={item.href ?? item.title}>
                {item.href ? (
                  <Link href={item.href} className="card flex h-full flex-col gap-2 p-5">
                    {body}
                  </Link>
                ) : (
                  <div className="card flex h-full flex-col gap-2 p-5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
