import { useTranslations, useLocale } from "next-intl";
import { toIntlLocale } from "@/i18n/routing";
import { formatCurrency } from "@/lib/utils";
import { RETAILER_LABELS } from "@/lib/royalties/display";

/** One row as the upload route's `?preview=true` mode returns it. */
export interface ParsedRecord {
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

export function RoyaltyPreviewTable({ records }: { records: ParsedRecord[] }) {
  const t = useTranslations("royalties.dashboard");
  const intlLocale = toIntlLocale(useLocale());

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        {t("previewCount", { count: records.length })}
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
            {records.map((r, i) => (
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
                    timeZone: "UTC",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
