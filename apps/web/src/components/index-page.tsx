import type { ReactNode } from 'react';

import { ROUTES } from '@stc/constants';
import { EntityBadge, Eyebrow, Wrap, type EntityKind } from '@stc/ui';

import { IndexList, type IndexItem } from '@/components/index-list';
import { PageHero } from '@/components/page-hero';

/**
 * The shared browse-page shell.
 *
 * Five index routes needed the same thing: a heading, a count, a grid of
 * linked cards, and an honest empty state. Writing that five times is how the
 * five drift apart — one gets a breadcrumb, another loses the empty state, and
 * a year later they look like different products.
 *
 * Each route supplies only what differs: the entity kind, the copy, and a
 * mapping from its own DTO to the three fields a card renders. The grid itself,
 * and the box that filters it, are <IndexList>.
 */

export type { IndexItem };

export function IndexPage({
  kind,
  title,
  lede,
  items,
  total,
  unit,
  emptyNote,
  failed = false,
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
  /** Shown when the list is genuinely empty — no rows exist yet. */
  emptyNote: string;
  /**
   * True when the fetch FAILED, as opposed to returning nothing.
   *
   * These were conflated before: every page rendered "could not be loaded"
   * whenever the list was empty, so a working API with no rows looked
   * identical to a broken one. That cost real debugging time on /blog, where
   * the API was returning 300 posts and the page said it could not load them.
   */
  failed?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHero
        trail={[
          { name: 'Home', path: ROUTES.home() },
          // The last crumb is never rendered as a link; the path is its key.
          { name: title, path: '#current' },
        ]}
        badges={<EntityBadge kind={kind} />}
        title={title}
        lede={lede}
        meta={
          items.length > 0 ? (
            <p className="font-data text-[14px] text-ink-mute">
              Showing <span className="num text-ink">{items.length.toLocaleString('en-IN')}</span>
              {typeof total === 'number' && total > items.length ? (
                <>
                  {' '}
                  of <span className="num text-ink">{total.toLocaleString('en-IN')}</span>
                </>
              ) : null}{' '}
              {unit}
            </p>
          ) : null
        }
      />

      <Wrap className="pt-10">
        {children}

        {items.length === 0 ? (
          <div
            className="card border-dashed p-6"
            style={
              failed
                ? {
                    borderColor: 'var(--color-urgent)',
                    background: 'var(--color-urgent-bg)',
                  }
                : undefined
            }
          >
            <Eyebrow>{failed ? 'Could not load' : 'Nothing to show'}</Eyebrow>
            <p className="mt-2 max-w-[60ch] text-[14.5px] text-ink-soft">
              {failed
                ? 'This list could not be loaded — the problem is on our side, not yours. Please try again shortly.'
                : emptyNote}
            </p>
          </div>
        ) : (
          <IndexList items={items} unit={unit} />
        )}
      </Wrap>
    </>
  );
}
