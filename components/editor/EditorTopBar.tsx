"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface EditorTopBarProps {
  projectId: string;
  projectTitle: string;
}

const TAB_HREFS = ["edit", "editorial", "preview", "royalties"] as const;

export function EditorTopBar({ projectId, projectTitle }: EditorTopBarProps) {
  const t = useTranslations("editor.topBar");
  const pathname = usePathname();

  const tabs = TAB_HREFS.map((href) => ({ href, label: t(`tab.${href}`) }));

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 bg-white/70 px-5 backdrop-blur-[16px]">
      <h2 className="font-serif text-sm font-medium text-foreground">
        {projectTitle}
      </h2>

      <nav className="flex items-center gap-1 ml-4">
        {tabs.map((tab) => {
          const href = `/dashboard/projects/${projectId}/${tab.href}`;
          const isActive = pathname.endsWith(`/${tab.href}`);
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Eye className="size-3.5" />
          {t("previewButton")}
        </Button>
      </div>
    </header>
  );
}
