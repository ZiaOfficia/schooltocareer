import type { ReactNode } from 'react';

/**
 * STATE, not identity. Filled and tinted, so it can never be read as an
 * EntityBadge even on the same hue. See entity-badge.tsx for why that split
 * exists.
 *
 * `tone` describes urgency, not the kind of thing being described:
 *   urgent  a deadline that closes soon, or a failure
 *   ok      declared, live, published
 *   wait    scheduled, awaiting, in review
 *   quiet   no state worth colouring
 */
export type StampTone = 'urgent' | 'ok' | 'wait' | 'quiet';

const TONE: Record<StampTone, { fg: string; bg: string }> = {
  urgent: { fg: 'var(--color-urgent)', bg: 'var(--color-urgent-bg)' },
  ok: { fg: 'var(--color-ok)', bg: 'var(--color-ok-bg)' },
  wait: { fg: 'var(--color-wait)', bg: 'var(--color-wait-bg)' },
  quiet: { fg: 'var(--color-ink-mute)', bg: 'transparent' },
};

export function StatusStamp({
  tone = 'quiet',
  dot = false,
  children,
  className = '',
}: {
  tone?: StampTone;
  /** A live-state marker. Reserve it for things that are true right now. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { fg, bg } = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-[5px] border px-[7px] py-px font-data text-[9.5px] font-bold uppercase tracking-[0.09em] whitespace-nowrap ${className}`}
      style={{ color: fg, background: bg, borderColor: 'currentColor' }}
    >
      {dot ? <span className="h-[5px] w-[5px] shrink-0 bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
