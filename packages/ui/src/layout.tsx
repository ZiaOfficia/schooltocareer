import type { ReactNode } from 'react';

/** Page gutter. One max-width for the whole product so columns never disagree. */
export function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-6 ${className}`}>{children}</div>
  );
}

/**
 * A titled band of content.
 *
 * `major` adds the gradient marker reserved for genuine top-level divisions.
 * Using it everywhere flattens the hierarchy back to nothing.
 *
 * The heading block and the body carry `data-reveal`, so every section on the
 * site enters the same way without each page having to remember to ask.
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
    <section id={id} className="scroll-mt-24 py-10 sm:py-12">
      <div data-reveal className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
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
      className={`font-data text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute ${className}`}
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
          data-reveal
          className="min-w-0 rounded-[var(--radius-tile)] border border-rule bg-surface/70 p-4 backdrop-blur-md"
          style={
            item.tone === 'urgent'
              ? {
                  borderColor: 'var(--color-urgent)',
                  background: 'var(--color-urgent-bg)',
                }
              : undefined
          }
        >
          <dt className="font-data text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
            {item.label}
          </dt>
          <dd
            className="num mt-1.5 text-[15px] font-semibold leading-snug text-ink"
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
