import { isIndexableDeployment } from '@stc/config';
import { ADSENSE } from '@stc/constants';

import { AdUnit } from '@/components/ad-unit';
import { adSlotEnv, adsenseClientEnv, deploymentEnv } from '@/lib/env';

/**
 * A manual AdSense placement. AdSense policy, applied as layout rules:
 *
 *   - Only between whole sections of long-form content, or in the desktop
 *     sidebar — never inside a paragraph, a table, a list of links, a form or
 *     a mock test, and never next to a button or a download link, so nothing
 *     can be clicked by mistake.
 *   - Labelled "Advertisement" and set apart by rules above and below, so it
 *     cannot be mistaken for the site's own content or navigation.
 *   - Its height is reserved before the ad arrives, so the text never jumps
 *     (no layout shift).
 *   - At most two in-content units and one sidebar unit on a page. No ads on
 *     the home page, listings, legal pages or the mock tests.
 *
 * Renders NOTHING unless this is the production deployment and the unit id
 * for this kind of slot is set (NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT /
 * NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR). Until then pages show no empty boxes.
 */
export function AdSlot({ kind }: { kind: 'in-content' | 'sidebar' }) {
  const client = adsenseClientEnv() ?? ADSENSE.CLIENT;
  const ids = adSlotEnv();
  const slot = kind === 'sidebar' ? ids.SIDEBAR : ids.IN_CONTENT;
  if (!slot || !client || !isIndexableDeployment(deploymentEnv())) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={kind === 'sidebar' ? 'ad-slot ad-slot--sidebar' : 'ad-slot'}
    >
      <span className="ad-slot__label">Advertisement</span>
      <div className={kind === 'sidebar' ? 'min-h-[600px]' : 'min-h-[280px]'}>
        <AdUnit client={client} slot={slot} format={kind === 'sidebar' ? 'vertical' : 'auto'} />
      </div>
    </aside>
  );
}
