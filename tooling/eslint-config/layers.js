/**
 * Architectural boundaries, enforced by the linter.
 *
 * A rule nobody checks is a convention, and conventions decay. These are the
 * three that matter most; violating them is a build failure, not a code-review
 * comment.
 */

const PRISMA_IMPORTS = ['@stc/database', '@prisma/client', '.prisma/client'];

/** Files permitted to import Prisma at all. */
const REPOSITORY_GLOBS = [
  '**/*.repository.ts',
  '**/repositories/**/*.ts',
  '**/infra/prisma/**/*.ts',
  '**/core/base/**/*.ts',
  '**/prisma/seed/**/*.ts',
  '**/src/extensions/**/*.ts',
  '**/*.test.ts',
  '**/*.spec.ts',
];

module.exports = {
  overrides: [
    // ---------------------------------------------------------------------
    // RULE 1 — No Prisma query ever leaves the repository layer.
    //
    //   Controller -> Service -> Repository -> Prisma
    //
    // Never Controller -> Prisma, never Service -> Prisma. This is what keeps
    // caching, testing, auditing and a future data-source swap tractable.
    // ---------------------------------------------------------------------
    {
      files: ['apps/api/src/**/*.ts'],
      excludedFiles: REPOSITORY_GLOBS,
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: PRISMA_IMPORTS.map((name) => ({
              name,
              message:
                'Prisma may only be imported from a *.repository.ts file. ' +
                'Controllers and services must go through the repository layer.',
            })),
            patterns: [
              {
                group: ['**/generated/client/**'],
                message: 'Import Prisma types from @stc/database, and only inside a repository.',
              },
            ],
          },
        ],
      },
    },

    // ---------------------------------------------------------------------
    // RULE 2 — The Next.js app never touches the database.
    // It talks HTTP to the API. One source of truth for business rules.
    // ---------------------------------------------------------------------
    {
      files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: PRISMA_IMPORTS.map((name) => ({
              name,
              message:
                'The web/admin apps must not query the database directly. ' +
                'Call the REST API through lib/api instead.',
            })),
          },
        ],
      },
    },

    // ---------------------------------------------------------------------
    // RULE 3 — No cross-feature imports.
    // features/exam must not reach into features/board. Share via
    // src/components or a workspace package.
    // ---------------------------------------------------------------------
    {
      files: ['apps/web/src/features/*/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/features/*/**'],
                message:
                  'Cross-feature imports are not allowed. Promote the shared piece to ' +
                  'src/components (domain-agnostic) or a workspace package.',
              },
            ],
          },
        ],
      },
    },

    // ---------------------------------------------------------------------
    // RULE 4 — process.env is read only by the env loader.
    // Everything else consumes the validated, typed config object.
    // ---------------------------------------------------------------------
    {
      files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
      excludedFiles: ['**/env.ts', '**/env.*.ts', '**/*.config.{ts,js,mjs}', '**/scripts/**'],
      rules: {
        'no-restricted-properties': [
          'error',
          {
            object: 'process',
            property: 'env',
            message:
              'Read configuration from the validated env object (@stc/config), not process.env.',
          },
        ],
      },
    },

    // ---------------------------------------------------------------------
    // RULE 5 — @stc/constants stays dependency-free.
    // It is imported by edge middleware, workers and the client bundle.
    // ---------------------------------------------------------------------
    {
      files: ['packages/constants/src/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['*', '!@stc/types', '!./*', '!../*'],
                message:
                  '@stc/constants must depend on nothing but @stc/types. It is imported from ' +
                  'edge middleware, workers and the browser bundle.',
              },
            ],
          },
        ],
      },
    },
  ],
};
