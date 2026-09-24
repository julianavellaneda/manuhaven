import { defineConfig } from 'vitest/config'
import { alias } from './vitest.config'

// Tests against a real, migrated Postgres at DATABASE_URL:
//   bun run db:up && bun run db:migrate && bun run test:integration
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Files share one database; run them one at a time.
    fileParallelism: false,
  },
  resolve: { alias },
})
