import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The benchmark harness has its own config (benchmark/vitest.config.ts) and
    // is not part of the test gate.
    exclude: ['**/node_modules/**', '**/dist/**', 'benchmark/**'],
  },
})
