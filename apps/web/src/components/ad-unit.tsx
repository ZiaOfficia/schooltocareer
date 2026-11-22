'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * One responsive AdSense unit. Asks AdSense to fill it once, after mount.
 * The loader script is added once, site-wide, by components/adsense.tsx.
 */
export function AdUnit({
  client,
  slot,
  format,
}: {
  client: string;
  slot: string;
  format: 'auto' | 'rectangle' | 'vertical';
}) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    // A unit that already has an ad (React strict mode, fast refresh) must
    // not be pushed twice: AdSense throws on a second push for one element.
    if (!ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked by an ad blocker or not yet loaded: the reserved space stays.
    }
  }, []);

  return (
    <ins
      ref={ref}
      className="adsbygoogle block"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={format === 'auto' ? 'true' : 'false'}
    />
  );
}
