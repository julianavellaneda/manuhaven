import { getTranslations } from "next-intl/server";

export async function Faq() {
  const t = await getTranslations("marketing.faq");

  const FAQS = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
    { q: t("q4"), a: t("a4") },
    { q: t("q5"), a: t("a5") },
    { q: t("q6"), a: t("a6") },
  ];

  return (
    <section id="faq" className="border-b border-border/60">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          {t("heading")}
        </h2>
        <div className="mt-10 divide-y divide-border/60">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group py-5"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left font-serif text-lg font-semibold marker:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="mt-1 text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
