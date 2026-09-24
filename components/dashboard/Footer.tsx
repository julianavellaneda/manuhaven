"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("dashboard.footer");

  return (
    <footer className="flex h-10 shrink-0 items-center justify-between bg-white/70 px-6 backdrop-blur-[16px]">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/60">
        &copy; {new Date().getFullYear()} {t("copyright")}
      </p>
      <div className="flex items-center gap-4">
        <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/60">
          {t("systemStatus")}
        </span>
        <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/60">
          {t("documentation")}
        </span>
        <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/60">
          {t("support")}
        </span>
      </div>
    </footer>
  );
}
