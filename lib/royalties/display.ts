// Display config and formatters shared by the royalty dashboard's charts,
// import preview and summary.

export const RETAILER_COLORS: Record<string, string> = {
  amazon: "#FF9900",
  apple: "#555555",
  kobo: "#BF0D3E",
  streetlib: "#00A4E4",
  bn: "#346B21",
  google: "#4285F4",
};

export const RETAILER_LABELS: Record<string, string> = {
  amazon: "Amazon KDP",
  apple: "Apple Books",
  kobo: "Kobo",
  streetlib: "StreetLib",
  bn: "Barnes & Noble",
  google: "Google Play",
};

/** Retailers whose CSV exports the importer can parse. */
export const CSV_RETAILERS = [
  { value: "amazon", label: "Amazon KDP" },
  { value: "apple", label: "Apple Books" },
  { value: "kobo", label: "Kobo" },
  { value: "streetlib", label: "StreetLib" },
];

/** Tooltip box style shared by every dashboard chart. */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: "0.5rem",
  border: "none",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  fontSize: "0.75rem",
};

/** Axis tick style shared by every dashboard chart. */
export const CHART_TICK = { fontSize: 11, fill: "#888" };

/** "2026-03" -> "Mar 26" (in the given Intl locale). */
export function monthLabel(monthKey: string, intlLocale: string): string {
  const [year, month] = monthKey.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(intlLocale, { month: "short", year: "2-digit" });
}

/** Compact dollar axis tick: 950 -> "$950", 12000 -> "$12k". */
export function usdTick(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`;
}
