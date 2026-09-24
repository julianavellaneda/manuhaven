"use client";

import { useTranslations } from "next-intl";

export default function AuthError({ reset }: { reset: () => void }) {
  const t = useTranslations("auth.errorBoundary");
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <button onClick={reset} className="text-sm underline underline-offset-4">
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
