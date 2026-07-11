import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Default to the fast node runtime. Component/hook suites opt into jsdom
    // per-file with a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'app/api/**', 'components/**'],
      reporter: ['text', 'html'],
      // Floors set a few points below the current numbers so CI fails on a
      // meaningful regression without flaking on small, legitimate dips. Raise
      // these as coverage grows.
      thresholds: {
        statements: 55,
        branches: 82,
        functions: 65,
        lines: 55,
      },
    },
  },
})
