import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// One pool per server process. In dev, Next re-evaluates modules on every
// edit, so the pool is parked on globalThis to avoid leaking connections.
const globalForDb = globalThis as unknown as { manuhavenPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.manuhavenPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    globalForDb.manuhavenPool = new Pool({ connectionString, max: 10 });
  }
  return globalForDb.manuhavenPool;
}

let instance: Database | undefined;

// Lazy so that importing this module (e.g. during `next build`) never needs a
// database; the connection is made on first query.
export function getDb(): Database {
  instance ??= drizzle({ client: getPool(), schema });
  return instance;
}
