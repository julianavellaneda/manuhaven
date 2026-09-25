import type { Metadata } from "next";
import { Noto_Serif, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PosthogProvider } from "@/components/analytics/PosthogProvider";
import { PublicEnvScript } from "@/components/config/PublicEnvScript";
import { routing } from "@/i18n/routing";
import { appOrigin } from "@/lib/seo";
import "../globals.css";

const notoSerif = Noto_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    metadataBase: new URL(appOrigin()),
    title: "ManuHaven — Writing Studio",
    description:
      "Write, edit with AI you control, export EPUB and PDF, and track royalties.",
    openGraph: {
      locale: locale === "es" ? "es_MX" : "en_US",
      alternateLocale: locale === "es" ? ["en_US"] : ["es_MX"],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  // Next.js 16: params is a Promise. Validate the segment before rendering.
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Every page renders per request: the CSP nonce from proxy.ts and the
  // runtime config in PublicEnvScript both exist only at request time, so a
  // prerendered page would ship with blocked scripts and build-time config.
  await connection();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${notoSerif.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        {/* Runtime config, so one build runs against any deployment. */}
        <PublicEnvScript />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <PosthogProvider>{children}</PosthogProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
