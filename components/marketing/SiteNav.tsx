import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button-variants";
import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";

const NAV_LINKS = [
  { href: "/#pillars", key: "features" },
  { href: "/#faq", key: "faq" },
] as const;

export async function SiteNav() {
  const t = await getTranslations("nav");
  const tCommon = await getTranslations("common");

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif text-lg font-semibold tracking-tight"
        >
          {tCommon("appName")}
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-foreground"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <a
            href="https://github.com/julianavellaneda/manuhaven"
            target="_blank"
            rel="noreferrer noopener"
            className={buttonVariants({ size: "sm" })}
          >
            {tCommon("viewOnGitHub")}
          </a>
        </div>
      </div>
    </header>
  );
}
