import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button-variants";

export async function Hero() {
  const t = await getTranslations("marketing.hero");
  const tCommon = await getTranslations("common");

  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-muted/40" />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:py-32">
        <div className="flex flex-col justify-center">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("badge")}
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
            {t("subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="https://github.com/julianavellaneda/manuhaven#quick-start"
              className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })}
            >
              {tCommon("selfHost")}
            </a>
            <a
              href="#pillars"
              className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-5 text-base" })}
            >
              {t("seeHowItWorks")}
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {t("license")}
          </p>
        </div>

        <div
          aria-hidden
          className="relative hidden md:block"
        >
          <div className="absolute inset-0 rounded-3xl border border-border/60 bg-gradient-to-br from-muted/40 via-background to-muted/20 shadow-2xl shadow-foreground/5" />
          <div className="relative aspect-[4/5] rounded-3xl p-8">
            <div className="flex h-full flex-col gap-3">
              <div className="h-2 w-24 rounded-full bg-foreground/10" />
              <div className="h-2 w-40 rounded-full bg-foreground/10" />
              <div className="mt-4 h-px w-full bg-border" />
              <div className="space-y-2 pt-2">
                <div className="h-2 w-full rounded-full bg-foreground/10" />
                <div className="h-2 w-[92%] rounded-full bg-foreground/10" />
                <div className="h-2 w-[88%] rounded-full bg-foreground/10" />
                <div className="h-2 w-[80%] rounded-full bg-foreground/10" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="h-12 rounded-xl bg-foreground/5" />
                <div className="h-12 rounded-xl bg-foreground/5" />
                <div className="h-12 rounded-xl bg-foreground/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
