import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { AIAPIError, NoAIKeyConfiguredError } from "@/lib/ai/errors";
import { decryptApiKey } from "@/lib/ai/key-crypto";
import { getAiSettingsWithCipher } from "@/lib/db/queries/ai-settings";

/**
 * Model registry. Parses `"provider:modelId"` strings so vendor and model swap
 * with a settings change or an env edit, never a deploy. The resolved spec is
 * recorded on every ai_usage_events row so cost and latency stay comparable
 * across vendors.
 *
 * Keys resolve user-first: a key saved in Settings → AI wins over the server's
 * env key. A self-hosted install typically has only the former; a hosted
 * deployment supplies the latter as a fallback for users who have not brought
 * their own.
 */

export const DEFAULT_CHAT_MODEL = "anthropic:claude-sonnet-4-6";
export const DEFAULT_UTILITY_MODEL = "anthropic:claude-haiku-4-5";

const PROVIDER_API_KEYS = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
} as const;

export type AssistantProvider = keyof typeof PROVIDER_API_KEYS;

export const ASSISTANT_PROVIDERS = Object.keys(
  PROVIDER_API_KEYS
) as AssistantProvider[];

export interface ResolvedLanguageModel {
  model: LanguageModel;
  /** The exact "provider:modelId" string that was resolved. */
  spec: string;
  /** Whether the API key came from the user's settings or the server env. */
  keySource: "user" | "server";
}

export function parseModelSpec(spec: string): {
  provider: AssistantProvider;
  modelId: string;
} {
  const sep = spec.indexOf(":");
  const provider = sep === -1 ? "" : spec.slice(0, sep).trim();
  const modelId = sep === -1 ? "" : spec.slice(sep + 1).trim();
  if (!(provider in PROVIDER_API_KEYS) || modelId.length === 0) {
    throw new AIAPIError(
      `Invalid assistant model spec "${spec}" — expected "provider:modelId" with provider one of ${Object.keys(PROVIDER_API_KEYS).join(", ")}`
    );
  }
  return { provider: provider as AssistantProvider, modelId };
}

/** The server-side env key for a provider, if one is configured. */
export function serverApiKey(provider: AssistantProvider): string | undefined {
  const value = process.env[PROVIDER_API_KEYS[provider]];
  return value && value.length > 0 ? value : undefined;
}

function buildModel(
  provider: AssistantProvider,
  modelId: string,
  apiKey: string
): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
  }
}

/**
 * Resolve a model from a spec and an explicit key. Pure — no env, no database.
 * Callers that need the user's saved key should use `resolveModelForUser`.
 */
export function resolveLanguageModel(
  spec: string,
  apiKey?: string
): ResolvedLanguageModel {
  const { provider, modelId } = parseModelSpec(spec);
  const key = apiKey ?? serverApiKey(provider);
  if (!key) throw new NoAIKeyConfiguredError(provider);
  return {
    model: buildModel(provider, modelId, key),
    spec,
    keySource: apiKey ? "user" : "server",
  };
}

export interface UserAISettings {
  provider: AssistantProvider | null;
  chatModel: string | null;
  utilityModel: string | null;
  apiKey: string | null;
  autonomy: string;
}

/**
 * Load a user's AI settings, decrypting the API key.
 *
 * Callers must pass a user id they have already authenticated.
 */
export async function loadUserAISettings(
  userId: string
): Promise<UserAISettings | null> {
  const data = await getAiSettingsWithCipher(userId);
  if (!data) return null;

  let apiKey: string | null = null;
  if (data.apiKeyCipher) {
    try {
      apiKey = decryptApiKey(data.apiKeyCipher);
    } catch {
      // A key we cannot decrypt (rotated AI_KEY_ENCRYPTION_SECRET, corrupted
      // row) is treated as absent so resolution falls through to the server
      // key or a clean "no key configured" error. Never log the ciphertext.
      apiKey = null;
    }
  }

  return {
    provider: (data.provider as AssistantProvider | null) ?? null,
    chatModel: data.chatModel,
    utilityModel: data.utilityModel,
    apiKey,
    autonomy: data.autonomy,
  };
}

/** The model the operator configured for `kind`, or the built-in default. */
function serverSpecFor(kind: "chat" | "utility"): string {
  const envSpec =
    kind === "chat"
      ? process.env.ASSISTANT_CHAT_MODEL
      : process.env.ASSISTANT_UTILITY_MODEL;
  return envSpec || (kind === "chat" ? DEFAULT_CHAT_MODEL : DEFAULT_UTILITY_MODEL);
}

function specFor(
  kind: "chat" | "utility",
  settings: UserAISettings | null
): string {
  const userSpec = kind === "chat" ? settings?.chatModel : settings?.utilityModel;
  if (userSpec) return userSpec;

  // A user who picked a provider but no explicit model gets that provider's
  // default rather than the server's, which may point at a different vendor.
  const base = serverSpecFor(kind);
  if (settings?.provider) {
    const { provider, modelId } = parseModelSpec(base);
    if (provider !== settings.provider) {
      return `${settings.provider}:${defaultModelFor(settings.provider, kind)}`;
    }
    return `${provider}:${modelId}`;
  }
  return base;
}

/**
 * The models the server's own key will pay for: the operator's configured
 * specs and each provider's defaults. Anything else a user saves only runs on
 * their own key.
 */
function isServerBillableSpec(spec: string): boolean {
  if (spec === serverSpecFor("chat") || spec === serverSpecFor("utility")) {
    return true;
  }
  return ASSISTANT_PROVIDERS.some(
    (provider) =>
      spec === `${provider}:${defaultModelFor(provider, "chat")}` ||
      spec === `${provider}:${defaultModelFor(provider, "utility")}`
  );
}

function defaultModelFor(
  provider: AssistantProvider,
  kind: "chat" | "utility"
): string {
  switch (provider) {
    case "anthropic":
      return kind === "chat" ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    case "openai":
      return kind === "chat" ? "gpt-5.1" : "gpt-5.1-mini";
    case "google":
      return kind === "chat" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  }
}

/**
 * Resolve a model for a specific user: their saved key first, then the
 * server's env key, then `NoAIKeyConfiguredError`.
 */
export async function resolveModelForUser(
  userId: string,
  kind: "chat" | "utility"
): Promise<ResolvedLanguageModel> {
  const settings = await loadUserAISettings(userId);
  const spec = specFor(kind, settings);
  const { provider } = parseModelSpec(spec);

  // The saved key only applies to the provider it was saved for.
  const userKey =
    settings?.apiKey && settings.provider === provider
      ? settings.apiKey
      : undefined;

  if (userKey) return resolveLanguageModel(spec, userKey);
  // On the server's key, a model the operator didn't choose falls back to the
  // one they did, so a saved spec can't bill an arbitrary model to the server.
  return resolveLanguageModel(
    isServerBillableSpec(spec) ? spec : serverSpecFor(kind)
  );
}
