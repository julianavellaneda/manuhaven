"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/constants";

const statusClassName: Record<ProjectStatus, string> = {
  draft: "bg-draft text-[oklch(0.35_0.04_300)]",
  review: "bg-review text-[oklch(0.3_0.04_230)]",
  formatting: "bg-formatting text-[oklch(0.35_0.06_85)]",
  publishing: "bg-published text-[oklch(0.3_0.05_155)]",
  live: "bg-published text-[oklch(0.3_0.05_155)]",
  archived: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("dashboard.status");
  const className = statusClassName[status] ?? statusClassName.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        className
      )}
    >
      {t(status)}
    </span>
  );
}
