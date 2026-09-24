import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: "Terms — ManuHaven", ...localeMetadata(locale, "/terms") };
}

export default async function TermsPage() {
  const t = await getTranslations("marketing.terms");

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
