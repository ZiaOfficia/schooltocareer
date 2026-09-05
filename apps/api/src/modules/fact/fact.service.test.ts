import { describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@stc/types';

import { runWithContext } from '../../core/context.js';
import { BusinessRuleError, VersionConflictError } from '../../core/errors/app-error.js';
import { createLogger } from '../../core/logger.js';
import { MemoryCacheProvider } from '../../providers/cache/memory.cache-provider.js';
import type { IQueueProvider, OutboxMessage } from '../../providers/queue/queue.provider.js';

import { FactService, type FactRepositoryPort } from './fact.service.js';
import type {
  CanonicalSnapshot,
  ExtractionTarget,
  FactChangeDetailRecord,
} from './fact.types.js';

/**
 * THE TRUST RULES, as executable statements.
 *
 * Every test here corresponds to a way a wrong exam date could reach a student.
 * The service is driven with plain object fakes — no database, no Prisma, no
 * container — which is the payoff of every collaborator being a port.
 *
 * The end-to-end block at the bottom is the JEE Advanced reference flow:
 * source → snapshot → observation → semantic change → review → approval →
 * canonical write → outbox. It is deliberately built from two DIFFERENT
 * snapshot bodies rather than two hand-written values, so it exercises the
 * extractor and the comparison together.
 */

const Y = new Date().getUTCFullYear();
const REVIEWER: AuthUser = { id: 'user_1', email: 'e@x.test', role: 'EDITOR', name: 'Reviewer' } as AuthUser;

/** Runs `fn` as a signed-in reviewer. */
function asReviewer<T>(fn: () => T): T {
  return runWithContext(
    {
      requestId: 'r1',
      correlationId: 'c1',
      startedAt: Date.now(),
      method: 'POST',
      path: '/',
      ip: '127.0.0.1',
      user: REVIEWER,
    },
    fn,
  );
}

const PAD = `<p>${'This page is published by the conducting authority. '.repeat(6)}</p>`;

/** The official page as it stood before the exam moved. */
const BODY_BEFORE =
  `${PAD}<table>` +
  `<tr><td>Date of Examination</td><td>23 June ${Y}</td></tr>` +
  `<tr><td>Application fee</td><td>Rs 3200</td></tr>` +
  `<tr><td>Last date for submission of online application form</td><td>27 April ${Y}</td></tr>` +
  `</table>`;

/** The same page after the authority moved the exam by one day. */
const BODY_AFTER = BODY_BEFORE.replace(`23 June ${Y}`, `24 June ${Y}`);

type Harness = {
  service: FactService;
  repository: FactRepositoryPort;
  published: OutboxMessage[];
  changes: Array<Record<string, unknown>>;
  applied: Array<Record<string, unknown>>;
  statuses: Array<{ id: string; status: string; reason: string | null }>;
};

function buildHarness(options: {
  body?: string;
  truncated?: boolean;
  canonical?: CanonicalSnapshot;
  pending?: Record<string, unknown> | null;
  detail?: Partial<FactChangeDetailRecord>;
  /** `updatedAt` the row actually has when the approval transaction runs. */
  liveVersion?: Date | null;
  examYearId?: string | null;
} = {}): Harness {
  const published: OutboxMessage[] = [];
  const changes: Array<Record<string, unknown>> = [];
  const applied: Array<Record<string, unknown>> = [];
  const statuses: Array<{ id: string; status: string; reason: string | null }> = [];

  const target: ExtractionTarget = {
    sourceId: 'src_1',
    sourceName: 'JEE Advanced — official',
    sourceUrl: 'https://jeeadv.ac.in/',
    snapshotId: 'snap_1',
    snapshotFetchedAt: new Date(),
    rawContent: options.body ?? BODY_BEFORE,
    rawTruncated: options.truncated ?? false,
    examId: 'exam_jeeadv',
    examSlug: 'jee-advanced',
    examYearId: options.examYearId === undefined ? 'year_1' : options.examYearId,
    examYear: Y,
  };

  /**
   * Canonical values PER FACT TYPE.
   *
   * The fixture body states two facts, so a fake that answered the same value
   * for every type made the untouched deadline look like a change and inflated
   * every count by one. The deadline defaults to the value the body states —
   * i.e. already correct — so it contributes nothing unless a test says so.
   */
  const canonicalByType: Record<string, CanonicalSnapshot> = {
    EXAM_DATE: options.canonical ?? { eventId: null, value: null, version: null },
    APPLICATION_END: { eventId: 'evt_2', value: `${Y}-04-27`, version: new Date() },
  };
  const canonicalFor = (eventType: string): CanonicalSnapshot =>
    canonicalByType[eventType] ?? { eventId: null, value: null, version: null };

  const detail = {
    id: 'chg_1',
    extractedFactId: 'fact_1',
    ownerType: 'EXAM' as const,
    ownerId: 'exam_jeeadv',
    factType: 'EXAM_DATE' as const,
    kind: 'CHANGED' as const,
    previousValue: `${Y}-06-23`,
    proposedValue: `${Y}-06-24`,
    risk: 'CRITICAL' as const,
    confidence: 'HIGH' as const,
    status: 'PENDING_REVIEW' as const,
    canonicalModel: 'ExamEvent',
    canonicalId: 'evt_1',
    canonicalVersion: new Date('2026-01-01T00:00:00Z'),
    reviewedById: null,
    reviewedAt: null,
    decisionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    extractedFact: {
      id: 'fact_1',
      sourceId: 'src_1',
      snapshotId: 'snap_1',
      ownerType: 'EXAM' as const,
      ownerId: 'exam_jeeadv',
      factType: 'EXAM_DATE' as const,
      rawValue: `24 June ${Y}`,
      normalizedValue: `${Y}-06-24`,
      confidence: 'HIGH' as const,
      isTentative: false,
      evidence: 'Date of Examination → 24 June',
      extractorVersion: 'exam-dates-v1',
      extractedAt: new Date(),
      source: { id: 'src_1', name: 'JEE Advanced — official', url: 'https://jeeadv.ac.in/', authority: 'IIT' },
      snapshot: { id: 'snap_1', fetchedAt: new Date(), contentHash: 'abc123' },
    },
    reviewedBy: null,
    ...options.detail,
  } as FactChangeDetailRecord;

  const repository: FactRepositoryPort = {
    findExtractionTargets: vi.fn(async () => [target]),
    findCanonical: vi.fn(async (input: { eventType: string }) => canonicalFor(input.eventType)),
    upsertFact: vi.fn(async (input) => ({ ...input, id: 'fact_1', extractedAt: new Date() })),
    findPendingChange: vi.fn(async () => (options.pending ?? null) as never),
    createChange: vi.fn(async (input) => {
      changes.push(input as Record<string, unknown>);
      return { ...input, id: 'chg_1', status: 'PENDING_REVIEW' } as never;
    }),
    refreshChange: vi.fn(async (id, input) => {
      changes.push({ id, refreshed: true, ...input });
      return { ...detail, ...input } as never;
    }),
    findChangeById: vi.fn(async () => detail),
    listChanges: vi.fn(async () => ({ items: [], total: 0 })),
    setChangeStatus: vi.fn(async (id, input) => {
      statuses.push({ id, status: input.status, reason: input.decisionReason });
      return { ...detail, status: input.status } as never;
    }),
    applyToExamEvent: vi.fn(async (input) => {
      applied.push(input as unknown as Record<string, unknown>);
      return { eventId: 'evt_1', updatedAt: new Date() };
    }),
    lockCanonicalVersion: vi.fn(async () =>
      options.liveVersion === null
        ? null
        : { updatedAt: options.liveVersion ?? new Date('2026-01-01T00:00:00Z') },
    ),
    supersedeOthers: vi.fn(async () => 0),
    findExamContext: vi.fn(async () => ({
      slug: 'jee-advanced',
      examYearId: options.examYearId === undefined ? 'year_1' : options.examYearId,
    })),
    runInTransaction: vi.fn(async (fn) => fn('TX')),
    metrics: vi.fn(async () => ({ observations: 0, byStatus: [], byRisk: [], pendingOldestAt: null })),
  };

  const queue: IQueueProvider = {
    publish: vi.fn(async (event) => {
      published.push(event);
    }),
    publishDetached: vi.fn(async () => undefined),
    claim: vi.fn(async () => []),
    ack: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    deadLetter: vi.fn(async () => undefined),
    pendingCount: vi.fn(async () => 0),
  };

  const service = new FactService({
    repository,
    bindings: [{ url: 'https://jeeadv.ac.in/', watchesExamSlug: 'jee-advanced' }],
    queue,
    cache: new MemoryCacheProvider(),
    logger: createLogger({ level: 'silent', pretty: false, service: 'test' }),
  });

  return { service, repository, published, changes, applied, statuses };
}

// ── Detection ───────────────────────────────────────────────────────────────

describe('detect — a changed source is not a changed fact', () => {
  it('raises NO change when canonical already holds the same value', () => {
    // THE CENTRAL RULE. The markup around the date can churn on every poll;
    // what matters is whether the value moved.
    const { service, changes } = buildHarness({
      canonical: { eventId: 'evt_1', value: `${Y}-06-23`, version: new Date() },
    });

    return service.detect().then((tally) => {
      const examChanges = changes.filter((c) => c['factType'] === 'EXAM_DATE');
      expect(examChanges).toHaveLength(0);
      expect(tally.observations).toBeGreaterThan(0);
      expect(tally.changes).toBe(0);
    });
  });

  it('raises a CRITICAL change when the exam date moves', async () => {
    const { service, changes } = buildHarness({
      body: BODY_AFTER,
      canonical: { eventId: 'evt_1', value: `${Y}-06-23`, version: new Date() },
    });

    const tally = await service.detect();
    const change = changes.find((c) => c['factType'] === 'EXAM_DATE');

    expect(change).toMatchObject({
      kind: 'CHANGED',
      previousValue: `${Y}-06-23`,
      proposedValue: `${Y}-06-24`,
      risk: 'CRITICAL',
    });
    expect(tally.critical).toBe(1);
  });

  it('records the change as ADDED when canonical holds nothing', async () => {
    const { service, changes } = buildHarness();
    await service.detect();
    expect(changes.find((c) => c['factType'] === 'EXAM_DATE')).toMatchObject({ kind: 'ADDED' });
  });

  it('never writes canonical data during detection', async () => {
    const { service, applied } = buildHarness({ body: BODY_AFTER });
    await service.detect();
    // Rule 8: extraction can only ever propose. Even a perfect reading of a
    // perfect page does not move a published date.
    expect(applied).toHaveLength(0);
  });

  it('refuses to parse a truncated body, and reports it as such', async () => {
    const { service, changes } = buildHarness({ truncated: true });
    const tally = await service.detect();

    expect(changes).toHaveLength(0);
    expect(tally.truncated).toBe(1);
    // Not folded into "nothing found": a truncation is a fixable storage
    // problem, and counting it as silence hides it forever.
    expect(tally.silent).toBe(0);
  });

  it('does not queue observations for an exam with no cycle to write them to', async () => {
    const { service, changes } = buildHarness({ body: BODY_AFTER, examYearId: null });
    await service.detect();
    // A change nobody can ever apply is queue noise, not a safeguard.
    expect(changes).toHaveLength(0);
  });
});

describe('detect — idempotency', () => {
  it('does not stack a second identical change on top of a pending one', async () => {
    // A source polled every three hours would otherwise build 56 identical
    // review items a week.
    const { service, changes } = buildHarness({
      body: BODY_AFTER,
      canonical: { eventId: 'evt_1', value: `${Y}-06-23`, version: new Date() },
      pending: {
        id: 'chg_1',
        proposedValue: `${Y}-06-24`,
        previousValue: `${Y}-06-23`,
        factType: 'EXAM_DATE',
      },
    });

    const tally = await service.detect();
    expect(changes.filter((c) => c['factType'] === 'EXAM_DATE')).toHaveLength(0);
    expect(tally.changes).toBe(0);
  });

  it('refreshes a pending change when canonical moved underneath it', async () => {
    // The queue must show the diff as it stands NOW, or a reviewer approves
    // against a "previous value" that has not been true for three days.
    const { service, changes } = buildHarness({
      body: BODY_AFTER,
      canonical: { eventId: 'evt_1', value: `${Y}-07-01`, version: new Date() },
      pending: {
        id: 'chg_1',
        proposedValue: `${Y}-06-24`,
        previousValue: `${Y}-06-23`,
        factType: 'EXAM_DATE',
      },
    });

    await service.detect();
    expect(changes.find((c) => c['refreshed'])).toMatchObject({
      id: 'chg_1',
      previousValue: `${Y}-07-01`,
    });
  });

  it('running detection twice over the same snapshot changes nothing the second time', async () => {
    const harness = buildHarness({
      body: BODY_AFTER,
      canonical: { eventId: 'evt_1', value: `${Y}-06-23`, version: new Date() },
    });

    const first = await harness.service.detect();
    // Second pass sees the change it just created.
    const second = buildHarness({
      body: BODY_AFTER,
      canonical: { eventId: 'evt_1', value: `${Y}-06-23`, version: new Date() },
      pending: {
        id: 'chg_1',
        proposedValue: `${Y}-06-24`,
        previousValue: `${Y}-06-23`,
        factType: 'EXAM_DATE',
      },
    });
    const repeat = await second.service.detect();

    expect(first.changes).toBe(1);
    expect(repeat.changes).toBe(0);
  });
});

// ── Approval ────────────────────────────────────────────────────────────────

describe('approve — canonical writes', () => {
  it('writes the value, records the reviewer, and enqueues revalidation together', async () => {
    const { service, applied, statuses, published } = buildHarness();

    await asReviewer(() => service.approve('chg_1', {}));

    expect(applied[0]).toMatchObject({ eventId: 'evt_1', field: 'dateRange' });
    expect(statuses[0]).toMatchObject({ status: 'APPROVED' });

    // The outbox row commits with the canonical write. Without it the page
    // keeps serving the old date until its TTL expires.
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ eventType: 'CACHE_REVALIDATE', ownerType: 'EXAM' });
    // Tagged by SLUG — the string apps/web actually tags getExam() with.
    expect(published[0]?.payload['tags']).toContain('exam:jee-advanced');
  });

  it('sets BOTH date endpoints so the page cannot render a half-open range', async () => {
    const { service, applied } = buildHarness();
    await asReviewer(() => service.approve('chg_1', {}));

    expect(applied[0]?.['start']).toEqual(new Date(`${Y}-06-24T00:00:00.000Z`));
    expect(applied[0]?.['end']).toEqual(new Date(`${Y}-06-24T00:00:00.000Z`));
  });

  it('refuses an approval that nobody signed', async () => {
    const { service, applied } = buildHarness();
    // No request context ⇒ no actor. An unattributable canonical write is
    // exactly what the review queue exists to prevent.
    await expect(service.approve('chg_1', {})).rejects.toThrow(BusinessRuleError);
    expect(applied).toHaveLength(0);
  });
});

