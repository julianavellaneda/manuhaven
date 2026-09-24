// Applies pending migrations from drizzle/ to DATABASE_URL.
//
//   bun run db:migrate                       (dev, from the host)
//   node migrate.mjs                         (the app image, before server.js)
//
// The app image runs this on every start, so `docker compose up` is one
// command. A Postgres advisory lock serializes concurrent starts (replicas),
// and the lock is held on the same connection that runs the migrations.

import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// Arbitrary constant shared by every ManuHaven process.
const MIGRATION_LOCK_ID = 7_266_435_401;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [
      MIGRATION_LOCK_ID,
    ]);
    await migrate(drizzle({ client }), { migrationsFolder });
    console.log("[migrate] database is up to date");
  } finally {
    // Closing the session releases the advisory lock too; unlock explicitly
    // anyway so a pooled or proxied connection cannot keep it.
    await client
      .query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID])
      .catch(() => {});
    await client.end();
  }
}

main().catch((error: unknown) => {
  // Log the message only: a driver error can include the connection string.
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[migrate] failed: ${message}`);
  process.exit(1);
});
