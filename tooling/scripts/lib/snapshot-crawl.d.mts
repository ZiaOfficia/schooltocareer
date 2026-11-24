/** Types for snapshot-crawl.mjs, which stays plain JavaScript so it can also run in a browser. */
export function crawlSnapshot(
  get: (path: string) => Promise<unknown>,
  log?: (stage: string) => void,
): Promise<Record<string, unknown> & { questions: Record<string, Record<string, unknown> | null> }>;
