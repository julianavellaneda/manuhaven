"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("dashboard.logout");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setPending(true);
    setError(null);
    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) {
        setError(t("failed"));
        setPending(false);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError(t("failed"));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="destructive"
        onClick={handleLogout}
        disabled={pending}
        className="gap-2"
      >
        <LogOut className="size-4" />
        {pending ? t("signingOut") : t("logOut")}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
