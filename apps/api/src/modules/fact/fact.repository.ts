import { Prisma, type PrismaClient } from '@stc/database';

import { BaseRepository } from '../../core/base/base.repository.js';
import { toOffsetArgs } from '../../core/pagination/paginator.js';
import { when, whereAnd } from '../../core/query/filter-builder.js';

import type {
  CanonicalSnapshot,
  ExtractedFactRecord,
  ExtractionTarget,
  FactChangeDetailRecord,
  FactChangeListParams,
  FactChangeRecord,
} from './fact.types.js';

/**
 * The only file in this module that may import Prisma (arch:check metric 1).
 *
 * Selects are explicit, and `evidence` — which can be a couple of kilobytes per
 * row — is omitted from the list select. A review queue of 50 changes should not
 * drag 100 kB of evidence text across the wire to render 50 one-line rows; the
 * detail read fetches it.
 */

const CHANGE_SELECT = {
  id: true,
  extractedFactId: true,
  ownerType: true,
  ownerId: true,
  factType: true,
  kind: true,
  previousValue: true,
  proposedValue: true,
  risk: true,
  confidence: true,
  status: true,
  canonicalModel: true,
  canonicalId: true,
  canonicalVersion: true,
  reviewedById: true,
  reviewedAt: true,
  decisionReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FactChangeSelect;

const FACT_SELECT = {
  id: true,
  sourceId: true,
  snapshotId: true,
  ownerType: true,
  ownerId: true,
  factType: true,
  rawValue: true,
  normalizedValue: true,
  confidence: true,
  isTentative: true,
  evidence: true,
  extractorVersion: true,
  extractedAt: true,
} satisfies Prisma.ExtractedFactSelect;

export class FactRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // ── Extraction inputs ────────────────────────────────────────────────────

  /**
   * The newest CHANGED snapshot per extractable source, joined to its exam.
   *
   * NEWEST PER SOURCE, not every snapshot ever stored. Re-reading a body from
   * March tells us what the page said in March, which is not what a page
   * publishes today — and the observation for it already exists, so the work
   * would be discarded by the idempotency key anyway.
   *
   * Only `CHANGED` rows carry a body at all (see ingestion.prisma), so this is
   * also the complete set of snapshots there is anything to read.
   *
   * `bindings` comes from the source registry — the extractor runs ONLY where a
   * URL is bound to exactly one exam. A multi-exam notice board has no binding
   * and is therefore never read, which is what keeps a date from one exam being
   * attributed to another.
   */
  async findExtractionTargets(
    bindings: ReadonlyArray<{ url: string; watchesExamSlug: string }>,
    limit: number,
  ): Promise<ExtractionTarget[]> {
    if (bindings.length === 0) return [];

    const urls = bindings.map((b) => b.url);
    const slugByUrl = new Map(bindings.map((b) => [b.url, b.watchesExamSlug]));

    const rows = await this.run(
      () =>
        this.prisma.$queryRaw<
          Array<{
            sourceId: string;
            sourceName: string;
            sourceUrl: string;
            snapshotId: string;
            snapshotFetchedAt: Date;
            rawContent: string | null;
            rawTruncated: boolean;
          }>
        >`
          SELECT DISTINCT ON (s.id)
                 s.id            AS "sourceId",
                 s.name          AS "sourceName",
                 s.url           AS "sourceUrl",
                 sn.id           AS "snapshotId",
                 sn."fetchedAt"  AS "snapshotFetchedAt",
                 sn."rawContent" AS "rawContent",
                 sn."rawTruncated" AS "rawTruncated"
            FROM "Source" s
            JOIN "SourceSnapshot" sn ON sn."sourceId" = s.id
           WHERE s.url IN (${Prisma.join(urls)})
             AND sn.outcome = 'CHANGED'
           ORDER BY s.id, sn."fetchedAt" DESC
           LIMIT ${limit}
        `,
      { resource: 'ExtractedFact' },
    );

    // The exam and its current cycle, resolved once per distinct slug rather
    // than once per snapshot.
    const slugs = [...new Set(rows.map((r) => slugByUrl.get(r.sourceUrl)).filter(Boolean))] as string[];
    if (slugs.length === 0) return [];

    const exams = await this.run(
      () =>
        this.prisma.exam.findMany({
          where: { slug: { in: slugs }, deletedAt: null },
          select: {
            id: true,
            slug: true,
            years: {
              where: { deletedAt: null },
              // The live cycle if one is flagged, else the newest we hold —
              // the same rule the exam page uses to pick which cycle to show.
              orderBy: [{ isCurrent: 'desc' }, { year: 'desc' }],
              take: 1,
              select: { id: true, year: true },
            },
          },
        }),
      { resource: 'Exam' },
    );
    const examBySlug = new Map(exams.map((e) => [e.slug, e]));

    return rows.flatMap((row) => {
      const slug = slugByUrl.get(row.sourceUrl);
      const exam = slug ? examBySlug.get(slug) : undefined;
      // A binding pointing at an exam that does not exist is a registry bug,
      // not a reason to invent an owner for the observation.
      if (!slug || !exam) return [];
      const cycle = exam.years[0];
      return [
        {
          ...row,
          examId: exam.id,
          examSlug: exam.slug,
          examYearId: cycle?.id ?? null,
          examYear: cycle?.year ?? null,
        },
      ];
    });
  }

  /**
   * The exam an observation belongs to, plus the cycle a value lands in.
   *
   * Needed at APPROVAL time, and re-resolved rather than stored on the change:
   * a change detected in December must land on the cycle that is current when
   * someone actually approves it, not the one that was current at detection.
   *
   * The slug matters as much as the id — cache tags and revalidation paths are
   * keyed by slug (see CACHE_TAGS.entity), so approving with the id would purge
   * a tag nothing uses and leave the page serving the old date.
   */
  async findExamContext(
    examId: string,
  ): Promise<{ slug: string; examYearId: string | null } | null> {
    const exam = await this.run(
      () =>
        this.prisma.exam.findFirst({
          where: { id: examId, deletedAt: null },
          select: {
            slug: true,
            years: {
              where: { deletedAt: null },
              orderBy: [{ isCurrent: 'desc' }, { year: 'desc' }],
              take: 1,
              select: { id: true },
            },
          },
        }),
      { resource: 'Exam', identifier: examId },
    );
    if (!exam) return null;
    return { slug: exam.slug, examYearId: exam.years[0]?.id ?? null };
  }

  /**
   * The published value for one fact, normalised the way an observation is.
   *
   * Normalising HERE is what makes "the source changed but the fact did not"
   * cheap and reliable: both sides are `YYYY-MM-DD` strings by the time they
   * are compared, so a page switching from "23 June 2026" to "23/06/2026"
   * produces no change.
   */
  async findCanonical(input: {
    examYearId: string;
    eventType: string;
    field: 'dateRange' | 'officialUrl';
  }): Promise<CanonicalSnapshot> {
    const event = await this.run(
      () =>
        this.prisma.examEvent.findFirst({
          where: { examYearId: input.examYearId, type: input.eventType as never },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            officialUrl: true,
            updatedAt: true,
          },
        }),
      { resource: 'ExamEvent', identifier: `${input.examYearId}:${input.eventType}` },
    );

    if (!event) return { eventId: null, value: null, version: null };

    if (input.field === 'officialUrl') {
      return { eventId: event.id, value: event.officialUrl, version: event.updatedAt };
    }

    const start = event.startDate ? iso(event.startDate) : null;
    const end = event.endDate ? iso(event.endDate) : null;
    const value = start === null ? null : end === null || end === start ? start : `${start}/${end}`;

    return { eventId: event.id, value, version: event.updatedAt };
  }

  // ── Observations ─────────────────────────────────────────────────────────

  /**
   * Records one observation, idempotently.
   *
   * `upsert` on the (snapshot, owner, factType) key rather than `create`, so
   * re-running the task over the same snapshot converges. That matters more
   * than it looks: the task is retried on any failure, and without this a
   * transient error halfway through a batch would double every observation
   * before it.
   */
  async upsertFact(
    input: Omit<ExtractedFactRecord, 'id' | 'extractedAt'>,
    tx?: unknown,
  ): Promise<ExtractedFactRecord> {
    const client: Prisma.TransactionClient = tx ? asTx(tx) : this.prisma;
    const record = await client.extractedFact.upsert({
      where: {
        snapshotId_ownerId_factType: {
          snapshotId: input.snapshotId,
          ownerId: input.ownerId,
          factType: input.factType as never,
        },
      },
      create: input as never,
      // A re-read of the same body with a NEWER extractor may legitimately
      // produce a different value; the row is the observation for that
      // (snapshot, fact) pair and is updated in place rather than duplicated.
      update: {
        rawValue: input.rawValue,
        normalizedValue: input.normalizedValue,
        confidence: input.confidence as never,
        isTentative: input.isTentative,
        evidence: input.evidence,
        extractorVersion: input.extractorVersion,
      },
      select: FACT_SELECT,
    });
    return record as ExtractedFactRecord;
  }

  // ── Changes ──────────────────────────────────────────────────────────────

  /** An open change for the same fact, if one is already queued. */
  async findPendingChange(
    ownerId: string,
    factType: string,
  ): Promise<FactChangeRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.factChange.findFirst({
          where: { ownerId, factType: factType as never, status: 'PENDING_REVIEW' },
          select: CHANGE_SELECT,
        }),
      { resource: 'FactChange', identifier: `${ownerId}:${factType}` },
    );
    return record as FactChangeRecord | null;
  }

  async createChange(
    input: Omit<FactChangeRecord, 'id' | 'status' | 'reviewedById' | 'reviewedAt' | 'decisionReason' | 'createdAt' | 'updatedAt'>,
    tx?: unknown,
  ): Promise<FactChangeRecord> {
    const client: Prisma.TransactionClient = tx ? asTx(tx) : this.prisma;
    const record = await client.factChange.create({
      data: input as never,
      select: CHANGE_SELECT,
    });
    return record as FactChangeRecord;
  }

  /**
   * Refreshes an already-queued change in place.
   *
   * Used when the source restates the SAME proposed value against a canonical
   * row that has since moved: the queue must show the current diff, not the one
   * from three days ago, or a reviewer approves against a value they never saw.
   */
  async refreshChange(
    id: string,
    input: {
      extractedFactId: string;
      previousValue: string | null;
      /**
       * REQUIRED. An earlier version of this method updated everything about a
       * queued change EXCEPT the value being proposed, which is the one field a
       * reviewer actually decides on.
       *
       * The consequence was not cosmetic. Fixing the GATE extractor produced a
       * corrected observation (2026-02-07/2026-02-15), the change row kept the
       * superseded one (2026-02-07), and `approve()` writes `proposedValue` —
       * so the queue would have shown a reviewer one value and published
       * another.
       */
      proposedValue: string | null;
      kind: string;
      confidence: string;
      canonicalId: string | null;
      canonicalVersion: Date | null;
    },
    tx?: unknown,
  ): Promise<FactChangeRecord> {
    const client: Prisma.TransactionClient = tx ? asTx(tx) : this.prisma;
    const record = await client.factChange.update({
      where: { id },
      data: {
        extractedFactId: input.extractedFactId,
        previousValue: input.previousValue,
        proposedValue: input.proposedValue,
        kind: input.kind as never,
        confidence: input.confidence as never,
        canonicalId: input.canonicalId,
        canonicalVersion: input.canonicalVersion,
      },
      select: CHANGE_SELECT,
    });
    return record as FactChangeRecord;
  }

  async findChangeById(id: string): Promise<FactChangeDetailRecord | null> {
    const record = await this.run(
      () =>
        this.prisma.factChange.findUnique({
          where: { id },
          select: {
            ...CHANGE_SELECT,
            extractedFact: {
              select: {
                ...FACT_SELECT,
                source: { select: { id: true, name: true, url: true, authority: true } },
                snapshot: { select: { id: true, fetchedAt: true, contentHash: true } },
              },
            },
            reviewedBy: { select: { id: true, name: true } },
          },
        }),
      { resource: 'FactChange', identifier: id },
    );
    return record as FactChangeDetailRecord | null;
  }

  async listChanges(
    params: FactChangeListParams,
  ): Promise<{ items: FactChangeRecord[]; total: number }> {
    const where = whereAnd(
      when(params.status, (status) => ({ status })),
      when(params.risk, (risk) => ({ risk })),
      when(params.ownerId, (ownerId) => ({ ownerId })),
      when(params.factType, (factType) => ({ factType })),
    ) as Prisma.FactChangeWhereInput;

    const { skip, take } = toOffsetArgs(params.page, params.perPage);

    const [items, total] = await this.run(
      () =>
        this.prisma.$transaction([
          this.prisma.factChange.findMany({
            where,
            select: CHANGE_SELECT,
            // Worst first, then newest. A CRITICAL change three days old must
            // not sit below a LOW one from this morning.
            orderBy: [{ risk: 'asc' }, { createdAt: 'desc' }],
            skip,
            take,
          }),
          this.prisma.factChange.count({ where }),
        ]),
      { resource: 'FactChange' },
    );

    return { items: items as FactChangeRecord[], total };
  }

  async setChangeStatus(
    id: string,
    input: {
      status: string;
      reviewedById: string | null;
      decisionReason: string | null;
    },
    tx?: unknown,
  ): Promise<FactChangeRecord> {
    const client: Prisma.TransactionClient = tx ? asTx(tx) : this.prisma;
    const record = await client.factChange.update({
      where: { id },
      data: {
        status: input.status as never,
        reviewedById: input.reviewedById,
        reviewedAt: new Date(),
        decisionReason: input.decisionReason,
      },
      select: CHANGE_SELECT,
    });
    return record as FactChangeRecord;
  }

  // ── Canonical write (inside the approval transaction) ────────────────────

  /**
   * Applies an approved value to `ExamEvent`, creating the row if the cycle has
   * no event of that type yet.
   *
   * Takes the transaction handle from the service and never opens its own — the
   * canonical write, the decision record and the outbox row have to commit
   * together or the site ends up with a date nothing revalidated.
   */
  async applyToExamEvent(
    input: {
      eventId: string | null;
      examYearId: string;
      eventType: string;
      title: string;
      field: 'dateRange' | 'officialUrl';
      start: Date | null;
      end: Date | null;
      officialUrl: string | null;
      isTentative: boolean;
    },
    tx: unknown,
  ): Promise<{ eventId: string; updatedAt: Date }> {
    const client = asTx(tx);

    const data =
      input.field === 'officialUrl'
        ? { officialUrl: input.officialUrl }
        : { startDate: input.start, endDate: input.end, isTentative: input.isTentative };

    if (input.eventId) {
      const updated = await client.examEvent.update({
        where: { id: input.eventId },
        data,
        select: { id: true, updatedAt: true },
      });
      return { eventId: updated.id, updatedAt: updated.updatedAt };
    }

    const created = await client.examEvent.create({
      data: {
        examYearId: input.examYearId,
        type: input.eventType as never,
        title: input.title,
        ...data,
      },
      select: { id: true, updatedAt: true },
    });
    return { eventId: created.id, updatedAt: created.updatedAt };
  }

  /**
   * Re-reads the canonical row's version INSIDE the approval transaction.
   *
   * The stale check has to happen here, not against the value the list endpoint
   * returned, or two reviewers approving concurrently both pass their check and
   * the second silently overwrites the first.
   */
  async lockCanonicalVersion(
    eventId: string,
    tx: unknown,
  ): Promise<{ updatedAt: Date } | null> {
    const rows = await asTx(tx).$queryRaw<Array<{ updatedAt: Date }>>`
      SELECT "updatedAt" FROM "ExamEvent" WHERE id = ${eventId} FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** Marks every other pending change for the same fact as superseded. */
  async supersedeOthers(
    ownerId: string,
    factType: string,
    keepId: string,
    tx: unknown,
  ): Promise<number> {
    const result = await asTx(tx).factChange.updateMany({
      where: {
        ownerId,
        factType: factType as never,
        status: 'PENDING_REVIEW',
        NOT: { id: keepId },
      },
      data: { status: 'SUPERSEDED' },
    });
    return result.count;
  }

  runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  // ── Observability ────────────────────────────────────────────────────────

  /** Fact metrics, kept separate from the source metrics by design. */
  async metrics(): Promise<{
    observations: number;
    byStatus: Array<{ status: string; n: number }>;
    byRisk: Array<{ risk: string; n: number }>;
    pendingOldestAt: Date | null;
  }> {
    const [observations, byStatus, byRisk, oldest] = await this.run(
      () =>
        Promise.all([
          this.prisma.extractedFact.count(),
          this.prisma.factChange.groupBy({ by: ['status'], _count: { _all: true } }),
          this.prisma.factChange.groupBy({
            by: ['risk'],
            where: { status: 'PENDING_REVIEW' },
            _count: { _all: true },
          }),
          this.prisma.factChange.findFirst({
            where: { status: 'PENDING_REVIEW' },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          }),
        ]),
      { resource: 'FactChange' },
    );

    return {
      observations,
      byStatus: byStatus.map((r) => ({ status: r.status, n: r._count._all })),
      byRisk: byRisk.map((r) => ({ risk: r.risk, n: r._count._all })),
      pendingOldestAt: oldest?.createdAt ?? null,
    };
  }
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One cast, at the boundary, for the same reason as in exam.repository.ts: the
 * service passes the transaction handle around as `unknown` so it never has to
 * import Prisma.
 */
function asTx(tx: unknown): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}
