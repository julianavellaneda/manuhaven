// Pure aggregation of imported royalty rows into the dashboard's chart data.
// No I/O: the royalties page fetches the rows and passes them in.

export interface RoyaltyRow {
  retailer: string;
  territory: string | null;
  unitsSold: number | null;
  revenueUsd: number | null;
  /** ISO date, YYYY-MM-DD. */
  periodStart: string;
}

export interface RetailerMonthly {
  month: string;
  amazon: number;
  apple: number;
  kobo: number;
  streetlib: number;
  bn: number;
  google: number;
}

export interface UnitsMonthly {
  month: string;
  units: number;
}

export interface TerritoryData {
  territory: string;
  revenue: number;
}

export interface RoyaltySummary {
  totalRevenue: number;
  totalUnits: number;
  activeRetailers: number;
  topTerritory: string;
}

export interface RoyaltyAggregate {
  retailerMonthlyData: RetailerMonthly[];
  unitsMonthlyData: UnitsMonthly[];
  territoryData: TerritoryData[];
  summary: RoyaltySummary;
}

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Totals cover every row; the monthly series cover the 12 calendar months
 * ending with `now`'s month, and territories are the top 10 by revenue.
 */
export function aggregateRoyalties(
  rows: RoyaltyRow[],
  now: Date = new Date()
): RoyaltyAggregate {
  // Month keys compare as strings, and a row's month is read straight off its
  // YYYY-MM-DD date so no timezone can move it.
  const firstChartMonth = toMonthKey(
    new Date(now.getFullYear(), now.getMonth() - 11, 1)
  );

  const revenueByRetailerMonth: Record<
    string,
    Record<string, number>
  > = {};
  const revenueByTerritory: Record<string, number> = {};
  const unitsByMonth: Record<string, number> = {};
  let totalRevenue = 0;
  let totalUnits = 0;
  const activeRetailers = new Set<string>();

  for (const r of rows) {
    const monthKey = r.periodStart.slice(0, 7);
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
    if (monthKey >= firstChartMonth) {
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
    months.push(toMonthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
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

  return {
    retailerMonthlyData,
    unitsMonthlyData,
    territoryData,
    summary: {
      totalRevenue,
      totalUnits,
      activeRetailers: activeRetailers.size,
      topTerritory: territoryData[0]?.territory || "N/A",
    },
  };
}
