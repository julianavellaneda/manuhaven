import { defineConfig } from 'vitest/config'
import path from 'path'

export const alias = {
  '@': path.resolve(__dirname, '.'),
  'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
}

export default defineConfig({
  test: {
    environment: 'jsdom',

    // Integration tests need real services; they run via vitest.integration.config.ts.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/integration/**'],
  },
  resolve: { alias },
})