describe('approve — confidence and risk', () => {
  it('will not accept a LOW-confidence value without a written reason', async () => {
    const { service, applied } = buildHarness({
      detail: { confidence: 'LOW' },
    });

    await expect(asReviewer(() => service.approve('chg_1', {}))).rejects.toThrow(BusinessRuleError);
    expect(applied).toHaveLength(0);
  });

  it('accepts a LOW-confidence value once the reviewer records which candidate they chose', async () => {
    const { service, applied, statuses } = buildHarness({ detail: { confidence: 'LOW' } });

    await asReviewer(() =>
      service.approve('chg_1', { reason: 'Confirmed against the PDF notification, page 2.' }),
    );

    expect(applied).toHaveLength(1);
    expect(statuses[0]?.reason).toContain('page 2');
  });

  it('refuses to auto-apply a REMOVED change', async () => {
    // A page that dropped its dates table is far more likely than an authority
    // un-announcing an exam.
    const { service, applied } = buildHarness({
      detail: { kind: 'REMOVED', proposedValue: null },
    });

    await expect(asReviewer(() => service.approve('chg_1', {}))).rejects.toThrow(BusinessRuleError);
    expect(applied).toHaveLength(0);
  });

  it('refuses to write a value that is not a real date', async () => {
    const { service, applied } = buildHarness({
      detail: { proposedValue: 'sometime in June' },
    });

    await expect(asReviewer(() => service.approve('chg_1', {}))).rejects.toThrow(BusinessRuleError);
    expect(applied).toHaveLength(0);
  });
});

