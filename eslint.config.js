// ESLint 9 looks for this file by walking up from the directory it runs in, so
// this one file serves every workspace's `eslint src`. The rules themselves
// live in tooling/eslint-config.
module.exports = require('./tooling/eslint-config/index.js');
