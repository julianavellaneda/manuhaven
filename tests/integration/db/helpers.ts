import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getDb } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { createProfile, deleteUser } from "@/lib/db/queries/users";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Run `bun run db:up && bun run db:migrate` and " +
      "point DATABASE_URL at it (see tests/integration/README.md).",
  );
}

/** A throwaway user, created the way Better Auth's hook would create one. */
export async function createTestUser(label: string): Promise<string> {
  const email = `${label}-${randomUUID()}@test.invalid`;
  const [row] = await getDb()
    .insert(user)
    .values({ name: label, email })
    .returning({ id: user.id });
  await createProfile({ id: row.id, email, name: label });
  return row.id;
}

export async function removeTestUsers(...ids: string[]): Promise<void> {
  for (const id of ids) await deleteUser(id);
}

/** Close the shared pool so vitest can exit. */
export async function closeDb(): Promise<void> {
  const g = globalThis as unknown as { manuhavenPool?: Pool };
  await g.manuhavenPool?.end();
  g.manuhavenPool = undefined;
}
