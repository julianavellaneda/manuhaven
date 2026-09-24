import { Sparkles, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("pages.settings");

  const settingsLinks = [
    {
      label: t("linkProfileLabel"),
      description: t("linkProfileDescription"),
      href: "/dashboard/profile",
      icon: User,
    },
    {
      label: t("linkAiLabel"),
      description: t("linkAiDescription"),
      href: "/dashboard/settings/ai",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {t("heading")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {settingsLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-start gap-4 rounded-xl bg-card p-6 shadow-sm",
              "transition-colors hover:bg-muted/50"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-sidebar group-hover:text-sidebar-foreground">
              <item.icon className="size-5" />
            </div>
            <div>
              <h3 className="font-serif text-sm font-semibold text-foreground">
                {item.label}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
