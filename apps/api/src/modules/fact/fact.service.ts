import { CACHE_TAGS, ROUTES } from '@stc/constants';
import type { FactChangeKind, Paginated } from '@stc/types';

import { getActorId } from '../../core/context.js';
import {
  BusinessRuleError,
  NotFoundError,
  VersionConflictError,
} from '../../core/errors/app-error.js';
import { buildOffsetMeta } from '../../core/pagination/paginator.js';
import type { AppLogger } from '../../core/logger.js';
import type { ICacheProvider } from '../../providers/cache/cache.provider.js';
import type { IQueueProvider } from '../../providers/queue/queue.provider.js';

import {
  EXTRACTOR_VERSION,
  extractFacts,
  riskOf,
  toDateRange,
  type Observation,
} from './fact.extractor.js';
import {
  toFactChangeDetailDto,
  toFactChangeDto,
  type FactChangeDetailDto,
  type FactChangeDto,
} from './fact.dto.js';
import type { FactRepository } from './fact.repository.js';
import {
  CANONICAL_OWNER,
  EVENT_TITLE,
  type ExtractionTally,
  type FactChangeListParams,
} from './fact.types.js';

/**
 * THE SEMANTIC TRUST BOUNDARY.
 *
 * Two operations, and the distance between them is the product:
 *
 *   detect()   read a snapshot, compare against canonical, queue what differs.
 *              Writes observations and changes. NEVER writes canonical data.
 *   approve()  a named human accepts one change; canonical data moves, and the
 *              affected pages are revalidated. One transaction.
 *
 * There is deliberately NO path between them. No confidence threshold
 * auto-publishes, no "trusted source" bypass, no batch approve-all. The single
 * failure this system exists to prevent is a confident wrong exam date reaching
 * a student, and every automatic path is a way for that to happen at 3 a.m.
 * with nobody's name on it.
 *
 * The rules, each enforced in code below rather than in a comment:
 *
 *   1. A changed source is not a changed fact.        detect(), value compare
 *   2. A truncated body is never parsed.              extractor, refuses
 *   3. An invalid date never reaches canonical.       extractor, counts+drops
 *   4. Nothing publishes without a reviewer.          approve() needs an actor
 *   5. LOW confidence needs a written reason.         assertReviewable()
 *   6. A stale approval cannot overwrite.             version check in the tx
 *   7. Re-processing is idempotent.                   upsert + status guard
 *   8. Extraction failure leaves canonical alone.     detect() never writes it
 */

export type FactRepositoryPort = Pick<
  FactRepository,
  | 'findExtractionTargets'
  | 'findCanonical'
  | 'upsertFact'
  | 'findPendingChange'
  | 'createChange'
  | 'refreshChange'
  | 'findChangeById'
  | 'listChanges'
  | 'setChangeStatus'
  | 'applyToExamEvent'
  | 'lockCanonicalVersion'
  | 'supersedeOthers'
  | 'findExamContext'
  | 'runInTransaction'
  | 'metrics'
>;

export type FactServiceDeps = {
  repository: FactRepositoryPort;
  /** Source URL → exam slug. Supplied by the container from the registry. */
  bindings: ReadonlyArray<{ url: string; watchesExamSlug: string }>;
  queue: IQueueProvider;
  cache: ICacheProvider;
  logger: AppLogger;
};

/** Snapshots read per pass. One per bound source, so this is a ceiling. */
const EXTRACTION_BATCH = 25;

export class FactService {
  constructor(private readonly deps: FactServiceDeps) {}

  // ── Detection ────────────────────────────────────────────────────────────

