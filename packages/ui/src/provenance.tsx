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
 *   official   published by the conducting body; `sourceUrl` is REQUIRED
 *   tentative  announced but not finalised — the agency itself calls it so
 *   estimated  our own analysis, clearly not an official figure
 *   unsourced  we do not have this from the authority yet, and say so
 *
 * "should be present" used to describe sourceUrl on `official`, which is a
 * convention a caller can forget. It was forgotten: an exam page derived
 * confidence as `events.some(isTentative) ? 'tentative' : 'official'`, so an
 * exam with NO events at all rendered a green "Official" badge — over
 * fabricated seed dates, pointing at a placeholder domain. The props below are
 * now a discriminated union, so claiming "Official" without a source URL does
 * not typecheck.
 */
export type Confidence = 'official' | 'tentative' | 'estimated' | 'unsourced';

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
  unsourced: {
    label: 'Not sourced',
    // Matches StatusStamp's 'quiet' tone — no state worth colouring. A
    // missing fact must not compete visually with a confirmed one.
    tone: 'var(--color-ink-mute)',
    bg: 'transparent',
    explain: 'Not yet confirmed from the official source. Check the authority before acting.',
  },
};

/**
 * `official` demands a source URL; every other state may omit it.
 *
 * This is the whole point of the union — the badge that tells a student "you
 * can act on this" cannot be rendered without the link that proves it.
 */
export type ProvenanceProps = { className?: string } & (
  | { confidence: 'official'; sourceUrl: string; sourceName?: string | null }
  | {
      confidence: 'tentative' | 'estimated';
      sourceUrl?: string | null;
      sourceName?: string | null;
    }
  | { confidence: 'unsourced'; sourceUrl?: null; sourceName?: string | null }
);

export function Provenance({ confidence, sourceUrl, sourceName, className = '' }: ProvenanceProps) {
  const { label, tone, bg, explain } = COPY[confidence];

  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] ${className}`}>
      <span
        className="rounded-full border px-[9px] py-[3px] font-data text-[11px] font-bold uppercase leading-none tracking-[0.09em]"
        style={{
          color: tone,
          background: bg,
          borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
        }}
      >
        {label}
      </span>
      <span className="text-ink-soft">{explain}</span>
      {sourceUrl ? (
        <a href={sourceUrl} className="underline" rel="nofollow noopener" target="_blank">
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
