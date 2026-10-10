import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { serverEnv } from '@/lib/env';

/**
 * The receiving end of CACHE_REVALIDATE.
 *
 * The outbox worker has been POSTing here since the cache layer was built, and
 * this route did not exist — so every revalidation event 4xx'd and went to the
 * dead-letter queue. Pages only ever updated when their one-hour TTL expired,
 * which is the backstop, not the mechanism.
 *
 * That gap had teeth. When the placeholder-data purge ran, exam pages rendered
 * during the deploy window kept serving `example.test` as the official link
 * with no way to flush them, because the flush endpoint was missing.
 *
 * Contract, set by `CacheRevalidateHandler`:
 *   POST /api/revalidate
 *   X-Revalidate-Secret: <shared secret>
 *   { "tags": ["exam:jee-main", ...], "paths": ["/exams", ...] }
 *
 * Tags are the primary mechanism — `lib/api.ts` tags every fetch with the same
 * CACHE_TAGS strings the API uses, so one tag invalidates every page that read
 * that entity. Paths are the escape hatch for routes whose data is not fetched
 * through a tagged request, such as the sitemap.
 */

export const dynamic = 'force-dynamic';

/** Rejects rather than accepts when the secret is not configured. */
function authorised(request: Request): boolean {
  const expected = serverEnv().REVALIDATE_SECRET;
  if (!expected) return false;

  const provided = request.headers.get('x-revalidate-secret');
  if (!provided || provided.length !== expected.length) return false;

  // Constant-time-ish compare. Node's timingSafeEqual is unavailable on the
  // edge runtime, and length is already checked above, so XOR-accumulate.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!serverEnv().REVALIDATE_SECRET) {
    // Loud, because the symptom otherwise is "content is stale sometimes",
    // which nobody traces back to a missing environment variable.
    console.error(
      '[revalidate] REVALIDATE_SECRET is not set on this deployment — ' +
        'every revalidation request will be rejected and pages will only ' +
        'update when their TTL expires.',
    );
  }

  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const tags = asStringArray(payload['tags']);
  const paths = asStringArray(payload['paths']);

  if (tags.length === 0 && paths.length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing to revalidate' }, { status: 400 });
  }

  for (const tag of tags) revalidateTag(tag);
  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ ok: true, revalidated: { tags: tags.length, paths: paths.length } });
}
