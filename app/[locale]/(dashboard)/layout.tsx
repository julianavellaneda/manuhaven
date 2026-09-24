import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/queries/users";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  const displayName = profile?.displayName || user.email.split("@")[0] || "Author";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardShell
      email={profile?.email || user.email}
      displayName={displayName}
      initials={initials}
    >
      {children}
    </DashboardShell>
  );
}
