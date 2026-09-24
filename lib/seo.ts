import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { runtimeEnv } from "@/lib/public-env";

// Canonical/hreflang URLs need an absolute origin. There is no sensible
// production default for a self-hosted app, so fall back to localhost and warn
// loudly rather than silently emitting someone else's domain.
export function appOrigin(): string {
  const configured = runtimeEnv("NEXT_PUBLIC_APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[seo] NEXT_PUBLIC_APP_URL is not set; canonical URLs will point at " +
        "localhost. Set it to your public origin."
    );
  }
  return "http://localhost:3000";
}

const APP_URL = appOrigin();

// hreflang annotations use BCP-47 region tags; og:locale uses underscores.
const HREFLANG: Record<string, string> = { en: "en", es: "es-MX" };
const OG_LOCALE: Record<string, string> = { en: "en_US", es: "es_MX" };

// Build an absolute URL for a canonical path (e.g. "/", "/about") in a given
// locale. The default locale is unprefixed (localePrefix: "as-needed").
export function localizedUrl(locale: string, path: string): string {
  const clean = path === "/" ? "" : path;
  return locale === routing.defaultLocale
    ? `${APP_URL}${clean || "/"}`
    : `${APP_URL}/${locale}${clean}`;
}

/**
 * SEO metadata for a localized page: self-referencing canonical, hreflang
 * alternates (en, es-MX, and x-default → the default-locale URL), and
 * og:locale + alternateLocale. `path` is the canonical path WITHOUT the locale
 * prefix (e.g. "/", "/about", "/pricing").
 */
export function localeMetadata(locale: string, path: string): Metadata {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[HREFLANG[l]] = localizedUrl(l, path);
  }
  languages["x-default"] = localizedUrl(routing.defaultLocale, path);

  return {
    alternates: {
      canonical: localizedUrl(locale, path),
      languages,
    },
    openGraph: {
      url: localizedUrl(locale, path),
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALE[l]),
    },
  };
}
