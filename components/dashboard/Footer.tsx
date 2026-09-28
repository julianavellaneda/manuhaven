"use client";

import { useTranslations } from "next-intl";

const REPO_URL = "https://github.com/julianavellaneda/manuhaven";

const FOOTER_LINKS = [
  { href: `${REPO_URL}/tree/main/docs`, key: "documentation" },
  { href: `${REPO_URL}/discussions`, key: "support" },
] as const;

export function Footer() {
  const t = useTranslations("dashboard.footer");

  return (
    <footer className="flex h-10 shrink-0 items-center justify-between bg-white/70 px-6 backdrop-blur-[16px]">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/60">
        &copy; {new Date().getFullYear()} ManuHaven
      </p>
      <nav className="flex items-center gap-4">
        {FOOTER_LINKS.map((l) => (
          <a
            key={l.key}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            {t(l.key)}
          </a>
        ))}
      </nav>
    </footer>
  );
}