  /**
   * Reads the newest changed body of every bound source and queues what
   * differs from canonical.
   *
   * Returns a tally rather than throwing on a bad body: one unreadable source
   * must not stop the other five, and "four sources said nothing" is a
   * measurement worth having, not an error.
   */
  async detect(): Promise<ExtractionTally> {
    const tally: ExtractionTally = {
      snapshots: 0,
      observations: 0,
      changes: 0,
      critical: 0,
      invalid: 0,
      truncated: 0,
      silent: 0,
      superseded: 0,
    };

    const targets = await this.deps.repository.findExtractionTargets(
      this.deps.bindings,
      EXTRACTION_BATCH,
    );

    for (const target of targets) {
      tally.snapshots += 1;

      const result = extractFacts({
        body: target.rawContent,
        truncated: target.rawTruncated,
      });

      if (!result.ok) {
        if (result.reason === 'TRUNCATED') tally.truncated += 1;
        else tally.silent += 1;
        this.deps.logger.debug(
          { source: target.sourceName, reason: result.reason },
          'fact extraction produced nothing',
        );
        continue;
      }

      tally.invalid += result.rejected;

      if (result.observations.length === 0) {
        tally.silent += 1;
        continue;
      }

      // No cycle means there is nowhere to put an approved value. Recording
      // observations against an exam with no ExamYear would build a queue of
      // changes that can never be applied.
      if (!target.examYearId) {
        this.deps.logger.warn(
          { exam: target.examSlug, source: target.sourceName },
          'facts found but the exam has no cycle to write them to — skipped',
        );
        continue;
      }

      for (const observation of result.observations) {
        const outcome = await this.record(observation, {
          ...target,
          examYearId: target.examYearId,
        });
        tally.observations += 1;
        if (outcome === 'changed') {
          tally.changes += 1;
          if (riskOf(observation.factType) === 'CRITICAL') tally.critical += 1;
        }
      }
    }

    return tally;
  }

  /**
   * One observation: store it, compare it, queue a change only if it differs.
   *
   * This method is the answer to "the source changed, did the fact change?".
   * The comparison is on the NORMALISED value, so a page that reformats
   * 23 June 2026 as 23/06/2026 produces an observation and no change.
   */
  private async record(
    observation: Observation,
    target: {
      sourceId: string;
      snapshotId: string;
      examId: string;
      examSlug: string;
      examYearId: string;
    },
  ): Promise<'changed' | 'unchanged'> {
    const owner = CANONICAL_OWNER[observation.factType];

    const fact = await this.deps.repository.upsertFact({
      sourceId: target.sourceId,
      snapshotId: target.snapshotId,
      ownerType: 'EXAM',
      ownerId: target.examId,
      factType: observation.factType,
      rawValue: observation.rawValue,
      normalizedValue: observation.normalizedValue,
      confidence: observation.confidence,
      isTentative: observation.isTentative,
      evidence: observation.evidence,
      extractorVersion: EXTRACTOR_VERSION,
    });

    const canonical = await this.deps.repository.findCanonical({
      examYearId: target.examYearId,
      eventType: owner.eventType,
      field: owner.field,
    });

    // THE RULE THIS FILE EXISTS FOR. Same value ⇒ nothing happened, however
    // much the surrounding markup moved.
    if (canonical.value === observation.normalizedValue) return 'unchanged';

    const kind: FactChangeKind = canonical.value === null ? 'ADDED' : 'CHANGED';

    // An open change for this fact already exists. Update it in place instead
    // of stacking a second row — otherwise a source polled every three hours
    // builds 56 identical review items a week.
    const pending = await this.deps.repository.findPendingChange(
      target.examId,
      observation.factType,
    );

    if (pending) {
      if (
        pending.proposedValue === observation.normalizedValue &&
        pending.previousValue === canonical.value
      ) {
        // Byte-identical to what is already queued: nothing to tell anyone.
        return 'unchanged';
      }
      await this.deps.repository.refreshChange(pending.id, {
        extractedFactId: fact.id,
        previousValue: canonical.value,
        confidence: observation.confidence,
        canonicalId: canonical.eventId,
        canonicalVersion: canonical.version,
      });
      return 'changed';
    }

    await this.deps.repository.createChange({
      extractedFactId: fact.id,
      ownerType: 'EXAM',
      ownerId: target.examId,
      factType: observation.factType,
      kind,
      previousValue: canonical.value,
      proposedValue: observation.normalizedValue,
      risk: riskOf(observation.factType),
      confidence: observation.confidence,
      canonicalModel: owner.model,
      canonicalId: canonical.eventId,
      canonicalVersion: canonical.version,
    });

    this.deps.logger.info(
      {
        exam: target.examSlug,
        factType: observation.factType,
        from: canonical.value,
        to: observation.normalizedValue,
        risk: riskOf(observation.factType),
        confidence: observation.confidence,
      },
      'official fact change detected — pending review',
    );

    return 'changed';
  }

  // ── Review reads ─────────────────────────────────────────────────────────

  async listChanges(params: FactChangeListParams): Promise<Paginated<FactChangeDto>> {
    const { items, total } = await this.deps.repository.listChanges(params);
    return {
      items: items.map(toFactChangeDto),
      meta: buildOffsetMeta(params.page, params.perPage, total),
    };
  }

