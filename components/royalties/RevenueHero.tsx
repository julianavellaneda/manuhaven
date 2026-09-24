import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";

interface RevenueHeroProps {
  totalRevenue: number;
  monthlyRevenue: number;
  totalUnits: number;
}

export async function RevenueHero({
  totalRevenue,
  monthlyRevenue,
  totalUnits,
}: RevenueHeroProps) {
  const t = await getTranslations("royalties.revenueHero");
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-1 rounded-xl bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("totalRevenue")}
        </p>
        <p className="mt-2 font-serif text-4xl font-bold text-foreground">
          {formatCurrency(totalRevenue)}
        </p>
      </div>
      <div className="rounded-xl bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("thisMonth")}
        </p>
        <p className="mt-2 font-serif text-2xl font-semibold text-foreground">
          {formatCurrency(monthlyRevenue)}
        </p>
      </div>
      <div className="rounded-xl bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("unitsSold")}
        </p>
        <p className="mt-2 font-serif text-2xl font-semibold text-foreground">
          {totalUnits.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
