import type { ReactNode } from 'react';

/** Page gutter. One max-width for the whole product so columns never disagree. */
export function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1180px] px-6 ${className}`}>{children}</div>;
}

/**
 * A titled band of content.
 *
 * `major` draws the heavy 3px rule reserved for genuine top-level divisions.
 * Using it everywhere flattens the hierarchy back to nothing, which is the
 * usual failure mode of a rule-based design.
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
    <section
      id={id}
      className={`scroll-mt-20 py-8 ${major ? 'border-t-[3px] border-rule-hard' : 'border-t border-rule'}`}
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[27px] leading-tight">{title}</h2>
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
      className={`font-data text-[11px] uppercase tracking-[0.14em] text-ink-mute ${className}`}
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
  return <div className={`overflow-x-auto border border-rule ${className}`}>{children}</div>;
}

/** Key/value strip — the four dates a visitor wants before anything else. */
export function FactGrid({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode; tone?: 'urgent' | 'ok' | 'plain' }>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 border border-rule bg-paper p-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="font-data text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
            {item.label}
          </dt>
          <dd
            className="num mt-0.5 text-[13px] font-semibold"
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