  async getChange(id: string): Promise<FactChangeDetailDto> {
    const record = await this.deps.repository.findChangeById(id);
    if (!record) throw new NotFoundError('FactChange', id);
    return toFactChangeDetailDto(record);
  }

  async metrics() {
    return this.deps.repository.metrics();
  }

  // ── Decisions ────────────────────────────────────────────────────────────

  /**
   * Accepts a change and moves canonical data. The only path that does.
   *
   * ONE TRANSACTION, in this order:
   *   1. re-read the target row's version and lock it
   *   2. refuse if it moved since detection          (stale-approval guard)
   *   3. write the canonical value
   *   4. record who decided, and why
   *   5. supersede rival pending changes for the same fact
   *   6. enqueue the revalidation event
   *
   * Steps 3 and 6 must not be separable. A canonical date that committed
   * without its outbox row is a page that shows the old date until something
   * unrelated happens to invalidate it — which, on a 1-hour ISR window with a
   * CDN in front, is indistinguishable from the update never happening.
   */
  async approve(id: string, input: { reason?: string | undefined }): Promise<FactChangeDetailDto> {
    const actorId = getActorId();
    // Rule 4. An approval is a person's decision; an unattributable canonical
    // write is exactly what the review queue exists to prevent.
    if (!actorId) {
      throw new BusinessRuleError('An approval must be attributable to a signed-in reviewer');
    }

    const change = await this.deps.repository.findChangeById(id);
    if (!change) throw new NotFoundError('FactChange', id);

    // Rule 7. Approving twice is a no-op, not a second canonical write and a
    // second revalidation. Double-clicking a button in the admin, or a retried
    // request, must not be able to apply a value twice.
    if (change.status === 'APPROVED') return toFactChangeDetailDto(change);

    assertReviewable(change.status);

    // Rule 5. A LOW-confidence observation means the page stated several
    // different values for a fact that can only have one. Approving it is
    // legitimate — a human can read the evidence and see which is right — but
    // it may not happen silently.
    if (change.confidence === 'LOW' && !input.reason?.trim()) {
      throw new BusinessRuleError(
        'This value was extracted with LOW confidence because the official page stated ' +
          'more than one candidate. Record which candidate you are accepting, and why, ' +
          'before approving.',
        { confidence: 'LOW', evidence: change.extractedFact.evidence },
      );
    }

    if (change.kind === 'REMOVED') {
      throw new BusinessRuleError(
        'A REMOVED change cannot be approved automatically: a page that dropped its ' +
          'dates table is far more likely than an authority un-announcing an exam. ' +
          'Edit the exam cycle directly if the removal is real.',
      );
    }

    const owner = CANONICAL_OWNER[change.factType];
    const range = owner.field === 'dateRange' ? toDateRange(change.proposedValue ?? '') : null;

    if (owner.field === 'dateRange' && !range) {
      // Rule 3, second line of defence. The extractor already rejects
      // impossible dates; this refuses to write a value that cannot be parsed
      // even if a row somehow carries one.
      throw new BusinessRuleError(
        `Cannot apply '${change.proposedValue}' — it is not a valid date or date range`,
      );
    }

    // Re-resolved at approval time, not read off the change: a value approved
    // in January must land on the cycle that is current in January.
    const context = await this.deps.repository.findExamContext(change.ownerId);
    if (!context) {
      throw new BusinessRuleError('The exam this change belongs to no longer exists');
    }
    if (!context.examYearId) {
      throw new BusinessRuleError(
        'This exam has no cycle (ExamYear) to write the value into. Create the cycle first.',
      );
    }
    const examYearId = context.examYearId;

    const updated = await this.deps.repository.runInTransaction(async (tx) => {
      // Rule 6. The version is re-read INSIDE the transaction and the row is
      // locked, so two reviewers approving at once cannot both pass the check.
      if (change.canonicalId) {
        const live = await this.deps.repository.lockCanonicalVersion(change.canonicalId, tx);
        if (!live) {
          throw new BusinessRuleError(
            'The exam event this change targets no longer exists. It has been sent back for review.',
          );
        }
        if (
          change.canonicalVersion &&
          live.updatedAt.getTime() !== change.canonicalVersion.getTime()
        ) {
          // Deliberately NOT marked SUPERSEDED. The proposed value may still be
          // correct; what is stale is the diff a reviewer was shown. Leaving it
          // pending and refusing the write means the next detection pass
          // refreshes `previousValue` and the reviewer decides against the
          // truth as it now stands.
          throw new VersionConflictError(
            change.canonicalVersion.getTime(),
            live.updatedAt.getTime(),
          );
        }
      }

      const applied = await this.deps.repository.applyToExamEvent(
        {
          eventId: change.canonicalId,
          examYearId,
          eventType: owner.eventType,
          title: EVENT_TITLE[owner.eventType],
          field: owner.field,
          start: range?.start ?? null,
          end: range?.end ?? null,
          officialUrl: owner.field === 'officialUrl' ? change.proposedValue : null,
          isTentative: change.extractedFact.isTentative,
        },
        tx,
      );

      const decided = await this.deps.repository.setChangeStatus(
        change.id,
        {
          status: 'APPROVED',
          reviewedById: actorId,
          decisionReason: input.reason?.trim() ?? null,
        },
        tx,
      );

      const superseded = await this.deps.repository.supersedeOthers(
        change.ownerId,
        change.factType,
        change.id,
        tx,
      );

      // In the same transaction as the canonical write. This is the outbox
      // pattern the repo already uses everywhere else, and the reason
      // arch:check has a metric for handler writes that miss `tx`.
      //
      // Tagged by SLUG, not id: `CACHE_TAGS.entity` is what the exam page's
      // cache-aside layer registers under, and revalidating `exam:<cuid>` would
      // purge nothing while reporting success.
      await this.deps.queue.publish(
        {
          eventType: 'CACHE_REVALIDATE',
          ownerType: 'EXAM',
          ownerId: change.ownerId,
          payload: {
            tags: [
              CACHE_TAGS.entity('EXAM', context.slug),
              CACHE_TAGS.entityList('EXAM'),
              CACHE_TAGS.sitemap(),
            ],
            // The entity tag covers the whole cluster without listing it. Every
            // page in it — hub, result, admit-card, answer-key, papers — reads
            // the exam through `getExam(slug)`, which apps/web tags with
            // exactly this string, so one tag invalidates all of them and the
            // API does not have to know which sections the frontend renders.
            paths: [ROUTES.exams()],
            reason: `fact:${change.factType}`,
          },
        },
        tx,
      );

      this.deps.logger.info(
        {
          changeId: change.id,
          factType: change.factType,
          eventId: applied.eventId,
          reviewer: actorId,
          superseded,
        },
        'fact change approved — canonical data updated',
      );

      return decided;
    });

    // Outside the transaction on purpose: the in-process cache is not
    // transactional, and purging it before the commit lands would repopulate it
    // with the old value straight away.
    await this.deps.cache.delByTag([
      CACHE_TAGS.entity('EXAM', context.slug),
      CACHE_TAGS.entityList('EXAM'),
    ]);

    return this.getChange(updated.id);
  }

