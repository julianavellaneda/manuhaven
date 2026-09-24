import { getTranslations } from "next-intl/server";
import { PenLine, Sparkles, BookCheck, BarChart3 } from "lucide-react";

export async function Pillars() {
  const t = await getTranslations("marketing.pillars");

  const PILLARS = [
    { icon: PenLine,   titleKey: "p1Title", bodyKey: "p1Body" },
    { icon: Sparkles,  titleKey: "p2Title", bodyKey: "p2Body" },
    { icon: BookCheck, titleKey: "p3Title", bodyKey: "p3Body" },
    { icon: BarChart3, titleKey: "p4Title", bodyKey: "p4Body" },
  ] as const;

  return (
    <section id="pillars" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-2">
          {PILLARS.map(({ icon: Icon, titleKey, bodyKey }) => (
            <article
              key={titleKey}
              className="rounded-2xl border border-border/60 bg-card/50 p-6 transition-colors hover:bg-card"
            >
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="font-serif text-xl font-semibold tracking-tight">
                {t(titleKey)}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t(bodyKey)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
