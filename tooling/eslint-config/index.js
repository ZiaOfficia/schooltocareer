const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettier = require('eslint-config-prettier');
const importPlugin = require('eslint-plugin-import');

const layers = require('./layers.js');

/**
 * Base config shared by every workspace, in ESLint 9 "flat" format.
 *
 * It is loaded by the single `eslint.config.js` at the repo root, which ESLint
 * finds by walking up from whichever package `eslint src` runs in. `layers.js`
 * carries the architectural boundary rules and is merged in here so a package
 * cannot opt out of them by writing its own config.
 *
 * Every glob in this package is relative to the repo root, because that is
 * where the config file lives.
 */
module.exports = [
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/generated/**', '**/*.js'],
  },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  prettier,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // `typeof import('three')` is how the lazily loaded modules are typed
        // without pulling them into the initial bundle, so annotations stay allowed.
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@stc/**', group: 'internal', position: 'before' },
            { pattern: '@/**', group: 'internal', position: 'after' },
          ],
          // Scoped packages count as "external", and external imports are
          // skipped by pathGroups unless this says otherwise — without it the
          // @stc group above never applies.
          pathGroupsExcludedImportTypes: ['builtin'],
          distinctGroup: true,
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // tsc already proves every import resolves. This rule cannot follow the
      // NodeNext `./file.js` specifiers or the `@/` alias without a TypeScript
      // resolver, so it would only report false positives.
      'import/no-unresolved': 'off',
      'import/no-default-export': 'off',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  ...layers.overrides,
];
