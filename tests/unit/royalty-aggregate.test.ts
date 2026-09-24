import { describe, it, expect } from "vitest";
import { aggregateRoyalties, type RoyaltyRow } from "@/lib/royalties/aggregate";
import { monthLabel, usdTick } from "@/lib/royalties/display";

// Mid-month dates so the UTC parse of "YYYY-MM-DD" lands in the same local
// month in every timezone.
const NOW = new Date(2026, 5, 20); // June 2026

function row(overrides: Partial<RoyaltyRow>): RoyaltyRow {
  return {
    retailer: "amazon",
    territory: "US",
    unitsSold: 1,
    revenueUsd: 10,
    periodStart: "2026-06-15",
    ...overrides,
  };
}

describe("aggregateRoyalties", () => {
  it("returns 12 empty months ending with the current month when there are no rows", () => {
    const agg = aggregateRoyalties([], NOW);
    expect(agg.retailerMonthlyData).toHaveLength(12);
    expect(agg.unitsMonthlyData.map((m) => m.month)).toEqual([
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    ]);
    expect(agg.unitsMonthlyData.every((m) => m.units === 0)).toBe(true);
    expect(agg.territoryData).toEqual([]);
    expect(agg.summary).toEqual({
      totalRevenue: 0,
      totalUnits: 0,
      activeRetailers: 0,
      topTerritory: "N/A",
    });
  });

  it("buckets revenue by retailer and month, and units by month", () => {
    const agg = aggregateRoyalties(
      [
        row({ retailer: "amazon", revenueUsd: 10, unitsSold: 2 }),
        row({ retailer: "amazon", revenueUsd: 5, unitsSold: 1 }),
        row({ retailer: "kobo", revenueUsd: 7, unitsSold: 3 }),
        row({ retailer: "apple", revenueUsd: 4, periodStart: "2026-03-15" }),
      ],
      NOW
    );
    const june = agg.retailerMonthlyData.at(-1)!;
    expect(june).toMatchObject({ month: "2026-06", amazon: 15, kobo: 7, apple: 0 });
    const march = agg.retailerMonthlyData.find((m) => m.month === "2026-03")!;
    expect(march.apple).toBe(4);
    expect(agg.unitsMonthlyData.at(-1)).toEqual({ month: "2026-06", units: 6 });
  });

  it("counts old rows in totals but not in the monthly series", () => {
    const agg = aggregateRoyalties(
      [
        row({ revenueUsd: 10, unitsSold: 1 }),
        row({ retailer: "bn", revenueUsd: 90, unitsSold: 9, periodStart: "2024-01-15" }),
      ],
      NOW
    );
    expect(agg.summary.totalRevenue).toBe(100);
    expect(agg.summary.totalUnits).toBe(10);
    expect(agg.summary.activeRetailers).toBe(2);
    expect(agg.retailerMonthlyData.reduce((s, m) => s + m.bn, 0)).toBe(0);
    expect(agg.unitsMonthlyData.reduce((s, m) => s + m.units, 0)).toBe(1);
  });

  it("treats null revenue and units as zero and null territory as Unknown", () => {
    const agg = aggregateRoyalties(
      [row({ territory: null, revenueUsd: null, unitsSold: null })],
      NOW
    );
    expect(agg.summary.totalRevenue).toBe(0);
    expect(agg.summary.totalUnits).toBe(0);
    expect(agg.territoryData).toEqual([{ territory: "Unknown", revenue: 0 }]);
  });

  it("keeps the top 10 territories by revenue, highest first", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row({ territory: `T${i}`, revenueUsd: i + 1 })
    );
    const agg = aggregateRoyalties(rows, NOW);
    expect(agg.territoryData).toHaveLength(10);
    expect(agg.territoryData[0]).toEqual({ territory: "T11", revenue: 12 });
    expect(agg.territoryData.at(-1)).toEqual({ territory: "T2", revenue: 3 });
    expect(agg.summary.topTerritory).toBe("T11");
  });
});

describe("royalty display helpers", () => {
  it("formats month keys as short month + 2-digit year", () => {
    expect(monthLabel("2026-03", "en-US")).toBe("Mar 26");
  });

  it("compacts dollar ticks at 1000 and above", () => {
    expect(usdTick(950)).toBe("$950");
    expect(usdTick(1000)).toBe("$1k");
    expect(usdTick(12400)).toBe("$12k");
  });
});
