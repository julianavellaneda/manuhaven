import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { authFeatures } from "@/lib/auth/features";

export default async function ForgotPasswordPage() {
  // Without email there is no way to deliver a reset link.
  if (!authFeatures().email) {
    return redirect({ href: "/login", locale: await getLocale() });
  }

  const t = await getTranslations("auth");

  return (
    <AuthPageShell title={t("forgotTitle")} subtitle={t("forgotSubtitle")}>
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
