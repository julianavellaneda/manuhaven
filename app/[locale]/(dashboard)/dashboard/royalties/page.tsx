import { RoyaltyDashboard } from "@/components/royalties/RoyaltyDashboard";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { listProjectOptions } from "@/lib/db/queries/projects";
import { listRoyalties } from "@/lib/db/queries/royalties";
import { aggregateRoyalties } from "@/lib/royalties/aggregate";

export default async function RoyaltiesPage() {
  const t = await getTranslations("pages.royalties");
  const user = await requireUser();

  const [royaltyRows, projectRows] = await Promise.all([
    listRoyalties(user.id),
    listProjectOptions(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {t("heading")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <RoyaltyDashboard
        projects={projectRows}
        {...aggregateRoyalties(royaltyRows)}
      />
    </div>
  );
}
