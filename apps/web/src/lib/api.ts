import { API_ROUTES, CACHE_TAGS } from '@stc/constants';

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

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

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
    throw new ApiError(response.status, path, `GET ${path} failed with ${response.status}`);
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

export async function search<T>(query: string): Promise<T | null> {
  const result = await requestOptional<Envelope<T>>(
    `${API_ROUTES.search}?q=${encodeURIComponent(query)}`,
    // Search results are per-query and not worth a tag; a short TTL absorbs
    // repeated identical queries during a traffic spike without going stale.
    { revalidate: 60 },
  );
  return result?.data ?? null;
}
