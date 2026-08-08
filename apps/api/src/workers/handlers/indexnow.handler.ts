import type { OutboxEventType } from '@stc/types';

import { DependencyError } from '../../core/errors/dependency-error.js';
import type { AppLogger } from '../../core/logger.js';
import type { ClaimedMessage } from '../../providers/queue/queue.provider.js';

import type { IOutboxHandler } from './outbox-handler.js';

/**
 * Tells search engines a URL is new or changed.
 *
 * IMPORTANT CORRECTION TO THE OBVIOUS DESIGN: Google **removed** the sitemap
 * ping endpoint (`/ping?sitemap=`) in 2023 — it now returns 404 and is ignored.
 * Pinging it is dead code that quietly burns worker attempts.
 *
 * What actually works today:
 *   - IndexNow (Bing, Yandex, Seznam, Naver) — a real, supported submission API.
 *   - Google: discovers changes by crawling the sitemap, which is referenced
 *     from robots.txt. The useful action for Google is keeping the sitemap
 *     fresh, which the CACHE_REVALIDATE handler already does via the `sitemap`
 *     tag.
 *
 * So this handler submits to IndexNow and no-ops cleanly when no key is set,
 * rather than pretending to notify Google.
 */
export class IndexNowHandler implements IOutboxHandler {
  readonly name = 'indexnow-ping';
  readonly handles: OutboxEventType = 'SITEMAP_PING';

  constructor(
    private readonly config: {
      webBaseUrl: string;
      /** Absent means IndexNow is not configured; the handler no-ops. */
      key?: string | undefined;
      timeoutMs?: number;
    },
    private readonly logger: AppLogger,
  ) {}

  async handle(message: ClaimedMessage): Promise<void> {
    if (!this.config.key) return;

    const path = typeof message.payload['path'] === 'string' ? message.payload['path'] : null;
    if (!path) return;

    const host = new URL(this.config.webBaseUrl).host;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8_000);

    try {
      const response = await fetch('https://api.indexnow.org/IndexNow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          key: this.config.key,
          keyLocation: `${this.config.webBaseUrl}/${this.config.key}.txt`,
          urlList: [`${this.config.webBaseUrl}${path}`],
        }),
        signal: controller.signal,
      });

      // 200 and 202 are both success. 422 means the key file is missing or the
      // host does not match — retrying will never fix that.
      if (response.status === 422 || response.status === 403) {
        throw new DependencyError(`IndexNow rejected the submission (${response.status})`, {
          permanent: true,
        });
      }
      if (!response.ok && response.status !== 202) {
        throw new DependencyError(`IndexNow returned ${response.status}`);
      }

      this.logger.debug({ path, host }, 'submitted to IndexNow');
    } finally {
      clearTimeout(timer);
    }
  }
}
