import { defineConfig } from 'tsup';

/**
 * The API is BUNDLED for production.
 *
 * Workspace packages are consumed as TypeScript source — no build step, no
 * stale dist, no project references to keep in sync. The cost is that `tsc`
 * alone cannot emit the app, because those files sit outside its rootDir.
 * Bundling sidesteps that and hands Render a single file to run.
 *
 * `@prisma/client` stays external: it loads a platform-specific query engine
 * binary at runtime that must not be inlined. `pino-pretty` is external because
 * it is a dev-only transport resolved lazily by name.
 */
export default defineConfig({
  entry: ['src/server.ts', 'src/workers/worker.ts'],
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Workspace packages ship TypeScript source, so they MUST be bundled — left
  // external, Node would try to resolve `./roles.js` next to a `.ts` file at
  // runtime and fail.
  noExternal: [/^@stc\//],
  external: ['@prisma/client', '.prisma/client', 'pino-pretty'],
});
