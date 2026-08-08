import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Workspace packages export TypeScript source whose relative imports carry
    // `.js` extensions; Vite cannot follow those through node_modules symlinks.
    // Pointing it at the entry files is the standard fix for source-exported
    // internal packages.
    alias: {
      '@stc/types': pkg('types'),
      '@stc/constants': pkg('constants'),
      '@stc/validation': pkg('validation'),
      '@stc/utils': pkg('utils'),
      '@stc/config': pkg('config'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Services are tested with fakes: no database, no container, no setup file.
    // A test that needs any of those belongs in tests/integration.
    reporters: 'default',
  },
});