describe('approve — concurrency', () => {
  it('rejects a stale approval instead of overwriting a newer value', async () => {
    // The change was detected when the row was at 1 Jan; an editor has since
    // edited it. Approving now would silently discard their work.
    const { service, applied, published } = buildHarness({
      liveVersion: new Date('2026-02-01T00:00:00Z'),
    });

    await expect(asReviewer(() => service.approve('chg_1', {}))).rejects.toThrow(
      VersionConflictError,
    );
    expect(applied).toHaveLength(0);
    // And nothing was revalidated, because nothing changed.
    expect(published).toHaveLength(0);
  });

  it('leaves a stale change PENDING so the next pass can re-diff it', async () => {
    const { service, statuses } = buildHarness({
      liveVersion: new Date('2026-02-01T00:00:00Z'),
    });

    await expect(asReviewer(() => service.approve('chg_1', {}))).rejects.toThrow(
      VersionConflictError,
    );
    // NOT marked SUPERSEDED: the proposed value may still be right. What is
    // stale is the diff the reviewer was shown.
    expect(statuses).toHaveLength(0);
  });

  it('refuses when the target event has been deleted', async () => {
    const { service, applied } = buildHarness({ liveVersion: null });
    await expect(asReviewer(() => service.approve('chg_1', {}))).rejects.toThrow(BusinessRuleError);
    expect(applied).toHaveLength(0);
  });

  it('approving twice applies the value once', async () => {
    // A double-clicked button or a retried request must not write twice and
    // revalidate twice.
    const { service, applied, published } = buildHarness({ detail: { status: 'APPROVED' } });

    await asReviewer(() => service.approve('chg_1', {}));

    expect(applied).toHaveLength(0);
    expect(published).toHaveLength(0);
  });
});

