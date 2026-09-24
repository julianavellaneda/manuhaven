"use client";

import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

interface RetailerData {
  retailer: string;
  revenue: number;
}

interface RetailerMixProps {
  data: RetailerData[];
}

const COLORS = [
  "#14333b",
  "#2c4a52",
  "#4a7c8a",
  "#78909c",
  "#a3c1cc",
  "#c8e8f2",
  "#e1e3e4",
];

export function RetailerMix({ data }: RetailerMixProps) {
  const t = useTranslations("royalties.retailerMix");
  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
        {t("title")}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="retailer"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "0.5rem",
                border: "none",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                fontSize: "0.75rem",
              }}
              formatter={(value) => [`$${Number(value).toLocaleString()}`, t("tooltipRevenue")]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "0.7rem" }}
              formatter={(value: string) =>
                value.charAt(0).toUpperCase() + value.slice(1)
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
