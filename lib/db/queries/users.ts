import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, user } from "@/lib/db/schema";

/**
 * Create the app-side profile for a newly registered user. Called from Better
 * Auth's user.create.after hook; the display name falls back to the email's
 * local part, as the old auth.users trigger did.
 */
export async function createProfile(newUser: {
  id: string;
  email: string;
  name: string;
}): Promise<void> {
  await getDb()
    .insert(profiles)
    .values({
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.name.trim() || newUser.email.split("@")[0],
    })
    .onConflictDoNothing();
}

/** The profile row for the header and the profile page. */
export async function getProfile(userId: string) {
  const [row] = await getDb()
    .select({
      displayName: profiles.displayName,
      email: profiles.email,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(eq(profiles.id, userId));
  return row ?? null;
}

/** Delete an account. Everything the user owns cascades from "user". */
export async function deleteUser(userId: string): Promise<void> {
  await getDb().delete(user).where(eq(user.id, userId));
}
