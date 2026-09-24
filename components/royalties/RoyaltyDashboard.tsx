"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toIntlLocale } from "@/i18n/routing";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  Upload,
  FileSpreadsheet,
  DollarSign,
  ShoppingCart,
  Store,
  Globe,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  title: string;
}

interface RetailerMonthly {
  month: string;
  amazon: number;
  apple: number;
  kobo: number;
  streetlib: number;
  bn: number;
  google: number;
}

interface UnitsMonthly {
  month: string;
  units: number;
}

interface TerritoryData {
  territory: string;
  revenue: number;
}

interface Summary {
  totalRevenue: number;
  totalUnits: number;
  activeRetailers: number;
  topTerritory: string;
}

interface ParsedRecord {
  retailer: string;
  territory: string;
  unitsSold: number;
  unitsReturned: number;
  revenue: number;
  currency: string;
  revenueUsd: number;
  periodStart: string;
  periodEnd: string;
  projectId: string;
}

interface RoyaltyDashboardProps {
  projects: Project[];
  retailerMonthlyData: RetailerMonthly[];
  unitsMonthlyData: UnitsMonthly[];
  territoryData: TerritoryData[];
  summary: Summary;
}

// ---------------------------------------------------------------------------
// Retailer display config
// ---------------------------------------------------------------------------

const RETAILER_COLORS: Record<string, string> = {
  amazon: "#FF9900",
  apple: "#555555",
  kobo: "#BF0D3E",
  streetlib: "#00A4E4",
  bn: "#346B21",
  google: "#4285F4",
};

const RETAILER_LABELS: Record<string, string> = {
  amazon: "Amazon KDP",
  apple: "Apple Books",
  kobo: "Kobo",
  streetlib: "StreetLib",
  bn: "Barnes & Noble",
  google: "Google Play",
};

const CSV_RETAILERS = [
  { value: "amazon", label: "Amazon KDP" },
  { value: "apple", label: "Apple Books" },
  { value: "kobo", label: "Kobo" },
  { value: "streetlib", label: "StreetLib" },
];

// ---------------------------------------------------------------------------
// Month label helper
// ---------------------------------------------------------------------------

