import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { requireUser } from "@/lib/auth/session";
import { listDashboardProjects } from "@/lib/db/queries/projects";

export default async function DashboardPage() {
  const user = await requireUser();
  const projects = await listDashboardProjects(user.id);

  return (
    <div className="space-y-6">
      <DashboardHeader projectCount={projects.length} />

      <DashboardTabs>
        <KanbanBoard projects={projects} />
      </DashboardTabs>
    </div>
  );
}
