"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = { en: "EN", es: "ES" };

/**
 * Locale toggle. Uses next-intl's locale-aware router/pathname so the current
 * route is preserved when switching languages (the pathname is returned without
 * the locale prefix and re-prefixed for the target locale).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries());
  const t = useTranslations("common");

  return (
    <div
      className={cn("flex items-center gap-0.5 text-xs font-medium", className)}
      role="group"
      aria-label={t("changeLanguage")}
    >
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="mx-1 text-muted-foreground/40">/</span>}
          <button
            type="button"
            onClick={() => router.replace({ pathname, query }, { locale: l })}
            aria-current={l === locale ? "true" : undefined}
            className={cn(
              "rounded px-1 transition-colors",
              l === locale
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LABELS[l] ?? l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
