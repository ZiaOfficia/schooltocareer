import { PrismaClient, type FetchOutcome, type Prisma } from '@prisma/client';

/**
 * The only place ingestion touches Prisma.
 *
 * `arch:check` enforces that no Prisma type escapes a repository, which is why
 * every method here returns plain records and takes plain arguments.
 */

export type DueSource = {
  id: string;
  name: string;
  authority: string;
  url: string;
  kind: string;
  robotsAllowed: boolean | null;
  robotsCheckedAt: Date | null;
  etag: string | null;
  lastModified: string | null;
  lastHash: string | null;
  consecutiveFailures: number;
};

export type SnapshotInput = {
  sourceId: string;
  outcome: FetchOutcome;
  httpStatus?: number | null;
  durationMs?: number | null;
  contentHash?: string | null;
  contentType?: string | null;
  contentBytes?: number | null;
  etag?: string | null;
  lastModified?: string | null;
  rawContent?: string | null;
  rawTruncated?: boolean;
  error?: string | null;
};

/** Past this many consecutive failures a source is demoted to FAILING. */
const FAILING_THRESHOLD = 5;

export class SourceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Sources whose next poll is due.
   *
   * "Due" is computed in SQL from each source's own cadence rather than a
   * single global interval — a results page during declaration week and an
   * eligibility page that changes annually should not share a clock.
   *
   * FAILING sources are still polled, at four times their cadence. Dropping
   * them entirely means never noticing when a site comes back.
   */
  async findDue(limit: number, now: Date = new Date()): Promise<DueSource[]> {
    return this.prisma.$queryRaw<DueSource[]>`
      SELECT id, name, authority, url, kind::text AS kind,
             "robotsAllowed", "robotsCheckedAt", etag, "lastModified",
             "lastHash", "consecutiveFailures"
        FROM "Source"
       WHERE status IN ('ACTIVE', 'FAILING')
         AND (
           "lastFetchedAt" IS NULL
           OR "lastFetchedAt" < ${now} - (
                "cadenceMinutes" * (CASE WHEN status = 'FAILING' THEN 4 ELSE 1 END)
              ) * INTERVAL '1 minute'
         )
       ORDER BY "lastFetchedAt" ASC NULLS FIRST
       LIMIT ${limit}
    `;
  }

  /**
   * Writes the snapshot and updates the source's denormalised state in ONE
   * transaction.
   *
   * They must not diverge: a snapshot without the matching `lastHash` would
   * make the next fetch report a spurious change, and a `lastFetchedAt` without
   * a snapshot would silently lose an attempt from the very dataset this phase
   * exists to collect.
   */
  async recordFetch(input: SnapshotInput): Promise<void> {
    const succeeded =
      input.outcome === 'CHANGED' ||
      input.outcome === 'UNCHANGED' ||
      input.outcome === 'NOT_MODIFIED';

    await this.prisma.$transaction(async (tx) => {
      await tx.sourceSnapshot.create({
        data: {
          sourceId: input.sourceId,
          outcome: input.outcome,
          httpStatus: input.httpStatus ?? null,
          durationMs: input.durationMs ?? null,
          contentHash: input.contentHash ?? null,
          contentType: input.contentType ?? null,
          contentBytes: input.contentBytes ?? null,
          etag: input.etag ?? null,
          lastModified: input.lastModified ?? null,
          rawContent: input.rawContent ?? null,
          rawTruncated: input.rawTruncated ?? false,
          error: input.error ?? null,
        },
      });

      const data: Prisma.SourceUpdateInput = {
        lastFetchedAt: new Date(),
        lastOutcome: input.outcome,
        consecutiveFailures: succeeded ? 0 : { increment: 1 },
      };

      // Only a body we actually read may advance the hash. NOT_MODIFIED means
      // the server told us nothing changed, so the existing hash still stands.
      if (input.outcome === 'CHANGED' && input.contentHash) {
        data.lastHash = input.contentHash;
      }
      if (input.etag !== undefined) data.etag = input.etag;
      if (input.lastModified !== undefined) data.lastModified = input.lastModified;

      await tx.source.update({ where: { id: input.sourceId }, data });

      if (!succeeded) {
        // Demote only past the threshold — a single timeout is noise, not a
        // dead source.
        await tx.source.updateMany({
          where: {
            id: input.sourceId,
            status: 'ACTIVE',
            consecutiveFailures: { gte: FAILING_THRESHOLD },
          },
          data: { status: 'FAILING' },
        });
      } else {
        await tx.source.updateMany({
          where: { id: input.sourceId, status: 'FAILING' },
          data: { status: 'ACTIVE' },
        });
      }
    });
  }

  async recordRobots(sourceId: string, allowed: boolean): Promise<void> {
    await this.prisma.source.update({
      where: { id: sourceId },
      data: { robotsAllowed: allowed, robotsCheckedAt: new Date() },
    });
  }

  /** Idempotent upsert so the watch list can be re-seeded from a file. */
  async upsertMany(
    siteId: string,
    rows: ReadonlyArray<{
      name: string;
      authority: string;
      url: string;
      kind: string;
      cadenceMinutes: number;
    }>,
  ): Promise<number> {
    for (const row of rows) {
      await this.prisma.source.upsert({
        where: { siteId_url: { siteId, url: row.url } },
        // Cadence and labels are editable in the admin later, so an update must
        // not stamp on them. Only identity is asserted here.
        update: { name: row.name, authority: row.authority },
        create: {
          siteId,
          name: row.name,
          authority: row.authority,
          url: row.url,
          kind: row.kind as never,
          cadenceMinutes: row.cadenceMinutes,
        },
      });
    }
    return rows.length;
  }

  /** The Phase 0 deliverable: change cadence per source. */
  async changeReport(): Promise<
    Array<{ authority: string; name: string; fetches: bigint; changes: bigint; failures: bigint }>
  > {
    return this.prisma.$queryRaw`
      SELECT s.authority,
             s.name,
             count(*)                                        AS fetches,
             count(*) FILTER (WHERE sn.outcome = 'CHANGED')  AS changes,
             count(*) FILTER (WHERE sn.outcome IN ('HTTP_ERROR','NETWORK_ERROR')) AS failures
        FROM "Source" s
        JOIN "SourceSnapshot" sn ON sn."sourceId" = s.id
       GROUP BY s.authority, s.name
       ORDER BY changes DESC, s.authority
    `;
  }
}
