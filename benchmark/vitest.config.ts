import { defineConfig } from 'vitest/config';

// Standalone config for the benchmark's local validation backend.
//
// The runner has to go through Vite's transform because node-sql-parser is CJS
// and Node's bare ESM interop cannot resolve its named exports. Keeping it in a
// separate config means `npm test` never picks it up (see `test.exclude` in the
// root vite.config.ts) and the benchmark stays out of the 417-test gate.
export default defineConfig({
  test: {
    include: ['*.run.ts'],
    root: __dirname,
    reporters: ['dot'],
  },
});
