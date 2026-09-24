"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_PROVIDER = "none";

interface InitialSettings {
  provider: string | null;
  chatModel: string;
  utilityModel: string;
  autonomy: string;
  /** Redacted display value, e.g. "sk-ant-…4f2a". Null when no key is stored. */
  keyHint: string | null;
}

interface Props {
  initial: InitialSettings;
  /** False when AI_KEY_ENCRYPTION_SECRET is unset, so keys cannot be stored. */
  encryptionAvailable: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "testing" }
  | { kind: "tested"; model: string }
  | { kind: "error"; message: string };

export function AiSettingsForm({ initial, encryptionAvailable }: Props) {
  const t = useTranslations("pages.settingsAi");

  const [provider, setProvider] = useState(initial.provider ?? NO_PROVIDER);
  const [chatModel, setChatModel] = useState(initial.chatModel);
  const [utilityModel, setUtilityModel] = useState(initial.utilityModel);
  const [autonomy, setAutonomy] = useState(initial.autonomy);
  const [keyHint, setKeyHint] = useState(initial.keyHint);
  // Null means "leave the stored key alone"; a string means replace it.
  const [apiKey, setApiKey] = useState<string | null>(
    initial.keyHint ? null : ""
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const busy = status.kind === "saving" || status.kind === "testing";

  const PROVIDERS = [
    { value: NO_PROVIDER, label: t("providerNone") },
    { value: "anthropic", label: t("providerAnthropic") },
    { value: "openai", label: t("providerOpenai") },
    { value: "google", label: t("providerGoogle") },
  ];

  const AUTONOMY = [
    { value: "off", label: t("autonomyOff") },
    { value: "lite", label: t("autonomyLite") },
    { value: "editorial", label: t("autonomyEditorial") },
    { value: "collaborator", label: t("autonomyCollaborator") },
  ];

  async function handleSave() {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider === NO_PROVIDER ? null : provider,
          chatModel: chatModel.trim() || null,
          utilityModel: utilityModel.trim() || null,
          autonomy,
          // Omit the field entirely to keep the existing key.
          ...(apiKey === null ? {} : { apiKey }),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.code === "no_encryption_secret" ? t("noSecret") : t("saveFailed")
        );
      }
      setKeyHint(body.settings?.keyHint ?? null);
      setApiKey(body.settings?.keyHint ? null : "");
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : t("saveFailed"),
      });
    }
  }

  async function handleTest() {
    setStatus({ kind: "testing" });
    try {
      const res = await fetch("/api/settings/ai/test", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "");
      setStatus({ kind: "tested", model: body.model });
    } catch (err) {
      setStatus({
        kind: "error",
        message: t("testFailed", {
          message: err instanceof Error ? err.message : "",
        }),
      });
    }
  }

  return (
    <Card className="max-w-2xl space-y-6 p-6">
      {!encryptionAvailable && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {t("noSecret")}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="ai-provider">{t("providerLabel")}</Label>
        <Select
          value={provider}
          onValueChange={(v) => setProvider(v ?? NO_PROVIDER)}
          disabled={busy}
        >
          <SelectTrigger id="ai-provider" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("providerHelp")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-key">{t("keyLabel")}</Label>
        {apiKey === null ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs">
              <Check className="size-3.5 text-emerald-600" />
              {keyHint}
            </span>
            <Button variant="outline" size="sm" onClick={() => setApiKey("")}>
              {t("keyReplace")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id="ai-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("keyPlaceholder")}
              disabled={busy || !encryptionAvailable}
            />
            {keyHint && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setApiKey(null)}
                disabled={busy}
              >
                {t("keyCancel")}
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("keyHelp")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-chat-model">{t("chatModelLabel")}</Label>
          <Input
            id="ai-chat-model"
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            placeholder={t("modelPlaceholder")}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-utility-model">{t("utilityModelLabel")}</Label>
          <Input
            id="ai-utility-model"
            value={utilityModel}
            onChange={(e) => setUtilityModel(e.target.value)}
            placeholder={t("modelPlaceholder")}
            disabled={busy}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{t("modelHelp")}</p>

      <div className="space-y-2">
        <Label htmlFor="ai-autonomy">{t("autonomyLabel")}</Label>
        <Select
          value={autonomy}
          onValueChange={(v) => setAutonomy(v ?? "lite")}
          disabled={busy}
        >
          <SelectTrigger id="ai-autonomy" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTONOMY.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button onClick={handleSave} disabled={busy}>
          {status.kind === "saving" && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          )}
          {status.kind === "saving" ? t("saving") : t("save")}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={busy || provider === NO_PROVIDER}
        >
          {status.kind === "testing" && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          )}
          {status.kind === "testing" ? t("testing") : t("test")}
        </Button>

        {status.kind === "saved" && (
          <span className="text-xs text-emerald-600">{t("saved")}</span>
        )}
        {status.kind === "tested" && (
          <span className="text-xs text-emerald-600">
            {t("testOk", { model: status.model })}
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-xs text-destructive">{status.message}</span>
        )}
      </div>
    </Card>
  );
}
