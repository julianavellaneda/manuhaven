import { getTranslations, getLocale } from "next-intl/server";
import { toIntlLocale } from "@/i18n/routing";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { DeleteAccountButton } from "@/components/dashboard/DeleteAccountButton";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/queries/users";

export default async function ProfilePage() {
  const t = await getTranslations("pages.profile");
  const intlLocale = toIntlLocale(await getLocale());
  const user = await requireUser();
  const profile = await getProfile(user.id);

  const displayName =
    profile?.displayName || user.email.split("@")[0] || "Author";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const email = profile?.email || user.email;
  const memberSince = profile
    ? profile.createdAt.toLocaleDateString(intlLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

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

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-sidebar text-sm text-sidebar-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="font-serif text-lg">
                {displayName}
              </CardTitle>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("labelDisplayName")}
              </p>
              <p className="mt-1 text-foreground">{displayName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("labelEmail")}
              </p>
              <p className="mt-1 truncate text-foreground">{email}</p>
            </div>
            {memberSince && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("labelMemberSince")}
                </p>
                <p className="mt-1 text-foreground">{memberSince}</p>
              </div>
            )}
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="flex items-center justify-between py-4">
          <p className="text-xs text-muted-foreground">
            {t("signOutHint")}
          </p>
          <LogoutButton />
        </CardFooter>
      </Card>

      <Card className="max-w-2xl border-destructive/30">
        <CardHeader>
          <CardTitle className="font-serif text-base text-destructive">
            {t("dangerZoneHeading")}
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardFooter className="flex items-center justify-between py-4">
          <p className="text-xs text-muted-foreground">
            {t("dangerZoneDescription")}
          </p>
          <DeleteAccountButton />
        </CardFooter>
      </Card>
    </div>
  );
}
