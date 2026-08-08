/**
 * Date and number formatting for an Indian audience.
 *
 * Everything is IST-anchored and explicit. Server-rendered dates that use the
 * host's local timezone produce a different string on Vercel (UTC) than in the
 * browser, which React flags as a hydration mismatch.
 */

const IST = 'Asia/Kolkata';

export function formatDate(
  value: Date | string | null | undefined,
  style: 'short' | 'long' | 'numeric' = 'long',
): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions =
    style === 'numeric'
      ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: IST }
      : style === 'short'
        ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST }
        : { day: 'numeric', month: 'long', year: 'numeric', timeZone: IST };

  return new Intl.DateTimeFormat('en-IN', options).format(date);
}

export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  const s = formatDate(start, 'short');
  const e = formatDate(end, 'short');
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s || e || 'To be announced';
}

/** Stable ISO date string for JSON-LD, sitemaps and cursors. */
export function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isUpcoming(value: Date | string | null | undefined, now = new Date()): boolean {
  const date = value ? new Date(value) : null;
  return !!date && !Number.isNaN(date.getTime()) && date.getTime() > now.getTime();
}

export function daysUntil(value: Date | string, now = new Date()): number {
  const date = new Date(value);
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Indian academic year label. The session starts in April, so anything before
 * April belongs to the previous year's session.
 */
export function academicYear(now = new Date()): string {
  const year = now.getFullYear();
  const start = now.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** The year to substitute into `{year}` metadata tokens. */
export function currentExamYear(now = new Date()): number {
  return now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
}

/** Indian digit grouping: 12,34,567 — not 1,234,567. */
export function formatIndianNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatCurrency(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise);
}

/** Compact Indian scale — 1.2 Lakh, 4.5 Crore. */
export function formatCompactIndian(value: number): string {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(1).replace(/\.0$/, '')} Lakh`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

export function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}
