import { getTranslations } from "next-intl/server";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

// The emailed link goes through /api/auth/reset-password/<token>, which
// redirects here with ?token=… (or ?error=INVALID_TOKEN).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthPageShell title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      <ResetPasswordForm token={error ? undefined : token} />
    </AuthPageShell>
  );
}
