import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Strip an optional non-default locale prefix so auth checks can be written
// against canonical paths (e.g. both `/dashboard` and `/es/dashboard` →
// `/dashboard`). The default locale (en) is unprefixed under `as-needed`.
function resolveLocale(pathname: string): {
  locale: string;
  pathWithoutLocale: string;
} {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}`) {
      return { locale, pathWithoutLocale: "/" };
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, pathWithoutLocale: pathname.slice(`/${locale}`.length) };
    }
  }
  return { locale: routing.defaultLocale, pathWithoutLocale: pathname };
}

export function proxy(request: NextRequest) {
  // Step 1: locale routing first. This may redirect (normalize/strip a prefix)
  // or rewrite internally.
  const response = handleI18nRouting(request);

  const { pathname } = request.nextUrl;
  const { locale, pathWithoutLocale } = resolveLocale(pathname);

  // Step 2: an optimistic gate on the dashboard. It only checks that a session
  // cookie exists; the real check happens in the dashboard layout and in every
  // page and route (lib/auth/session.ts). A stale cookie is caught there, so
  // there is deliberately no cookie-based redirect away from /login, which
  // could loop with the layout's redirect back to it.
  if (pathWithoutLocale.startsWith("/dashboard") && !getSessionCookie(request)) {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    return NextResponse.redirect(new URL(`${prefix}/login`, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except API routes (including /api/auth), Next
    // internals, and static asset files.
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
