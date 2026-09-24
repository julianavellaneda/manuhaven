import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // All locales the app supports.
  locales: ["en", "es"],

  // Used when no locale matches (English lives at the root, e.g. `/about`).
  defaultLocale: "en",

  // English at `/`, Spanish at `/es/...`. Avoids duplicate-content SEO issues
  // by never prefixing the default locale.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

// Maps a routing locale to the BCP-47 tag used for Intl currency/date
// formatting. URLs stay `/es`, but money/dates render in Mexican Spanish.
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  es: "es-MX",
};

export function toIntlLocale(locale: string): string {
  return INTL_LOCALES[locale as Locale] ?? "en-US";
}
