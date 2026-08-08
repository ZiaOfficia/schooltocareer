import { defineEvents } from '../../core/events/define-events.js';

/**
 * Media events.
 *
 * MediaAsset has no slug - `publicId` is its stable identifier - so the event
 * subject uses it in the slug position. `defineEvents` needed no change, which
 * is a small but real signal that the event factory is not entity-shaped.
 *
 * The path is the delivery URL: a replaced image must purge the CDN copy of the
 * bytes as well as the pages embedding it.
 */
export const mediaEvents = defineEvents<{ id: string; slug: string; url: string }>(
  'media',
  'MEDIA_ASSET',
  (media) => media.url,
);