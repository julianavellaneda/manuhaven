import { KeyRound } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface Props {
  title: string;
  body: string;
  cta: string;
}

/**
 * Shared "no AI key configured" notice. Every AI feature's route maps
 * `NoAIKeyConfiguredError` to a 409 `no_ai_key` response (see
 * lib/ai/errors.ts) — this is the one place that turns it into a link to
 * Settings → AI instead of showing the raw error message. Callers resolve
 * their own (already-namespaced) copy via `useTranslations` and pass the
 * three strings in, so this stays a plain presentational component.
 */
export function NoAiKeyNotice({ title, body, cta }: Props) {
  return (
    <div className="mx-3 mb-2 rounded border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <KeyRound className="size-3.5" />
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {body}
      </p>
      <Link
        href="/dashboard/settings/ai"
        className="mt-2 inline-block text-xs font-medium text-primary underline underline-offset-2"
      >
        {cta}
      </Link>
    </div>
  );
}
