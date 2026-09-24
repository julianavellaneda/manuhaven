"use client";

import { useTranslations } from "next-intl";
import { Search, Bell, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";

interface TopBarProps {
  projectName?: string;
  user?: {
    displayName: string;
    initials: string;
  };
  onMenuToggle?: () => void;
}

export function TopBar({ projectName, user, onMenuToggle }: TopBarProps) {
  const t = useTranslations("dashboard.topbar");

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 bg-white/70 px-4 backdrop-blur-[16px]">
      {/* Hamburger — mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground lg:hidden"
        onClick={onMenuToggle}
        aria-label={t("openMenu")}
      >
        <Menu className="size-4" />
      </Button>

      {projectName && (
        <h2 className="font-serif text-base font-medium text-foreground">
          {projectName}
        </h2>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            className="h-8 w-48 bg-muted/50 pl-8 text-xs md:w-56"
          />
        </div>

        <LanguageSwitcher />

        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
          <Bell className="size-4" />
        </Button>

        {user && (
          <Avatar className="size-8">
            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </header>
  );
}
