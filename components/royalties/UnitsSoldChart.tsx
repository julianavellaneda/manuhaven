"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { toIntlLocale } from "@/i18n/routing";
import type { UnitsMonthly } from "@/lib/royalties/aggregate";
import {
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  monthLabel,
} from "@/lib/royalties/display";

/** Monthly units sold across every retailer. */
export function UnitsSoldChart({ data }: { data: UnitsMonthly[] }) {
  const t = useTranslations("royalties.dashboard");
  const intlLocale = toIntlLocale(useLocale());

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        {t("chartUnitsSoldOverTime")}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.map((d) => ({
              ...d,
              label: monthLabel(d.month, intlLocale),
            }))}
          >
            <defs>
              <linearGradient id="unitsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14333b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#14333b" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => [
                Number(value).toLocaleString(intlLocale),
                t("tooltipUnitsSold"),
              ]}
            />
            <Line
              type="monotone"
              dataKey="units"
              stroke="#14333b"
              strokeWidth={2}
              dot={{ r: 3, fill: "#14333b" }}
              activeDot={{ r: 5, fill: "#14333b" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
