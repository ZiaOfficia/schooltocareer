import type { ReactNode } from 'react';

/** Page gutter. One max-width for the whole product so columns never disagree. */
export function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-6 ${className}`}>{children}</div>
  );
}

/**
 * The anchor a section answers to, derived from its title.
 *
 * One function, used by Section to set the id and by a page to build its table
 * of contents, so a contents link cannot point at an id nobody rendered.
 */
export function sectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * "On this page" — the list of sections, as links.
 *
 * Renders nothing under three entries. A contents box above two sections is
 * longer than the scroll it saves, and on a short page it pushes the answer
 * the visitor came for further down.
 *
 * Plain anchors, no script: it works before hydration and a crawler reads it
 * as the page's outline. `scroll-mt` on Section keeps the sticky header from
 * covering the heading a link lands on.
 */
export function TableOfContents({
  items,
  className = '',
}: {
  items: ReadonlyArray<{ id: string; title: string }>;
  className?: string;
}) {
  if (items.length < 3) return null;

  return (
    <nav aria-label="On this page" className={`card p-5 ${className}`}>
      <Eyebrow>On this page</Eyebrow>
      <ol className="mt-3 grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-2">
            <span aria-hidden="true" className="num w-5 shrink-0 text-ink-mute">
              {index + 1}
            </span>
            <a href={`#${item.id}`} className="text-ink no-underline hover:underline">
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Builds contents entries from section titles, skipping any that are absent. */
export function contentsOf(
  titles: ReadonlyArray<string | null | undefined | false>,
): Array<{ id: string; title: string }> {
  return titles
    .filter((title): title is string => typeof title === 'string' && title.length > 0)
    .map((title) => ({ id: sectionId(title), title }));
}

/**
 * A titled band of content.
 *
 * `major` adds the gradient marker reserved for genuine top-level divisions.
 * Using it everywhere flattens the hierarchy back to nothing.

 */
export function Section({
  id,
  title,
  lede,
  major = false,
  actions,
  children,
}: {
  id?: string;
  title: string;
  lede?: string;
  major?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id ?? sectionId(title)} className="scroll-mt-24 py-10 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          {major ? (
            <span
              aria-hidden="true"
              className="mb-3 block h-1 w-12 rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--color-brand), var(--color-cyan))',
              }}
            />
          ) : null}
          <h2
            className={
              major ? 'text-[clamp(24px,3.4vw,32px)] leading-tight' : 'text-[22px] leading-tight'
            }
          >
            {title}
          </h2>
          {lede ? <p className="mt-2 max-w-[68ch] text-[15px] text-ink-soft">{lede}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Small uppercase mono label. Used for facet groups and column headers. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`font-data text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-mute ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A wide block that scrolls inside itself.
 *
 * Tables and code are the two things that break a responsive layout. Wrapping
 * them here guarantees the page body never scrolls sideways on a phone, which
 * is the single most common mobile defect on education sites.
 */
export function ScrollX({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-[var(--radius-card)] border border-rule ${className}`}>
      {children}
    </div>
  );
}

/** Key/value strip — the four dates a visitor wants before anything else. */
export function FactGrid({
  items,
}: {
  items: ReadonlyArray<{
    label: string;
    value: ReactNode;
    tone?: 'urgent' | 'ok' | 'plain';
  }>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-[var(--radius-tile)] border border-rule bg-surface p-4"
          style={
            item.tone === 'urgent'
              ? {
                  borderColor: 'var(--color-urgent)',
                  background: 'var(--color-urgent-bg)',
                }
              : undefined
          }
        >
          <dt className="font-data text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
            {item.label}
          </dt>
          <dd
            className="num mt-1.5 text-[16px] font-semibold leading-snug text-ink"
            style={{
              color:
                item.tone === 'urgent'
                  ? 'var(--color-urgent)'
                  : item.tone === 'ok'
                    ? 'var(--color-ok)'
                    : undefined,
            }}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
