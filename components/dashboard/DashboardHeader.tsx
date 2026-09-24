"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "./NewProjectDialog";

interface DashboardHeaderProps {
  projectCount: number;
}

export function DashboardHeader({ projectCount }: DashboardHeaderProps) {
  const t = useTranslations("dashboard.header");

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("projectCount", { count: projectCount })}
        </p>
      </div>
      <NewProjectDialog>
        <Button
          className="gap-2 bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)] text-white hover:opacity-90"
          size="lg"
        >
          <Plus className="size-4" />
          {t("newManuscript")}
        </Button>
      </NewProjectDialog>
    </div>
  );
}
