import "server-only";

import { createTranslator, hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { sendMail } from "@/lib/email/mailer";

export type AuthEmailKind = "magicLink" | "resetPassword" | "verifyEmail";

// Auth emails in the reader's language. The callbacks that send them run in
// /api/auth/*, outside the [locale] segment, so the locale comes from the
// NEXT_LOCALE cookie that next-intl sets while browsing.
function localeFrom(headers: Headers | undefined): Locale {
  const match = headers?.get("cookie")?.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const value = match?.[1];
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

export async function sendAuthEmail(
  kind: AuthEmailKind,
  to: string,
  url: string,
  headers: Headers | undefined,
): Promise<void> {
  const locale = localeFrom(headers);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "email" });
  await sendMail({
    to,
    subject: t(`${kind}.subject`),
    text: t(`${kind}.body`, { url }),
  });
}
