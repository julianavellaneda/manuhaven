import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ProjectCard } from "./ProjectCard";
import type { ProjectStatus } from "@/lib/constants";
import { fileUrl } from "@/lib/storage/url";

interface Project {
  id: string;
  title: string;
  genre: string | null;
  status: ProjectStatus | null;
  coverKey: string | null;
  updatedAt: Date;
  wordCount: number | null;
}

interface KanbanColumnProps {
  title: string;
  icon: ReactNode;
  projects: Project[];
}

export async function KanbanColumn({ title, icon, projects }: KanbanColumnProps) {
  const t = await getTranslations("dashboard.kanban");
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h2 className="font-serif text-sm font-semibold text-foreground">
          {title}
        </h2>
        <span className="ml-1 text-xs text-muted-foreground">
          {projects.length}
        </span>
      </div>

      <div className="space-y-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            id={project.id}
            title={project.title}
            genre={project.genre}
            status={project.status ?? "draft"}
            coverUrl={project.coverKey ? fileUrl(project.coverKey) : null}
            wordCount={project.wordCount ?? 0}
            updatedAt={project.updatedAt}
          />
        ))}
        {projects.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {t("noProjects")}
          </p>
        )}
      </div>
    </div>
  );
}
