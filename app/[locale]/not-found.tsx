import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("marketing.notFound");
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <Link href="/" className="text-sm underline underline-offset-4">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