  /** The source is wrong, or we are not acting on it. No canonical write. */
  async reject(id: string, input: { reason: string }): Promise<FactChangeDetailDto> {
    return this.decide(id, 'REJECTED', input.reason);
  }

  /**
   * Reviewed and deliberately not acted on.
   *
   * Distinct from REJECTED: "we already hold this from a better source" is not
   * the same statement as "the official page is wrong", and collapsing them
   * loses the only information a later reviewer would want.
   */
  async ignore(id: string, input: { reason: string }): Promise<FactChangeDetailDto> {
    return this.decide(id, 'IGNORED', input.reason);
  }

  private async decide(
    id: string,
    status: 'REJECTED' | 'IGNORED',
    reason: string,
  ): Promise<FactChangeDetailDto> {
    const actorId = getActorId();
    if (!actorId) {
      throw new BusinessRuleError('A decision must be attributable to a signed-in reviewer');
    }

    const change = await this.deps.repository.findChangeById(id);
    if (!change) throw new NotFoundError('FactChange', id);
    if (change.status === status) return toFactChangeDetailDto(change);

    assertReviewable(change.status);

    await this.deps.repository.setChangeStatus(id, {
      status,
      reviewedById: actorId,
      decisionReason: reason,
    });

    return this.getChange(id);
  }

}

/**
 * A decided change is final.
 *
 * Re-opening one would mean an approval could be quietly undone and re-applied
 * with a different value under the same audit line. A new detection pass
 * creates a NEW change instead, which leaves both decisions in the history.
 */
export function assertReviewable(status: string): void {
  if (status === 'PENDING_REVIEW') return;
  throw new BusinessRuleError(
    `This change was already ${status.toLowerCase().replace('_', ' ')} and cannot be decided again`,
    { status },
  );
}
