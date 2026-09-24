"use client";

import { useTranslations } from "next-intl";

export default function MarketingError({ reset }: { reset: () => void }) {
  const t = useTranslations("marketing.errorBoundary");
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center space-y-4">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <button onClick={reset} className="text-sm underline underline-offset-4">
        {t("retry")}
      </button>
    </div>
  );
}
