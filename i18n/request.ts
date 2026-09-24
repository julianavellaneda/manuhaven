import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is the segment resolved by the middleware; validate it
  // and fall back to the default locale for anything unexpected.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Shared formatter defaults consumed by `useFormatter()`. Note: es-MX
    // peso/date conventions are produced by lib/utils' formatCurrency/formatDate
    // via toIntlLocale(), since the routing locale stays "es" (URLs stay `/es`).
    formats: {
      number: {
        currency: {
          style: "currency",
          currencyDisplay: "narrowSymbol",
          minimumFractionDigits: 2,
        },
      },
      dateTime: {
        short: { year: "numeric", month: "short", day: "numeric" },
      },
    },
  };
});