describe('reject and ignore', () => {
  it('reject records the decision and writes no canonical data', async () => {
    const { service, applied, statuses } = buildHarness();
    await asReviewer(() => service.reject('chg_1', { reason: 'Misread a JoSAA round deadline' }));

    expect(applied).toHaveLength(0);
    expect(statuses[0]).toMatchObject({ status: 'REJECTED' });
  });

  it('ignore is a separate outcome from reject', async () => {
    // "We hold this from a better source" is not "the official page is wrong",
    // and collapsing them loses the only thing a later reviewer would want.
    const { service, statuses } = buildHarness();
    await asReviewer(() => service.ignore('chg_1', { reason: 'Already published from the PDF' }));
    expect(statuses[0]).toMatchObject({ status: 'IGNORED' });
  });

  it('a decided change cannot be decided again', async () => {
    const { service } = buildHarness({ detail: { status: 'REJECTED' } });
    await expect(
      asReviewer(() => service.ignore('chg_1', { reason: 'changed my mind' })),
    ).rejects.toThrow(BusinessRuleError);
  });
});

// ── The mandated reference flow ─────────────────────────────────────────────

describe('JEE Advanced end-to-end: source → snapshot → fact → change → approval', () => {
  /**
   * The full trust pipeline on one exam, driven by two real page bodies.
   *
   *   snapshot A   Exam Date: 23 June      Application ends: 27 April
   *   snapshot B   Exam Date: 24 June      Application ends: 27 April  (unchanged)
   *
   * Expected: a critical pending change for the exam date, NO change for the
   * untouched deadline, and an approval that moves canonical data and emits
   * exactly one revalidation event.
   */

  it('produces a critical pending change for the moved exam date', async () => {
    const { service, changes } = buildHarness({
      body: BODY_AFTER,
      canonical: { eventId: 'evt_1', value: `${Y}-06-23`, version: new Date() },
    });

    await service.detect();
    const change = changes.find((c) => c['factType'] === 'EXAM_DATE');

    expect(change).toMatchObject({
      kind: 'CHANGED',
      previousValue: `${Y}-06-23`,
      proposedValue: `${Y}-06-24`,
      risk: 'CRITICAL',
      canonicalModel: 'ExamEvent',
    });
  });

  it('produces NO change for the application deadline the page did not touch', async () => {
    // The single most important assertion in this file. Both snapshots state
    // 27 April; the body around it changed, the fact did not.
    const harness = buildHarness({ body: BODY_AFTER });
    (harness.repository.findCanonical as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { eventType: string }) =>
        input.eventType === 'APPLICATION_END'
          ? { eventId: 'evt_2', value: `${Y}-04-27`, version: new Date() }
          : { eventId: 'evt_1', value: `${Y}-06-23`, version: new Date() },
    );

    await harness.service.detect();

    expect(harness.changes.map((c) => c['factType'])).toContain('EXAM_DATE');
    expect(harness.changes.map((c) => c['factType'])).not.toContain('APPLICATION_END');
  });

  it('approval updates the canonical owner and emits exactly one outbox event', async () => {
    const { service, applied, published, statuses } = buildHarness();

    await asReviewer(() => service.approve('chg_1', {}));

    // Canonical owner is ExamEvent — no Exam.examDate was invented for this.
    expect(applied).toEqual([
      expect.objectContaining({
        eventId: 'evt_1',
        examYearId: 'year_1',
        eventType: 'EXAM_DATE',
        field: 'dateRange',
      }),
    ]);
    expect(statuses[0]).toMatchObject({ status: 'APPROVED' });
    expect(published).toHaveLength(1);
    expect(published[0]?.eventType).toBe('CACHE_REVALIDATE');
  });

  it('an extraction failure leaves canonical truth untouched', async () => {
    const { service, applied, changes } = buildHarness({ body: '<html><body></body></html>' });
    const tally = await service.detect();

    expect(applied).toHaveLength(0);
    expect(changes).toHaveLength(0);
    expect(tally.silent).toBe(1);
  });
});

