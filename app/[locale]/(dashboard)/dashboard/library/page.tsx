import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function LibraryPage() {
  const t = await getTranslations("pages.library");
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

      <div className="flex flex-col items-center justify-center rounded-xl bg-card py-16 shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)]">
          <BookOpen className="size-7 text-white/80" />
        </div>
        <h2 className="mt-5 font-serif text-lg font-medium text-foreground">
          {t("emptyHeading")}
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          {t("emptyBody")}
        </p>
      </div>
    </div>
  );
}
