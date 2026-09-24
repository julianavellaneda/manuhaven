import type { RoyaltyAggregate } from "@/lib/royalties/aggregate";
import { RoyaltySummaryStats } from "@/components/royalties/RoyaltySummaryStats";
import { RoyaltyCsvImport } from "@/components/royalties/RoyaltyCsvImport";
import { RetailerRevenueChart } from "@/components/royalties/RetailerRevenueChart";
import { TerritoryRevenueChart } from "@/components/royalties/TerritoryRevenueChart";
import { UnitsSoldChart } from "@/components/royalties/UnitsSoldChart";

interface Project {
  id: string;
  title: string;
}

interface RoyaltyDashboardProps extends RoyaltyAggregate {
  projects: Project[];
}

export function RoyaltyDashboard({
  projects,
  retailerMonthlyData,
  unitsMonthlyData,
  territoryData,
  summary,
}: RoyaltyDashboardProps) {
  return (
    <div className="space-y-8">
      <RoyaltySummaryStats summary={summary} />

      <RoyaltyCsvImport projects={projects} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RetailerRevenueChart data={retailerMonthlyData} />
        <TerritoryRevenueChart data={territoryData} />
      </div>

      <UnitsSoldChart data={unitsMonthlyData} />
    </div>
  );
}
