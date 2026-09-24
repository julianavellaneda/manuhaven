"use client";

import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { TerritoryData } from "@/lib/royalties/aggregate";
import {
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  usdTick,
} from "@/lib/royalties/display";

/** Horizontal bars of revenue for the top territories. */
export function TerritoryRevenueChart({ data }: { data: TerritoryData[] }) {
  const t = useTranslations("royalties.dashboard");

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        {t("chartRevenueByTerritory")}
      </h3>
      <div className="h-72">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,0,0,0.05)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={CHART_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={usdTick}
              />
              <YAxis
                type="category"
                dataKey="territory"
                tick={CHART_TICK}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value) => [
                  formatCurrency(Number(value)),
                  t("tooltipRevenue"),
                ]}
              />
              <Bar
                dataKey="revenue"
                fill="#2c4a52"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("noTerritoryData")}
          </div>
        )}
      </div>
    </div>
  );
}
