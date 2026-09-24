import { defineConfig } from "drizzle-kit";

// `bun run db:generate` diffs lib/db/schema.ts against drizzle/ and writes a
// new migration; it needs no database. DATABASE_URL is only read by
// `db:studio`. Migrations are applied by scripts/migrate.ts, not drizzle-kit.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