describe('a fixed extractor must be able to correct a change already in the queue', () => {
  it('updates the PROPOSED value, not just the surrounding metadata', async () => {
    // The bug this pins. refreshChange updated everything except the one field
    // a reviewer decides on, so after the GATE extractor was corrected the
    // queue still offered the superseded value — and approve() writes
    // proposedValue, so the reviewer would have seen one date and published
    // another.
    const { service, changes } = buildHarness({
      body: BODY_AFTER,
      canonical: { eventId: 'evt_1', value: null, version: null },
      pending: {
        id: 'chg_1',
        // What the broken extractor had proposed.
        proposedValue: `${Y}-06-23`,
        previousValue: null,
        factType: 'EXAM_DATE',
      },
    });

    await service.detect();

    const refreshed = changes.find((c) => c['refreshed']);
    expect(refreshed).toBeDefined();
    expect(refreshed).toMatchObject({
      id: 'chg_1',
      // The corrected reading from the new extractor.
      proposedValue: `${Y}-06-24`,
    });
  });
});

describe('an approved date carries its provenance onto the canonical row', () => {
  it('writes the source URL to ExamEvent.officialUrl for a DATE fact', async () => {
    // The integrity gate requires a published date to be traceable to
    // something. Approving one used to leave officialUrl NULL, and the gate
    // flagged five real approvals for exactly that — "the extractor said so"
    // is not provenance a student can check.
    const { service, applied } = buildHarness();

    await asReviewer(() => service.approve('chg_1', {}));

    expect(applied[0]).toMatchObject({
      field: 'dateRange',
      officialUrl: 'https://jeeadv.ac.in/',
    });
  });

  it('still writes the approved VALUE for a URL fact, not the source page', async () => {
    // The URL branch must be unaffected: when the fact itself is a link, the
    // approved value is the link — not the page it was found on.
    const { service, applied } = buildHarness({
      detail: {
        factType: 'OFFICIAL_APPLICATION_URL',
        proposedValue: 'https://gate2026.iitg.ac.in/apply',
      },
    });

    await asReviewer(() => service.approve('chg_1', {}));

    expect(applied[0]).toMatchObject({
      field: 'officialUrl',
      officialUrl: 'https://gate2026.iitg.ac.in/apply',
    });
  });
});
