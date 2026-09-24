"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import type { AuthFeatures } from "@/lib/auth/features";
import { Link, getPathname, useRouter as useI18nRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authErrorKey, type AuthErrorKey } from "./auth-errors";

type Mode = "signIn" | "signUp";

export function LoginForm({
  features,
  initialError,
}: {
  features: Pick<AuthFeatures, "signUp" | "email" | "google">;
  initialError?: AuthErrorKey;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const i18nRouter = useI18nRouter();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  // Set once an email has been sent; replaces the form with a notice.
  const [sent, setSent] = useState<"magicLink" | "verification" | null>(null);

  const dashboardUrl = getPathname({ href: "/dashboard", locale });
  const loginUrl = getPathname({ href: "/login", locale });

  function fail(err: { code?: string; status?: number }) {
    setError(authErrorKey(err.code, err.status));
    setLoading(false);
  }

  function enterDashboard() {
    i18nRouter.push("/dashboard");
    router.refresh();
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) return fail(error);
    enterDashboard();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: dashboardUrl,
    });
    if (error) return fail(error);
    // No session means the server requires email verification first.
    if (!data?.token) {
      setSent("verification");
      setLoading(false);
      return;
    }
    enterDashboard();
  }

  async function handleMagicLink() {
    if (!email) {
      setError("emailRequired");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: dashboardUrl,
      errorCallbackURL: loginUrl,
    });
    if (error) return fail(error);
    setSent("magicLink");
    setLoading(false);
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: dashboardUrl,
      errorCallbackURL: loginUrl,
    });
    // On success the browser is already navigating to Google.
    if (error) fail(error);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="text-center space-y-2">
          <p className="font-medium">{t("checkEmail")}</p>
          <p className="text-sm text-muted-foreground">
            {t.rich(sent === "magicLink" ? "magicLinkSent" : "verificationSent", {
              email,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </CardContent>
      </Card>
    );
  }

  const signingUp = mode === "signUp";

  return (
    <Card>
      <form onSubmit={signingUp ? handleSignUp : handleSignIn}>
        <CardContent className="pb-4 space-y-4">
          {features.signUp && (
            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value as Mode);
                setError(null);
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="signIn">{t("signInTab")}</TabsTrigger>
                <TabsTrigger value="signUp">{t("signUpTab")}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {features.google && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                {t("continueWithGoogle")}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{t("or")}</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          {signingUp && (
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              {!signingUp && features.email && (
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={signingUp ? 8 : undefined}
              required={signingUp}
              disabled={loading}
            />
            {signingUp && (
              <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          {signingUp ? (
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("creatingAccount") : t("createAccount")}
            </Button>
          ) : (
            <>
              <Button type="submit" className="w-full" disabled={loading || !password}>
                {loading ? t("signingIn") : t("signIn")}
              </Button>
              {features.email && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={handleMagicLink}
                  disabled={loading}
                >
                  {t("sendMagicLink")}
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
