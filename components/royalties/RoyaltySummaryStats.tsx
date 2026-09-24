import { useTranslations, useLocale } from "next-intl";
import { DollarSign, ShoppingCart, Store, Globe } from "lucide-react";
import { toIntlLocale } from "@/i18n/routing";
import { formatCurrency } from "@/lib/utils";
import type { RoyaltySummary } from "@/lib/royalties/aggregate";

export function RoyaltySummaryStats({ summary }: { summary: RoyaltySummary }) {
  const t = useTranslations("royalties.dashboard");
  const intlLocale = toIntlLocale(useLocale());

  return (
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
  );
}

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
