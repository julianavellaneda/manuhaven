import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AiSettingsForm } from "@/components/settings/AiSettingsForm";
import { encryptionAvailable } from "@/lib/ai/key-crypto";
import { requireUser } from "@/lib/auth/session";
import { getAiSettings } from "@/lib/db/queries/ai-settings";

export default async function AiSettingsPage() {
  const t = await getTranslations("pages.settingsAi");
  const user = await requireUser();
  // The hint is what the form needs to render "key set / replace"; the
  // ciphertext never leaves the query layer.
  const settings = await getAiSettings(user.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          {t("back")}
        </Link>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground">
          {t("heading")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <AiSettingsForm
        initial={{
          provider: settings?.provider ?? null,
          chatModel: settings?.chatModel ?? "",
          utilityModel: settings?.utilityModel ?? "",
          autonomy: settings?.autonomy ?? "lite",
          keyHint: settings?.keyHint ?? null,
        }}
        encryptionAvailable={encryptionAvailable()}
      />
    </div>
  );
}
