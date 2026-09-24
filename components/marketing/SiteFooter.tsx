import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const FOOTER_LINKS = [
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
] as const;

export async function SiteFooter() {
  const t = await getTranslations("nav");
  const tFooter = await getTranslations("footer");

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center">
        <p className="font-serif">
          {tFooter("copyright", { year: new Date().getFullYear() })}
        </p>
        <nav className="flex flex-wrap gap-6">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-foreground"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
