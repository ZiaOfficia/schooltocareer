import { ENTITY_PATH_TEMPLATES } from '@stc/constants';
import type { Locale, OwnerType, SlugChangeReason } from '@stc/types';
import { isReservedSlug, isValidSlug, slugCandidates, slugify } from '@stc/utils';

import { BusinessRuleError, SlugTakenError } from '../../core/errors/app-error.js';

import type { SlugRepository } from './slug.repository.js';

/**
 * Slug generation and rename bookkeeping. Module-agnostic — Exam is simply the
 * first caller.
 *
 * The slug rules that matter live here rather than in each module, because
 * getting them wrong costs accumulated search rankings and there is no way to
 * get those back.
 */
export class SlugService {
  constructor(private readonly repository: SlugRepository) {}

  /**
   * Produces a unique slug.
   *
   * `probe` is supplied by the calling module's repository, so this service
   * never needs to know which table it is checking. The database's unique
   * constraint remains the real guard — this is an optimisation that produces
   * a nicer slug than a collision retry would.
   */
  async generate(
    base: string,
    probe: (slug: string) => Promise<boolean>,
    hints: { year?: number; qualifier?: string } = {},
  ): Promise<string> {
    const candidates = slugCandidates(base, hints);

    for (const candidate of candidates) {
      if (isReservedSlug(candidate) || !isValidSlug(candidate)) continue;
      if (!(await probe(candidate))) return candidate;
    }

    // Every domain-meaningful candidate is taken. Fall back to a suffix that
    // is guaranteed free rather than looping forever.
    const fallback = `${slugify(base)}-${Date.now().toString(36)}`;
    if (await probe(fallback)) throw new SlugTakenError(fallback);
    return fallback;
  }

  /** Validates a slug an editor typed by hand. */
  async assertAvailable(slug: string, probe: (slug: string) => Promise<boolean>): Promise<void> {
    if (!isValidSlug(slug)) {
      throw new BusinessRuleError(
        'Slug must be lowercase words separated by single hyphens',
      );
    }
    if (isReservedSlug(slug)) {
      throw new BusinessRuleError(`'${slug}' is reserved and cannot be used as a slug`);
    }
    if (await probe(slug)) throw new SlugTakenError(slug);
  }

  /**
   * Expands a rename into concrete redirects using the entity's registered
   * path templates.
   *
   * This is why ENTITY_PATH_TEMPLATES lives in @stc/constants: adding
   * `/exam/:slug/cutoff` there gives every past and future rename a redirect
   * for that page automatically, with no migration and no per-module code.
   */
  buildRedirects(entityType: OwnerType, oldSlug: string, newSlug: string): Array<{ from: string; to: string }> {
    const templates = ENTITY_PATH_TEMPLATES[entityType] ?? [];
    return templates.map((template) => ({
      from: template.replace(':slug', oldSlug),
      to: template.replace(':slug', newSlug),
    }));
  }

  /** Single redirect target — used when an entity is deleted, not renamed. */
  buildDeletionRedirects(
    entityType: OwnerType,
    slug: string,
    fallbackPath: string,
  ): Array<{ from: string; to: string }> {
    const templates = ENTITY_PATH_TEMPLATES[entityType] ?? [];
    return templates.map((template) => ({
      from: template.replace(':slug', slug),
      to: fallbackPath,
    }));
  }

  async recordRename(
    params: {
      entityType: OwnerType;
      entityId: string;
      siteId: string;
      oldSlug: string;
      newSlug: string;
      locale?: Locale;
      reason: SlugChangeReason;
      actorId?: string | undefined;
      /** False for tombstones, so a deleted entity's old URL is not a live 301. */
      isActive?: boolean;
      redirects: Array<{ from: string; to: string }>;
    },
    tx: unknown,
  ): Promise<void> {
    await this.repository.recordChange(
      {
        entityType: params.entityType,
        entityId: params.entityId,
        siteId: params.siteId,
        oldSlug: params.oldSlug,
        newSlug: params.newSlug,
        locale: params.locale ?? 'EN',
        reason: params.reason,
        isActive: params.isActive ?? true,
        changedById: params.actorId,
        redirects: params.redirects,
      },
      tx as Parameters<SlugRepository['recordChange']>[1],
    );
  }

  /**
   * Looks up a historical slug. Callers use this to answer a 404 with a 301
   * (renamed) or a 410 (deleted) instead of a bare not-found.
   */
  async resolveHistorical(
    entityType: OwnerType,
    oldSlug: string,
    locale: Locale = 'EN',
  ): Promise<{ entityId: string; newSlug: string; isActive: boolean } | null> {
    return this.repository.resolveHistorical(entityType, oldSlug, locale);
  }
}
