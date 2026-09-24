"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { Link, getPathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { authErrorKey, type AuthErrorKey } from "./auth-errors";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Succeeds whether or not the account exists, so the form can't be used
    // to find out who has one.
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: getPathname({ href: "/reset-password", locale }),
    });
    setLoading(false);
    if (error) {
      setError(authErrorKey(error.code, error.status));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {t.rich("resetLinkSent", {
              email,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <Link href="/login" className="text-sm underline underline-offset-4">
            {t("backToSignIn")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="pb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("sendingResetLink") : t("sendResetLink")}
          </Button>
          <Link
            href="/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("backToSignIn")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
