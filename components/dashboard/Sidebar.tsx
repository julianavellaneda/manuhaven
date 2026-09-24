"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutGrid,
  BookOpen,
  BarChart3,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NewProjectDialog } from "./NewProjectDialog";

const navItems = [
  { key: "projects", href: "/dashboard", icon: LayoutGrid },
  { key: "library", href: "/dashboard/library", icon: BookOpen },
  { key: "royalties", href: "/dashboard/royalties", icon: TrendingUp },
  { key: "reports", href: "/dashboard/reports", icon: BarChart3 },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
] as const;

interface SidebarProps {
  account: { displayName: string; initials: string; email: string };
  mobileOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({
  account,
  mobileOpen,
  collapsed,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("dashboard.sidebar");

  return (
    <aside
      className={cn(
        // Base: fixed on mobile, relative on desktop
        "fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col bg-sidebar text-sidebar-foreground",
        "transition-[transform,width] duration-300 ease-in-out",
        // Mobile: full width slide-in drawer
        "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: always visible, width toggles
        "lg:relative lg:translate-x-0 lg:z-auto",
        collapsed ? "lg:w-16" : "lg:w-64"
      )}
    >
      {/* Header: branding + toggle buttons */}
      <div
        className={cn(
          "flex shrink-0 items-center px-4 pt-6 pb-4",
          collapsed ? "lg:justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-semibold tracking-tight text-sidebar-foreground">
              ManuHaven
            </h1>
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/50">
              Editorial Studio
            </p>
          </div>
        )}

        {/* Close on mobile */}
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          aria-label={t("close")}
        >
          <X className="size-4" />
        </button>

        {/* Collapse toggle on desktop */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "hidden lg:flex size-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "mt-0"
          )}
          aria-label={collapsed ? t("expand") : t("collapse")}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const label = t(item.key);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "lg:justify-center lg:px-2",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className={cn(collapsed && "lg:hidden")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* New Manuscript CTA */}
      <div className="px-2 py-3">
        <NewProjectDialog>
          <Button
            className="w-full gap-2 bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)] text-white hover:opacity-90"
            size="lg"
            title={t("newManuscript")}
          >
            <Plus className="size-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>{t("newManuscript")}</span>
          </Button>
        </NewProjectDialog>
      </div>

      {/* User Profile */}
      <Link
        href="/dashboard/profile"
        onClick={onClose}
        className={cn(
          "mx-2 mb-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent/40",
          collapsed && "lg:justify-center"
        )}
      >
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
            {account.initials}
          </AvatarFallback>
        </Avatar>
        <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {account.displayName}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/50">
            {account.email}
          </p>
        </div>
      </Link>
    </aside>
  );
}
