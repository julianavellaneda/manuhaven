import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { authErrorKey } from "@/components/auth/auth-errors";
import { authFeatures } from "@/lib/auth/features";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSessionUser()) {
    return redirect({ href: "/dashboard", locale: await getLocale() });
  }

  const t = await getTranslations("auth");
  // Failed magic-link and OAuth redirects land here with ?error=<code>.
  const { error } = await searchParams;
  const { signUp, email, google } = authFeatures();

  return (
    <AuthPageShell title={t("pageTitle")} subtitle={t("pageSubtitle")}>
      <LoginForm
        features={{ signUp, email, google }}
        initialError={error ? authErrorKey(error) : undefined}
      />
    </AuthPageShell>
  );
}
