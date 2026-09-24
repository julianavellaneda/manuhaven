"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Palette, Archive } from "lucide-react";

interface DashboardTabsProps {
  children: React.ReactNode;
}

export function DashboardTabs({ children }: DashboardTabsProps) {
  const t = useTranslations("dashboard.tabs");

  return (
    <Tabs defaultValue="drafts">
      <TabsList variant="line">
        <TabsTrigger value="drafts">
          <FileText className="size-3.5" />
          {t("drafts")}
        </TabsTrigger>
        <TabsTrigger value="templates">
          <Palette className="size-3.5" />
          {t("templates")}
        </TabsTrigger>
        <TabsTrigger value="archive">
          <Archive className="size-3.5" />
          {t("archive")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="drafts">{children}</TabsContent>

      <TabsContent value="templates">
        <div className="flex flex-col items-center justify-center rounded-xl bg-card py-16 shadow-sm">
          <Palette className="size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("templatesEmpty")}
          </p>
        </div>
      </TabsContent>

      <TabsContent value="archive">
        <div className="flex flex-col items-center justify-center rounded-xl bg-card py-16 shadow-sm">
          <Archive className="size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("archiveEmpty")}
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
