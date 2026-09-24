import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/auth";
import { getSessionUser } from "@/lib/auth/session";
import { deleteUser } from "@/lib/db/queries/users";
import { getStorage } from "@/lib/storage";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Files first: if the purge fails the account is still there to retry
    // with, instead of leaving files behind that nobody can reach or delete.
    await getStorage().deletePrefix(`${user.id}/`);
    // Sign out so the session cookie is cleared on this response; the delete
    // then cascades to sessions and everything else the user owns.
    await getAuth().api.signOut({ headers: await headers() });
    await deleteUser(user.id);
  } catch {
    return NextResponse.json(
      { error: "Could not delete the account. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
