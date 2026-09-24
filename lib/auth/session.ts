import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * The signed-in user, or null. Cached per request, so a layout and the page
 * under it share one session lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // headers() first: at build time it marks the page dynamic and stops
  // prerendering before getAuth() would need DATABASE_URL.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

/**
 * For pages and layouts: the signed-in user, or a redirect to /login in the
 * current locale. API routes use getSessionUser() and answer 401 instead.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login", locale: await getLocale() });
  return user;
}
