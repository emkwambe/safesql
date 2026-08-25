import { defineConfig } from 'tsup';

// Dual ESM + CJS output with types. Zero runtime dependencies — the client
// only uses fetch, so the bundle runs in Node, browsers and Cloudflare Workers.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
});
