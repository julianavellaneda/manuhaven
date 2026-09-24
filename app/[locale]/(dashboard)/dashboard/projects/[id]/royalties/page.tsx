import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { RevenueHero } from "@/components/royalties/RevenueHero";
import { RevenueChart } from "@/components/royalties/RevenueChart";
import { RetailerMix } from "@/components/royalties/RetailerMix";
import { requireUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { listProjectRoyalties } from "@/lib/db/queries/royalties";

export default async function ProjectRoyaltiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("pages.projectRoyalties");
  const { id } = await params;
  const user = await requireUser();

  const project = await getOwnedProject(user.id, id);
  if (!project) notFound();

  const royalties = await listProjectRoyalties(user.id, id);

  // Calculate metrics
  const totalRevenue = royalties.reduce(
    (sum, r) => sum + (r.revenueUsd ?? 0),
    0
  );
  const totalUnits = royalties.reduce(
    (sum, r) => sum + (r.unitsSold ?? 0),
    0
  );

  // Monthly revenue for chart
  const monthlyMap = new Map<string, number>();
  for (const r of royalties) {
    const month = r.periodStart.slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + (r.revenueUsd ?? 0));
  }
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month: `${month}-01`, revenue: Math.round(revenue) }));

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = monthlyMap.get(currentMonth) ?? monthlyMap.get(
    Array.from(monthlyMap.keys()).sort().pop() ?? ""
  ) ?? 0;

  // Retailer breakdown for pie chart
  const retailerMap = new Map<string, number>();
  for (const r of royalties) {
    retailerMap.set(
      r.retailer,
      (retailerMap.get(r.retailer) ?? 0) + (r.revenueUsd ?? 0)
    );
  }
  const retailerData = Array.from(retailerMap.entries())
    .map(([retailer, revenue]) => ({ retailer, revenue: Math.round(revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <EditorTopBar projectId={project.id} projectTitle={project.title} />
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div>
          <h1 className="font-serif text-xl font-semibold text-foreground">
            {t("heading")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description", { title: project.title })}
          </p>
        </div>

        <RevenueHero
          totalRevenue={totalRevenue}
          monthlyRevenue={monthlyRevenue}
          totalUnits={totalUnits}
        />

        <div className="grid grid-cols-2 gap-6">
          <RevenueChart data={monthlyData} />
          <RetailerMix data={retailerData} />
        </div>
      </div>
    </div>
  );
}
