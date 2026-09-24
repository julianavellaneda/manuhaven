"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { toIntlLocale } from "@/i18n/routing";
import { formatCurrency } from "@/lib/utils";
import type { RetailerMonthly } from "@/lib/royalties/aggregate";
import {
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  RETAILER_COLORS,
  RETAILER_LABELS,
  monthLabel,
  usdTick,
} from "@/lib/royalties/display";

/** Stacked monthly revenue, one bar segment per CSV retailer. */
export function RetailerRevenueChart({ data }: { data: RetailerMonthly[] }) {
  const t = useTranslations("royalties.dashboard");
  const intlLocale = toIntlLocale(useLocale());

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        {t("chartRevenueByRetailer")}
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.map((d) => ({
              ...d,
              label: monthLabel(d.month, intlLocale),
            }))}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={CHART_TICK}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={CHART_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={usdTick}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                RETAILER_LABELS[String(name)] || String(name),
              ]}
            />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">
                  {RETAILER_LABELS[value] || value}
                </span>
              )}
            />
            <Bar
              dataKey="amazon"
              stackId="a"
              fill={RETAILER_COLORS.amazon}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="apple"
              stackId="a"
              fill={RETAILER_COLORS.apple}
            />
            <Bar
              dataKey="kobo"
              stackId="a"
              fill={RETAILER_COLORS.kobo}
            />
            <Bar
              dataKey="streetlib"
              stackId="a"
              fill={RETAILER_COLORS.streetlib}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
