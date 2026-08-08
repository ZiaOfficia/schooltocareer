#!/usr/bin/env tsx
/**
 * Architectural regression checks.
 *
 * Tests prove behaviour; these prove STRUCTURE. They are the metrics that
 * quietly decay as a codebase grows, because no individual PR looks like it
 * breaks them — a service importing Prisma "just this once" is a two-line diff.
 *
 * Run: pnpm arch:check      (CI fails the build on any violation)
 *
 * Deliberately dependency-free: regex and fs over the TypeScript compiler API.
 * A check that takes 400ms and always runs beats a perfect one that gets
 * skipped because it is slow.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

type Violation = { metric: string; file: string; line: number; detail: string };

const violations: Violation[] = [];
const counts = new Map<string, number>();

function record(metric: string, file: string, line: number, detail: string): void {
  violations.push({ metric, file, line, detail });
}
function bump(metric: string): void {
  counts.set(metric, (counts.get(metric) ?? 0) + 1);
}

// ── File walking ────────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', 'generated', '.git']);

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(full)) yield full;
  }
}

const files = [...walk(join(ROOT, 'apps')), ...walk(join(ROOT, 'packages'))];
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, '/');

type SourceFile = { path: string; rel: string; text: string; lines: string[] };

const sources: SourceFile[] = files.map((path) => {
  const text = readFileSync(path, 'utf8');
  return { path, rel: rel(path), text, lines: text.split(/\r?\n/) };
});

const IMPORT_RE = /^\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s*from\s+['"]([^'"]+)['"]/;

function importsOf(file: SourceFile): Array<{ spec: string; line: number }> {
  const out: Array<{ spec: string; line: number }> = [];
  file.lines.forEach((text, i) => {
    const match = IMPORT_RE.exec(text);
    if (match?.[1]) out.push({ spec: match[1], line: i + 1 });
  });
  return out;
}

// ── Metric 1: repository methods returning Prisma types ─────────────────────
// Prisma may be imported only by *.repository.ts, core/base/**, prisma/seed/**
// and test files. Everything else goes through the repository layer.

const PRISMA_SPECS = /^(@stc\/database|@prisma\/client|\.prisma\/client)$/;
// `container.ts` is the composition root: it is the one place that constructs
// the PrismaClient and hands it to repositories. Allow-listing it is the point
// of having a composition root, not an exception to the rule.
const PRISMA_ALLOWED =
  /(\.repository\.ts$|\/repositories\/|\/core\/base\/|\/prisma\/seed\/|\/src\/client\.ts$|\/src\/index\.ts$|\/container\.ts$|\.test\.ts$)/;

counts.set('prisma-leaks', 0);
for (const file of sources) {
  if (!file.rel.startsWith('apps/api/src') && !file.rel.startsWith('packages/database')) continue;
  if (PRISMA_ALLOWED.test(file.rel)) continue;

  for (const { spec, line } of importsOf(file)) {
    if (PRISMA_SPECS.test(spec)) {
      bump('prisma-leaks');
      record('prisma-leaks', file.rel, line, `imports ${spec} outside the repository layer`);
    }
  }
}

// ── Metric 2: layer violations ──────────────────────────────────────────────
// controller -> service -> repository. A controller reaching a repository
// directly skips every business rule, cache and event the service owns.

counts.set('layer-violations', 0);
for (const file of sources) {
  const isController = /\.controller\.ts$/.test(file.rel);
  const isRoutes = /\.routes\.ts$/.test(file.rel);
  if (!isController && !isRoutes) continue;

  for (const { spec, line } of importsOf(file)) {
    if (/\.repository\.js$/.test(spec)) {
      bump('layer-violations');
      record(
        'layer-violations',
        file.rel,
        line,
        `${isController ? 'controller' : 'route'} imports a repository directly`,
      );
    }
  }
}

// The web/admin apps must never touch the database.
for (const file of sources) {
  if (!/^apps\/(web|admin)\//.test(file.rel)) continue;
  for (const { spec, line } of importsOf(file)) {
    if (PRISMA_SPECS.test(spec)) {
      bump('layer-violations');
      record('layer-violations', file.rel, line, 'frontend app imports the database directly');
    }
  }
}

// ── Metric 3: cross-feature imports ─────────────────────────────────────────
// modules/exam must not reach into modules/board. Shared behaviour is promoted
// to core/ or a workspace package. Genuinely shared modules are allow-listed.

const SHARED_MODULES = new Set(['slug', 'revision', 'draft', 'health']);
const MODULE_RE = /^apps\/api\/src\/modules\/([^/]+)\//;

counts.set('cross-module-imports', 0);
for (const file of sources) {
  const owner = MODULE_RE.exec(file.rel)?.[1];
  if (!owner) continue;

  for (const { spec, line } of importsOf(file)) {
    if (!spec.startsWith('.')) continue;

    // Resolve the specifier against the importing file rather than pattern
    // matching it. `../../core/x` looks like a sibling module to a naive regex,
    // which produced a wall of false positives on the first run.
    const resolved = relative(ROOT, resolve(dirname(file.path), spec)).replace(/\\/g, '/');
    const target = MODULE_RE.exec(`${resolved}/`)?.[1];

    if (!target || target === owner) continue;
    if (SHARED_MODULES.has(target)) continue;

    bump('cross-module-imports');
    record('cross-module-imports', file.rel, line, `modules/${owner} imports modules/${target}`);
  }
}

// ── Metric 4: circular dependencies ─────────────────────────────────────────
// Iterative DFS over the local import graph.

counts.set('circular-deps', 0);
const graph = new Map<string, string[]>();
const byPath = new Map(sources.map((f) => [f.path.replace(/\\/g, '/'), f]));

function resolveLocal(from: SourceFile, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(from.path), spec).replace(/\\/g, '/');
  for (const candidate of [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    `${base}.ts`,
    `${base}/index.ts`,
  ]) {
    if (byPath.has(candidate)) return candidate;
  }
  return null;
}

for (const file of sources) {
  const key = file.path.replace(/\\/g, '/');
  graph.set(
    key,
    importsOf(file)
      .map(({ spec }) => resolveLocal(file, spec))
      .filter((v): v is string => v !== null),
  );
}

const WHITE = 0, GREY = 1, BLACK = 2;
const colour = new Map<string, number>();
const cycles: string[][] = [];

for (const start of graph.keys()) {
  if (colour.get(start) === BLACK) continue;
  const stack: Array<{ node: string; index: number }> = [{ node: start, index: 0 }];
  const path: string[] = [];
  colour.set(start, GREY);
  path.push(start);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    const children = graph.get(frame.node) ?? [];

    if (frame.index >= children.length) {
      colour.set(frame.node, BLACK);
      stack.pop();
      path.pop();
      continue;
    }

    const child = children[frame.index++]!;
    const state = colour.get(child) ?? WHITE;

    if (state === GREY) {
      const at = path.indexOf(child);
      cycles.push([...path.slice(at), child].map((p) => rel(p)));
      continue;
    }
    if (state === WHITE) {
      colour.set(child, GREY);
      path.push(child);
      stack.push({ node: child, index: 0 });
    }
  }
}

for (const cycle of dedupeCycles(cycles)) {
  bump('circular-deps');
  record('circular-deps', cycle[0] ?? '?', 0, cycle.join(' -> '));
}

function dedupeCycles(all: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const cycle of all) {
    const key = [...cycle].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cycle);
  }
  return out;
}

/**
 * Returns a call's argument text, following it across lines until the
 * parentheses balance.
 *
 * The previous version took a fixed 12-line window and cut it at the first
 * `');'`. Any call formatted across more lines than that reported a FALSE
 * violation — and did so silently, because when the window contained no `');'`
 * the whole window became the argument text and the `tx` test simply failed.
 * AuditHandler.handle passes `tx` on line 49 of a call that opens on line 34,
 * so the one handler this metric exists to police was the one it misjudged.
 *
 * String literals are tracked so a paren inside a message cannot unbalance the
 * scan; `//` ends the line. Not a parser, but the failure mode is now a missed
 * violation rather than an invented one.
 */
