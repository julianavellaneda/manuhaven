"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { authErrorKey, type AuthErrorKey } from "./auth-errors";

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<AuthErrorKey | "passwordMismatch" | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <Card>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-destructive">{t("resetLinkInvalid")}</p>
          <Link
            href="/forgot-password"
            className="text-sm underline underline-offset-4"
          >
            {t("requestNewLink")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("passwordMismatch");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (error) {
      setError(authErrorKey(error.code, error.status));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">{t("passwordUpdated")}</p>
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
            <Label htmlFor="password">{t("newPasswordLabel")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t("confirmPasswordLabel")}</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("updatingPassword") : t("updatePassword")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
