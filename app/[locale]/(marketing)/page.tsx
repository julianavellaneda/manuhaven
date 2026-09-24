import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { localeMetadata } from "@/lib/seo";
import { Hero } from "@/components/marketing/Hero";
import { Pillars } from "@/components/marketing/Pillars";
import { Faq } from "@/components/marketing/Faq";
import { LandingViewTracker } from "@/components/analytics/LandingViewTracker";
import { getSessionUser } from "@/lib/auth/session";

// The auth-aware redirect reads cookies per request, which opts this route
// into dynamic rendering; `revalidate` would be ignored either way.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localeMetadata(locale, "/");
}

export default async function LandingPage() {
  if (await getSessionUser()) return redirect({ href: "/dashboard", locale: await getLocale() });

  return (
    <>
      <LandingViewTracker />
      <Hero />
      <Pillars />
      <Faq />
    </>
  );
}
