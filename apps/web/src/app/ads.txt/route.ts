import { ADSENSE } from '@stc/constants';

/**
 * /ads.txt — the file that tells ad buyers who is allowed to sell this site's
 * ad space. Without it AdSense reports "Not found" against the site.
 *
 * Built from the same publisher id the ad loader uses, so the two cannot name
 * different accounts. `f08c47fec0942fa0` is Google's own certification id and
 * is the same for every AdSense publisher.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const publisher = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? ADSENSE.CLIENT).replace(/^ca-/, '');
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
