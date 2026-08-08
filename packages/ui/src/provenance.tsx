/**
 * WHERE A FACT CAME FROM.
 *
 * For exam content this is not decoration. A student deciding whether to trust
 * a cutoff needs to know if it is the agency's published figure or our
 * estimate, and the honest answer changes what they do with it.
 *
 * Making this a component rather than a convention means a page cannot quietly
 * omit it: `confidence` is required, so every rendered fact has to declare one.
 *
 *   official   published by the conducting body; `sourceUrl` should be present
 *   tentative  announced but not finalised — the agency itself calls it so
 *   estimated  our own analysis, clearly not an official figure
 */
export type Confidence = 'official' | 'tentative' | 'estimated';

const COPY: Record<Confidence, { label: string; tone: string; bg: string; explain: string }> = {
  official: {
    label: 'Official',
    tone: 'var(--color-ok)',
    bg: 'var(--color-ok-bg)',
    explain: 'Published by the conducting body.',
  },
  tentative: {
    label: 'Tentative',
    tone: 'var(--color-wait)',
    bg: 'var(--color-wait-bg)',
    explain: 'Announced but not finalised. Confirm on the official site before acting.',
  },
  estimated: {
    label: 'Estimated',
    tone: 'var(--color-urgent)',
    bg: 'var(--color-urgent-bg)',
    explain: 'Our estimate from previous years, not an official figure.',
  },
};

export function Provenance({
  confidence,
  sourceUrl,
  sourceName,
  className = '',
}: {
  confidence: Confidence;
  sourceUrl?: string | null;
  sourceName?: string | null;
  className?: string;
}) {
  const { label, tone, bg, explain } = COPY[confidence];

  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px] ${className}`}>
      <span
        className="border px-[6px] py-px font-data text-[9.5px] font-bold uppercase tracking-[0.09em]"
        style={{ color: tone, background: bg, borderColor: 'currentColor' }}
      >
        {label}
      </span>
      <span className="text-ink-soft">{explain}</span>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          className="underline"
          rel="nofollow noopener"
          target="_blank"
        >
          {sourceName ?? 'Source'}
        </a>
      ) : null}
    </p>
  );
}

/**
 * Freshness, stated in the page rather than only in the sitemap.
 *
 * `dateTime` is the machine-readable ISO value; the visible text is the human
 * one. Both come from the same source so they cannot drift.
 */
export function LastUpdated({ iso, className = '' }: { iso: string; className?: string }) {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);

  return (
    <span className={`font-data text-xs text-ink-mute ${className}`}>
      Updated <time dateTime={iso}>{formatted}</time>
    </span>
  );
}
