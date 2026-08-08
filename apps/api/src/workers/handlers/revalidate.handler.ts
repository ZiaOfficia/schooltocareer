import type { OutboxEventType } from '@stc/types';

import { DependencyError } from '../../core/errors/dependency-error.js';
import type { AppLogger } from '../../core/logger.js';
import type { ClaimedMessage } from '../../providers/queue/queue.provider.js';

import type { IOutboxHandler } from './outbox-handler.js';

/**
 * Purges the Next.js ISR cache after commit.
 *
 * This runs in the worker, not in the request, precisely so the CDN is never
 * purged for a transaction that later rolled back — the site would then rebuild
 * those pages from data that never existed.
 *
 * Idempotent: revalidating an already-fresh tag is a no-op on the Next.js side.
 */
export class CacheRevalidateHandler implements IOutboxHandler {
  readonly name = 'cache-revalidate';
  readonly handles: OutboxEventType = 'CACHE_REVALIDATE';

  constructor(
    private readonly config: { webBaseUrl: string; secret: string; timeoutMs?: number },
    private readonly logger: AppLogger,
  ) {}

  async handle(message: ClaimedMessage): Promise<void> {
    const tags = asStringArray(message.payload['tags']);
    const paths = asStringArray(message.payload['paths']);
    if (tags.length === 0 && paths.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8_000);

    try {
      const response = await fetch(`${this.config.webBaseUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Shared secret in a header, not the query string — query strings end
          // up in access logs and CDN cache keys.
          'X-Revalidate-Secret': this.config.secret,
        },
        body: JSON.stringify({ tags, paths }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // 4xx is a misconfiguration (wrong secret, route missing). Retrying
        // cannot fix it, so fail fast to the dead-letter queue rather than
        // burning five attempts.
        const permanent = response.status >= 400 && response.status < 500;
        throw new DependencyError(
          `Revalidation failed with ${response.status}`,
          { permanent },
        );
      }

      this.logger.debug({ tags, paths }, 'revalidated');
    } finally {
      clearTimeout(timer);
    }
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
