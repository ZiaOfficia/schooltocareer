import { describe as suite, expect, it, vi } from 'vitest';

import { checkRobots, isAllowedByRobots, truncateToBytes } from './fetch-sources.task.js';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
} as unknown as Parameters<typeof checkRobots>[1];

/** Replaces global fetch for one call and restores it afterwards. */
function withFetch<T>(impl: () => Promise<Response> | never, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl as typeof globalThis.fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } });

suite('isAllowedByRobots', () => {
  it('permits a path no rule mentions', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow: /admin', '/notices')).toBe(true);
  });

  it('refuses a disallowed prefix', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow: /admin', '/admin/users')).toBe(false);
  });

  it('treats a blanket disallow as covering everything', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow: /', '/anything')).toBe(false);
  });

  it('lets a longer Allow re-permit a disallowed subtree', () => {
    const txt = 'User-agent: *\nDisallow: /docs\nAllow: /docs/public';
    expect(isAllowedByRobots(txt, '/docs/public/notice.pdf')).toBe(true);
    expect(isAllowedByRobots(txt, '/docs/private')).toBe(false);
  });

  it('ignores rules addressed to a different crawler', () => {
    expect(isAllowedByRobots('User-agent: AhrefsBot\nDisallow: /', '/notices')).toBe(true);
  });

  it('applies a group that names us specifically', () => {
    expect(isAllowedByRobots('User-agent: SchoolToCareerBot\nDisallow: /', '/notices')).toBe(false);
  });

  it('permits an empty file', () => {
    expect(isAllowedByRobots('', '/notices')).toBe(true);
  });
});

// The regression this file exists for. Every one of these cases was recorded
// as BLOCKED_BY_ROBOTS by the first implementation, which reported seven of
// twenty sources as disallowed when none of them was.
suite('checkRobots — a refusal we inferred is not a refusal we were given', () => {
  it('allows when robots.txt is absent, per the standard', async () => {
    const verdict = await withFetch(
      async () => text('not found', 404),
      () => checkRobots('https://example.gov.in/notices', logger),
    );
    expect(verdict).toEqual({ allowed: true });
  });

  it('reports a genuine Disallow as the site DISALLOWING us', async () => {
    const verdict = await withFetch(
      async () => text('User-agent: *\nDisallow: /'),
      () => checkRobots('https://example.gov.in/notices', logger),
    );
    expect(verdict).toEqual({ allowed: false, reason: 'DISALLOWED' });
  });

  it('reports a 403 on robots.txt as UNAVAILABLE, not as a disallow', async () => {
    const verdict = await withFetch(
      async () => text('Access Denied', 403),
      () => checkRobots('https://www.cbse.gov.in/', logger),
    );
    expect(verdict).toEqual({
      allowed: false,
      reason: 'UNAVAILABLE',
      detail: 'HTTP 403 fetching robots.txt',
    });
  });

  it('surfaces the transport cause rather than undici "fetch failed"', async () => {
    const wrapped = new TypeError('fetch failed');
    (wrapped as { cause?: unknown }).cause = new Error(
      "Hostname/IP does not match certificate's altnames: Host: www.rrbchennai.gov.in.",
    );
    const verdict = await withFetch(
      async () => {
        throw wrapped;
      },
      () => checkRobots('https://www.rrbchennai.gov.in/', logger),
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict).toMatchObject({ reason: 'UNAVAILABLE' });
    // The certificate detail is the entire value of the record; "fetch failed"
    // names nothing and cannot be acted on.
    expect((verdict as { detail: string }).detail).toContain('altnames');
    expect((verdict as { detail: string }).detail).not.toBe('fetch failed');
  });

  it('reports a malformed source URL without attempting a request', async () => {
    const fetchSpy = vi.fn();
    const verdict = await withFetch(fetchSpy as never, () => checkRobots('not-a-url', logger));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(verdict).toMatchObject({ allowed: false, reason: 'UNAVAILABLE' });
  });
});

// NTA publishes half its notices in Devanagari, where one character is three
// UTF-8 bytes. String.slice counts UTF-16 code units, so a cap named in bytes
// and applied with slice stored up to 3x its budget — on the one source that
// Phase 1 most needs.
suite('truncateToBytes', () => {
  const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

  it('returns short input untouched', () => {
    expect(truncateToBytes('notice', 1000)).toBe('notice');
  });

  it('respects the budget for ASCII', () => {
    expect(truncateToBytes('abcdefghij', 4)).toBe('abcd');
  });

  it('respects a BYTE budget for Devanagari, not a character count', () => {
    const devanagari = 'सूचना'.repeat(50);
    const out = truncateToBytes(devanagari, 100);
    expect(bytes(out)).toBeLessThanOrEqual(100);
    // The bug: slice(0, 100) would have kept 100 characters — ~300 bytes.
    expect(out.length).toBeLessThan(100);
  });

  it('never emits a partial character', () => {
    // 'सू' is 6 bytes; cutting at 4 lands mid-sequence.
    const out = truncateToBytes('सूचना', 4);
    expect(out).not.toContain('\uFFFD');
    expect(bytes(out)).toBeLessThanOrEqual(4);
  });

  it('keeps a replacement character that was genuinely in the input', () => {
    expect(truncateToBytes('ok\uFFFD', 100)).toBe('ok\uFFFD');
  });
});
