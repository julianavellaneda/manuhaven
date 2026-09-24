"use client";

import { useTranslations, useLocale } from "next-intl";
import { toIntlLocale } from "@/i18n/routing";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data: DataPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const t = useTranslations("royalties.revenueChart");
  const intlLocale = toIntlLocale(useLocale());
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.month).toLocaleDateString(intlLocale, {
      month: "short",
      year: "2-digit",
    }),
  }));

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        {t("title")}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2c4a52" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2c4a52" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#888" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#888" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "0.5rem",
                border: "none",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                fontSize: "0.75rem",
              }}
              formatter={(value) => [`$${Number(value).toLocaleString(intlLocale)}`, t("tooltipRevenue")]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#14333b"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
