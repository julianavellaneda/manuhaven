import { getTranslations } from "next-intl/server";
import { PencilLine, Sparkles, Rocket, Globe } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import type { ProjectStatus } from "@/lib/constants";

interface Project {
  id: string;
  title: string;
  genre: string | null;
  status: ProjectStatus | null;
  coverKey: string | null;
  updatedAt: Date;
  wordCount: number | null;
}

interface KanbanBoardProps {
  projects: Project[];
}

export async function KanbanBoard({ projects }: KanbanBoardProps) {
  const t = await getTranslations("dashboard.kanban");

  const draft = projects.filter((p) =>
    ["draft", "review"].includes(p.status ?? "draft")
  );
  const formatting = projects.filter((p) => p.status === "formatting");
  const publishing = projects.filter((p) => p.status === "publishing");
  const live = projects.filter((p) => p.status === "live");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <KanbanColumn title={t("draft")} icon={<PencilLine className="h-4 w-4 text-muted-foreground" />} projects={draft} />
      <KanbanColumn title={t("formatting")} icon={<Sparkles className="h-4 w-4 text-muted-foreground" />} projects={formatting} />
      <KanbanColumn title={t("publishing")} icon={<Rocket className="h-4 w-4 text-muted-foreground" />} projects={publishing} />
      <KanbanColumn title={t("live")} icon={<Globe className="h-4 w-4 text-muted-foreground" />} projects={live} />
    </div>
  );
}