function callArguments(lines: readonly string[], line: number, col: number): string {
  let depth = 0;
  let quote: string | null = null;
  let out = '';

  for (let i = line; i < lines.length; i++) {
    const text = lines[i] ?? '';
    for (let j = i === line ? col : 0; j < text.length; j++) {
      const ch = text[j]!;

      if (quote) {
        out += ch;
        if (ch === quote && text[j - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        out += ch;
        continue;
      }
      if (text.startsWith('//', j)) break;

      if (ch === '(') {
        depth++;
        if (depth === 1) continue; // skip the call's own opening paren
      } else if (ch === ')') {
        depth--;
        if (depth === 0) return out;
      }
      out += ch;
    }
    out += '\n';
  }
  return out;
}

// ── Metric 5: event handlers writing outside a transaction ──────────────────
// In-transaction handlers (core/events/handlers) must thread `tx` into every
// write. A handler calling a repository without it commits separately from the
// domain write, which is precisely what the outbox pattern exists to prevent.

counts.set('untransacted-handler-writes', 0);
for (const file of sources) {
  if (!/^apps\/api\/src\/core\/events\/handlers\//.test(file.rel)) continue;

  file.lines.forEach((text, i) => {
    const call = /await this\.(\w+)\.(publish|append|create|update|upsert|recordChange)\(/.exec(text);
    if (!call) return;

    const args = callArguments(file.lines, i, call.index + call[0].length - 1);

    if (!/\btx\b/.test(args)) {
      bump('untransacted-handler-writes');
      record(
        'untransacted-handler-writes',
        file.rel,
        i + 1,
        `${call[1]}.${call[2]}() does not receive the transaction handle`,
      );
    }
  });
}

// ── Report ──────────────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  'circular-deps': 'Circular dependencies',
  'layer-violations': 'Layer violations',
  'prisma-leaks': 'Prisma imports outside repositories',
  'cross-module-imports': 'Feature modules importing each other',
  'untransacted-handler-writes': 'Handler writes outside a transaction',
};

console.log(`\nArchitecture metrics  (${sources.length} source files)\n`);

let failed = false;
for (const [metric, label] of Object.entries(LABELS)) {
  const count = counts.get(metric) ?? 0;
  if (count > 0) failed = true;
  console.log(`  ${count === 0 ? 'PASS' : 'FAIL'}  ${label.padEnd(42)} ${count}`);
}

if (violations.length > 0) {
  console.log('\nViolations:\n');
  for (const v of violations) {
    console.log(`  [${v.metric}] ${v.file}${v.line ? `:${v.line}` : ''}`);
    console.log(`      ${v.detail}`);
  }
}

console.log('');
process.exit(failed ? 1 : 0);
