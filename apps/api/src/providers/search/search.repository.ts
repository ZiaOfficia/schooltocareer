import { Prisma, type PrismaClient } from '@stc/database';

import type { Locale, OwnerType } from '@stc/types';

import { BaseRepository } from '../../core/base/base.repository.js';

import type { SearchDocumentInput, SearchHit, SearchSuggestion } from './search.provider.js';

/**
 * SearchDocument persistence and the full-text queries.
 *
 * The FTS queries are raw SQL because Prisma cannot express `tsvector`,
 * `ts_rank_cd`, `ts_headline` or `websearch_to_tsquery`. Every value is
 * parameterised via Prisma.sql tagged templates — never string-interpolated.
 */
export class SearchRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async upsert(doc: SearchDocumentInput): Promise<void> {
    await this.run(
      () =>
        this.prisma.searchDocument.upsert({
          where: {
            siteId_ownerType_ownerId_locale: {
              siteId: doc.siteId,
              ownerType: doc.ownerType,
              ownerId: doc.ownerId,
              locale: doc.locale,
            },
          },
          create: {
            siteId: doc.siteId,
            ownerType: doc.ownerType,
            ownerId: doc.ownerId,
            locale: doc.locale,
            path: doc.path,
            title: doc.title,
            summary: doc.summary ?? null,
            body: doc.body ?? null,
            keywords: doc.keywords ?? [],
            entityLabel: doc.entityLabel,
            imageUrl: doc.imageUrl ?? null,
            // Prisma distinguishes "leave alone" (omit) from "set to JSON null"
            // (Prisma.JsonNull). Passing a bare `undefined` satisfies neither.
            facets: (doc.facets ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            popularity: doc.popularity ?? 0,
            boost: doc.boost ?? 1,
            publishedAt: doc.publishedAt ?? null,
            sourceHash: doc.sourceHash ?? null,
          },
          update: {
            path: doc.path,
            title: doc.title,
            summary: doc.summary ?? null,
            body: doc.body ?? null,
            keywords: doc.keywords ?? [],
            entityLabel: doc.entityLabel,
            imageUrl: doc.imageUrl ?? null,
            // Prisma distinguishes "leave alone" (omit) from "set to JSON null"
            // (Prisma.JsonNull). Passing a bare `undefined` satisfies neither.
            facets: (doc.facets ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            popularity: doc.popularity ?? 0,
            boost: doc.boost ?? 1,
            publishedAt: doc.publishedAt ?? null,
            sourceHash: doc.sourceHash ?? null,
            isActive: true,
            indexedAt: new Date(),
          },
        }),
      { resource: 'SearchDocument', identifier: doc.ownerId },
    );
  }

  /** Soft removal — keeps the row so a republish is an update, not an insert. */
  async deactivate(ownerType: OwnerType, ownerId: string, locale?: Locale): Promise<void> {
    await this.run(
      () =>
        this.prisma.searchDocument.updateMany({
          where: { ownerType, ownerId, ...(locale ? { locale } : {}) },
          data: { isActive: false },
        }),
      { resource: 'SearchDocument', identifier: ownerId },
    );
  }

  /** Returns the stored hash so the indexer can skip no-op reindexes. */
  async getSourceHash(
    siteId: string,
    ownerType: OwnerType,
    ownerId: string,
    locale: Locale,
  ): Promise<string | null> {
    const row = await this.run(
      () =>
        this.prisma.searchDocument.findUnique({
          where: { siteId_ownerType_ownerId_locale: { siteId, ownerType, ownerId, locale } },
          select: { sourceHash: true },
        }),
      { resource: 'SearchDocument', identifier: ownerId },
    );
    return row?.sourceHash ?? null;
  }

  /**
   * Ranked full-text search.
   *
   * `websearch_to_tsquery` accepts what users actually type — quoted phrases,
   * OR, leading minus — instead of erroring on the punctuation that
   * `to_tsquery` rejects.
   *
   * Ranking blends three things: lexical relevance (ts_rank_cd, weighted
   * A/B/C/D by the generated column), editorial boost, and popularity. Pure
   * lexical ranking puts an obscure 2011 paper above the JEE Main hub page.
   */
  async search(params: {
    siteId: string;
    query: string;
    locale: Locale;
    entityLabels?: readonly string[];
    limit: number;
    offset: number;
  }): Promise<{ hits: SearchHit[]; total: number }> {
    const config = params.locale === 'HI' ? 'simple' : 'english';
    const labelFilter = params.entityLabels?.length
      ? Prisma.sql`AND "entityLabel" = ANY(${params.entityLabels as string[]})`
      : Prisma.empty;

    const rows = await this.run(
      () => this.prisma.$queryRaw<Array<SearchHit & { total: bigint }>>`
        WITH q AS (
          SELECT websearch_to_tsquery(${config}::regconfig, ${params.query}) AS tsq
        )
        SELECT
          d."ownerType"   AS "ownerType",
          d."ownerId"     AS "ownerId",
          d.path          AS path,
          d.title         AS title,
          d.summary       AS summary,
          d."entityLabel" AS "entityLabel",
          d."imageUrl"    AS "imageUrl",
          ts_headline(
            ${config}::regconfig,
            coalesce(d.summary, left(coalesce(d.body, ''), 600)),
            q.tsq,
            'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=32, MinWords=12'
          ) AS highlight,
          (
            ts_rank_cd(d."searchVector", q.tsq, 32) * d.boost
            + least(d.popularity::float / 10000, 0.5)
          ) AS score,
          count(*) OVER () AS total
        FROM "SearchDocument" d, q
        WHERE d."siteId" = ${params.siteId}
          AND d."isActive" = true
          AND d.locale = ${params.locale}::"Locale"
          AND d."searchVector" @@ q.tsq
          ${labelFilter}
        ORDER BY score DESC, d."publishedAt" DESC NULLS LAST
        LIMIT ${params.limit} OFFSET ${params.offset}
      `,
      { resource: 'SearchDocument' },
    );

    return {
      hits: rows.map(({ total: _total, ...hit }) => hit),
      total: rows.length > 0 ? Number(rows[0]!.total) : 0,
    };
  }

  /**
   * Typo-tolerant autocomplete via trigram similarity — `%` uses the GIN
   * index, unlike `ILIKE '%term%'` which cannot.
   */
  async suggest(params: {
    siteId: string;
    prefix: string;
    locale: Locale;
    limit: number;
  }): Promise<SearchSuggestion[]> {
    return this.run(
      () => this.prisma.$queryRaw<SearchSuggestion[]>`
        SELECT title, path, "entityLabel"
          FROM "SearchDocument"
         WHERE "siteId" = ${params.siteId}
           AND "isActive" = true
           AND locale = ${params.locale}::"Locale"
           AND (title ILIKE ${params.prefix + '%'} OR title % ${params.prefix})
         ORDER BY
           (title ILIKE ${params.prefix + '%'}) DESC,
           similarity(title, ${params.prefix}) DESC,
           popularity DESC
         LIMIT ${params.limit}
      `,
      { resource: 'SearchDocument' },
    );
  }

  /**
   * Records what was searched for.
   *
   * Zero-result queries are the highest-signal content backlog on the site:
   * they are demand, in the users own words, that the site failed to meet.
   */
  async logQuery(params: {
    rawQuery: string;
    normalizedQuery: string;
    resultCount: number;
    locale?: 'EN' | 'HI';
    clickedPath?: string | null;
  }): Promise<void> {
    await this.run(
      () =>
        this.prisma.searchQueryLog.create({
          data: {
            rawQuery: params.rawQuery.slice(0, 300),
            normalizedQuery: params.normalizedQuery.slice(0, 300),
            resultCount: params.resultCount,
            locale: params.locale ?? 'EN',
            clickedPath: params.clickedPath ?? null,
          },
        }),
      { resource: 'SearchQueryLog' },
    );
  }

  async topQueries(days: number, limit: number): Promise<Array<{ query: string; searches: number }>> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.run(
      () => this.prisma.$queryRaw<Array<{ query: string; searches: bigint }>>`
        SELECT "normalizedQuery" AS query, count(*) AS searches
          FROM "SearchQueryLog"
         WHERE "createdAt" >= ${since} AND "resultCount" > 0
         GROUP BY "normalizedQuery"
         ORDER BY searches DESC
         LIMIT ${limit}
      `,
      { resource: 'SearchQueryLog' },
    );
    return rows.map((row) => ({ query: row.query, searches: Number(row.searches) }));
  }

  /** Searches that returned nothing. The editorial to-do list. */
  async zeroResultQueries(days: number, limit: number): Promise<Array<{ query: string; searches: number }>> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.run(
      () => this.prisma.$queryRaw<Array<{ query: string; searches: bigint }>>`
        SELECT "normalizedQuery" AS query, count(*) AS searches
          FROM "SearchQueryLog"
         WHERE "createdAt" >= ${since} AND "resultCount" = 0
         GROUP BY "normalizedQuery"
        HAVING count(*) > 1
         ORDER BY searches DESC
         LIMIT ${limit}
      `,
      { resource: 'SearchQueryLog' },
    );
    return rows.map((row) => ({ query: row.query, searches: Number(row.searches) }));
  }

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
