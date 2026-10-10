import { API_ROUTES, CACHE_TAGS } from '@stc/constants';

import { serverEnv } from '@/lib/env';

/**
 * The server-side API client.
 *
 * Only Server Components call this. The browser never talks to the API
 * directly, which means the API host is not a public constant, CORS stays
 * narrow, and every response is cacheable at the Next layer with a tag the
 * backend already knows how to invalidate.
 *
 * Cache strategy: long `revalidate` plus tag-based invalidation. The outbox
 * worker fires CACHE_REVALIDATE on publish, so pages update within seconds of
 * an edit rather than waiting out a TTL. The TTL is only the backstop for a
 * webhook that never arrived.
 */

const BASE_URL = serverEnv().API_BASE_URL ?? 'http://localhost:4000';

/** One hour. Correctness comes from tag invalidation, not from this number. */
const DEFAULT_REVALIDATE = 3600;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApiError';
  }

  /** 503 means we never reached the API — distinct from anything it replied. */
  get unreachable(): boolean {
    return this.status === 503;
  }
}

type FetchOptions = {
  tags?: readonly string[];
  revalidate?: number;
  /** Set for genuinely per-request data. Almost nothing here qualifies. */
  noStore?: boolean;
};

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetchOnce(url, options);
  } catch (cause) {
    // A refused connection or DNS failure is not a 404. Surfacing it as 503
    // keeps it distinguishable from "this page does not exist", which matters:
    // a listing may safely degrade to empty, but a sitemap must never quietly
    // become empty, because an empty sitemap deindexes the site.
    throw new ApiError(503, path, `GET ${path} could not reach the API at ${BASE_URL}`, {
      cause,
    });
  }

  if (!response.ok) {
    // The FULL url, not the path. When this surfaces in a Vercel log the first
    // question is always "which API did it call" — a wrong or missing
    // API_BASE_URL is indistinguishable from a broken endpoint otherwise.
    throw new ApiError(response.status, path, `GET ${url} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function fetchOnce(url: string, options: FetchOptions): Promise<Response> {
  return fetch(url, {
    headers: { accept: 'application/json' },
    // `tags` is spread conditionally rather than set to undefined:
    // exactOptionalPropertyTypes distinguishes "absent" from "present and
    // undefined", and Next's RequestInit declares `tags: string[]`, not
    // `string[] | undefined`.
    ...(options.noStore
      ? { cache: 'no-store' as const }
      : {
          next: {
            revalidate: options.revalidate ?? DEFAULT_REVALIDATE,
            ...(options.tags ? { tags: [...options.tags] } : {}),
          },
        }),
  });
}

/**
 * Returns null instead of throwing on 404, so a page can render notFound()
 * without a try/catch at every call site. Any other failure still throws —
 * a 500 must not be silently rendered as "this exam does not exist", because
 * that would let a backend outage delete pages from the index.
 */
async function requestOptional<T>(path: string, options: FetchOptions = {}): Promise<T | null> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The API wraps payloads as `{ data, meta }`. */
type Envelope<T> = { data: T; meta?: Record<string, unknown> };

export async function getExam<T>(slug: string): Promise<T | null> {
  const result = await requestOptional<Envelope<T>>(API_ROUTES.exam(slug), {
    tags: [CACHE_TAGS.entity('EXAM', slug)],
  });
  return result?.data ?? null;
}

export async function listExams<T>(query = ''): Promise<T[]> {
  const result = await requestOptional<Envelope<T[]>>(
    `${API_ROUTES.exams}${query ? `?${query}` : ''}`,
    { tags: [CACHE_TAGS.entityList('EXAM')] },
  );
  return result?.data ?? [];
}

export async function listPapers<T>(query = ''): Promise<T[]> {
  const result = await requestOptional<Envelope<T[]>>(
    `${API_ROUTES.papers}${query ? `?${query}` : ''}`,
    { tags: [CACHE_TAGS.entityList('QUESTION_PAPER')] },
  );
  return result?.data ?? [];
}

/** The API caps a page at 100 rows (PAGINATION.MAX_PER_PAGE). */
const PAPERS_PER_PAGE = 100;

/**
 * Every published paper matching `query`, not just the first page.
 *
 * An exam with two sessions and two shifts a day passes 100 papers in a few
 * years, so one request cannot hold them. `maxPages` bounds the loop: a wrong
 * `totalPages` from the API must not turn a page render into a crawl.
 */
export async function listAllPapers<T>(query = '', maxPages = 5): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await requestOptional<Envelope<T[]>>(
      `${API_ROUTES.papers}?perPage=${PAPERS_PER_PAGE}&page=${page}${query ? `&${query}` : ''}`,
      { tags: [CACHE_TAGS.entityList('QUESTION_PAPER')] },
    );
    all.push(...(result?.data ?? []));
    if (!result?.meta?.hasNext) break;
  }
  return all;
}

/**
 * How many published papers and results exist for one exam — the two numbers
 * that decide whether those sections are pages or dead ends.
 *
 * One row each, read for its `meta.total`. A failed count is treated as zero:
 * hiding a section for an hour is a smaller mistake than linking to an empty one.
 */
export async function examHoldings(examId: string): Promise<{ papers: number; results: number }> {
  const total = async (route: string, tag: string): Promise<number> => {
    try {
      const result = await requestOptional<Envelope<unknown[]>>(
        `${route}?perPage=1&examId=${encodeURIComponent(examId)}`,
        { tags: [tag] },
      );
      const value = result?.meta?.total;
      return typeof value === 'number' ? value : 0;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return 0;
    }
  };

  const [papers, results] = await Promise.all([
    total(API_ROUTES.papers, CACHE_TAGS.entityList('QUESTION_PAPER')),
    total(API_ROUTES.results, CACHE_TAGS.entityList('RESULT')),
  ]);
  return { papers, results };
}

export async function getPaper<T>(slug: string): Promise<T | null> {
  const result = await requestOptional<Envelope<T>>(API_ROUTES.paper(slug), {
    tags: [CACHE_TAGS.entity('QUESTION_PAPER', slug)],
  });
  return result?.data ?? null;
}

export async function listBoards<T>(query = ''): Promise<T[]> {
  const result = await requestOptional<Envelope<T[]>>(
    `${API_ROUTES.boards}${query ? `?${query}` : ''}`,
    { tags: [CACHE_TAGS.entityList('BOARD')] },
  );
  return result?.data ?? [];
}

export async function listResults<T>(query = ''): Promise<T[]> {
  const result = await requestOptional<Envelope<T[]>>(
    `${API_ROUTES.results}${query ? `?${query}` : ''}`,
    { tags: [CACHE_TAGS.entityList('RESULT')] },
  );
  return result?.data ?? [];
}

export async function listPosts<T>(query = ''): Promise<T[]> {
  const result = await requestOptional<Envelope<T[]>>(
    `${API_ROUTES.posts}${query ? `?${query}` : ''}`,
    { tags: [CACHE_TAGS.entityList('CONTENT_ENTRY')] },
  );
  return result?.data ?? [];
}

export async function search<T>(query: string): Promise<T | null> {
  const result = await requestOptional<Envelope<T>>(
    `${API_ROUTES.search}?q=${encodeURIComponent(query)}`,
    // Search results are per-query and not worth a tag; a short TTL absorbs
    // repeated identical queries during a traffic spike without going stale.
    { revalidate: 60 },
  );
  return result?.data ?? null;
}
