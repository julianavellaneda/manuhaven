import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: "Privacy — ManuHaven", ...localeMetadata(locale, "/privacy") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("marketing.privacy");

  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">
        {t("heading")}
      </h1>
      <p className="mt-6 text-muted-foreground">
        {t("body")}
      </p>
    </div>
  );
}
