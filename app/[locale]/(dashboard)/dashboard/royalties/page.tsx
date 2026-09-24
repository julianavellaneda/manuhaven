import { RoyaltyDashboard } from "@/components/royalties/RoyaltyDashboard";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { listProjectOptions } from "@/lib/db/queries/projects";
import { listRoyalties } from "@/lib/db/queries/royalties";

export default async function RoyaltiesPage() {
  const t = await getTranslations("pages.royalties");
  const user = await requireUser();

  const [royaltyRows, projectRows] = await Promise.all([
    listRoyalties(user.id),
    listProjectOptions(user.id),
  ]);

  // Aggregate: revenue by retailer by month (last 12 months)
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const revenueByRetailerMonth: Record<
    string,
    Record<string, number>
  > = {};
  const revenueByTerritory: Record<string, number> = {};
  const unitsByMonth: Record<string, number> = {};
  let totalRevenue = 0;
  let totalUnits = 0;
  const activeRetailers = new Set<string>();

  for (const r of royaltyRows) {
    const periodDate = new Date(r.periodStart);
    const revenueUsd = r.revenueUsd ?? 0;
    const units = r.unitsSold ?? 0;

    totalRevenue += revenueUsd;
    totalUnits += units;
    activeRetailers.add(r.retailer);

    // Territory aggregation
    const territory = r.territory || "Unknown";
    revenueByTerritory[territory] =
      (revenueByTerritory[territory] || 0) + revenueUsd;

    // Only include last 12 months in chart data
    if (periodDate >= twelveMonthsAgo) {
      const monthKey = `${periodDate.getFullYear()}-${String(
        periodDate.getMonth() + 1
      ).padStart(2, "0")}`;

      // Revenue by retailer
      if (!revenueByRetailerMonth[monthKey]) {
        revenueByRetailerMonth[monthKey] = {};
      }
      revenueByRetailerMonth[monthKey][r.retailer] =
        (revenueByRetailerMonth[monthKey][r.retailer] || 0) + revenueUsd;

      // Units by month
      unitsByMonth[monthKey] = (unitsByMonth[monthKey] || 0) + units;
    }
  }

  // Build chart-ready arrays
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  const retailerMonthlyData = months.map((month) => ({
    month,
    amazon: revenueByRetailerMonth[month]?.["amazon"] || 0,
    apple: revenueByRetailerMonth[month]?.["apple"] || 0,
    kobo: revenueByRetailerMonth[month]?.["kobo"] || 0,
    streetlib: revenueByRetailerMonth[month]?.["streetlib"] || 0,
    bn: revenueByRetailerMonth[month]?.["bn"] || 0,
    google: revenueByRetailerMonth[month]?.["google"] || 0,
  }));

  const unitsMonthlyData = months.map((month) => ({
    month,
    units: unitsByMonth[month] || 0,
  }));

  // Top 10 territories by revenue
  const territoryData = Object.entries(revenueByTerritory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([territory, revenue]) => ({ territory, revenue }));

  // Top territory
  const topTerritory = territoryData[0]?.territory || "N/A";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {t("heading")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <RoyaltyDashboard
        projects={projectRows}
        retailerMonthlyData={retailerMonthlyData}
        unitsMonthlyData={unitsMonthlyData}
        territoryData={territoryData}
        summary={{
          totalRevenue,
          totalUnits,
          activeRetailers: activeRetailers.size,
          topTerritory,
        }}
      />
    </div>
  );
}