function monthLabel(monthKey: string, intlLocale: string): string {
  const [year, month] = monthKey.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(intlLocale, { month: "short", year: "2-digit" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoyaltyDashboard({
  projects,
  retailerMonthlyData,
  unitsMonthlyData,
  territoryData,
  summary,
}: RoyaltyDashboardProps) {
  const t = useTranslations("royalties.dashboard");
  const intlLocale = toIntlLocale(useLocale());
  // Upload state
  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<ParsedRecord[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.toLowerCase().endsWith(".csv")) {
      setFile(droppedFile);
      setUploadResult(null);
      setPreviewRecords([]);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFile(selected);
        setUploadResult(null);
        setPreviewRecords([]);
      }
    },
    []
  );

  const callUploadAPI = useCallback(
    async (preview: boolean) => {
      if (!file || !selectedRetailer || !selectedProject) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("retailer", selectedRetailer);
      formData.append("projectId", selectedProject);

      const url = preview
        ? "/api/royalties/upload?preview=true"
        : "/api/royalties/upload";

      const res = await fetch(url, { method: "POST", body: formData });
      const data = await res.json();
      return { ok: res.ok, data };
    },
    [file, selectedRetailer, selectedProject]
  );

  const handlePreview = useCallback(async () => {
    setPreviewing(true);
    setUploadResult(null);
    try {
      const result = await callUploadAPI(true);
      if (result?.ok) {
        setPreviewRecords(result.data.records);
      } else {
        setUploadResult({
          type: "error",
          message: result?.data?.error || "Failed to parse CSV",
        });
      }
    } catch {
      setUploadResult({ type: "error", message: "Network error" });
    } finally {
      setPreviewing(false);
    }
  }, [callUploadAPI]);

  const handleImport = useCallback(async () => {
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await callUploadAPI(false);
      if (result?.ok) {
        setUploadResult({
          type: "success",
          message: `Successfully imported ${result.data.count} royalty records`,
        });
        setPreviewRecords([]);
        setFile(null);
      } else {
        setUploadResult({
          type: "error",
          message: result?.data?.error || "Failed to import records",
        });
      }
    } catch {
      setUploadResult({ type: "error", message: "Network error" });
    } finally {
      setUploading(false);
    }
  }, [callUploadAPI]);

  const canPreview = file && selectedRetailer && selectedProject;

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label={t("statTotalRevenue")}
          value={formatCurrency(summary.totalRevenue)}
        />
        <StatCard
          icon={ShoppingCart}
          label={t("statUnitsSold")}
          value={summary.totalUnits.toLocaleString(intlLocale)}
        />
        <StatCard
          icon={Store}
          label={t("statActiveRetailers")}
          value={String(summary.activeRetailers)}
        />
        <StatCard
          icon={Globe}
          label={t("statTopTerritory")}
          value={summary.topTerritory}
        />
      </div>

      {/* CSV Upload Section */}
      <div className="rounded-xl bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
          {t("importSalesReport")}
        </h2>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          {/* Left: selectors + drop zone */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[180px]">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("labelRetailer")}
                </label>
                <Select
                  value={selectedRetailer}
                  onValueChange={(v) => setSelectedRetailer(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("placeholderRetailer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CSV_RETAILERS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[220px]">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("labelProject")}
                </label>
                <Select
                  value={selectedProject}
                  onValueChange={(v) => setSelectedProject(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("placeholderProject")} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "relative flex min-h-[120px] cursor-pointer items-center justify-center rounded-xl p-6 transition-colors",
                "bg-muted/40",
                dragOver
                  ? "bg-accent/30 shadow-inner"
                  : "hover:bg-muted/60",
                // Ghost dashed border at 30% opacity — uses border (not ring) per design system
                "border border-dashed border-foreground/[.12]"
              )}
              onClick={() => document.getElementById("csv-input")?.click()}
            >
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="text-center">
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="size-8 text-primary/60" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-2 size-8 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">
                      {t("dropZonePrompt")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {t("dropZoneFormats")}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-col justify-end gap-2 lg:w-40">
            <Button
              onClick={handlePreview}
              disabled={!canPreview || previewing}
              variant="outline"
              className="w-full"
            >
              {previewing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t("btnParsePreview")}
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                !canPreview || uploading || previewRecords.length === 0
              }
              className="w-full bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)] text-white hover:opacity-90"
            >
              {uploading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t("btnImport")}
            </Button>
          </div>
        </div>

        {/* Upload result message */}
        {uploadResult && (
          <div
            className={cn(
              "mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm",
              uploadResult.type === "success"
                ? "bg-published/20 text-foreground"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {uploadResult.type === "success" ? (
              <CheckCircle className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {uploadResult.message}
          </div>
        )}

        {/* Preview table */}
        {previewRecords.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              {t("previewCount", { count: previewRecords.length })}
            </h3>
            <div className="max-h-64 overflow-auto rounded-lg bg-muted/30">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("colRetailer")}</th>
                    <th className="px-3 py-2 font-medium">{t("colTerritory")}</th>
                    <th className="px-3 py-2 font-medium text-right">{t("colUnits")}</th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t("colRevenue")}
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t("colUsd")}
                    </th>
                    <th className="px-3 py-2 font-medium">{t("colPeriod")}</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRecords.map((r, i) => (
                    <tr
                      key={i}
                      className="text-foreground/80 even:bg-muted/20"
                    >
                      <td className="px-3 py-1.5">
                        {RETAILER_LABELS[r.retailer] || r.retailer}
                      </td>
                      <td className="px-3 py-1.5">{r.territory}</td>
                      <td className="px-3 py-1.5 text-right">
                        {r.unitsSold}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {r.revenue.toFixed(2)} {r.currency}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {formatCurrency(r.revenueUsd)}
                      </td>
                      <td className="px-3 py-1.5">
                        {new Date(r.periodStart).toLocaleDateString(intlLocale, {
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Retailer */}
        <div className="rounded-xl bg-card p-6 shadow-sm">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            {t("chartRevenueByRetailer")}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={retailerMonthlyData.map((d) => ({
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
                  tick={{ fontSize: 11, fill: "#888" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#888" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "none",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    fontSize: "0.75rem",
                  }}
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

        {/* Revenue by Territory */}
        <div className="rounded-xl bg-card p-6 shadow-sm">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            {t("chartRevenueByTerritory")}
          </h3>
          <div className="h-72">
            {territoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={territoryData}
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
                    tick={{ fontSize: 11, fill: "#888" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="territory"
                    tick={{ fontSize: 11, fill: "#888" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      fontSize: "0.75rem",
                    }}
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
      </div>

      {/* Units Sold Over Time */}
      <div className="rounded-xl bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
          {t("chartUnitsSoldOverTime")}
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={unitsMonthlyData.map((d) => ({
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
                tick={{ fontSize: 11, fill: "#888" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#888" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.5rem",
                  border: "none",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  fontSize: "0.75rem",
                }}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard sub-component
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/[.06]">
          <Icon className="size-5 text-primary/70" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}
