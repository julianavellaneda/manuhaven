import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// The settings row the mocked query returns. Tests mutate this.
let settingsRow: Record<string, unknown> | null = null;

vi.mock("@/lib/db/queries/ai-settings", () => ({
  getAiSettingsWithCipher: async () => settingsRow,
}));

import { resolveModelForUser } from "@/lib/ai/assistant/models";
import { NoAIKeyConfiguredError } from "@/lib/ai/errors";
import { encryptApiKey } from "@/lib/ai/key-crypto";

const USER = "user-1";

beforeEach(() => {
  settingsRow = null;
  vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", "test-secret");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  vi.stubEnv("ASSISTANT_CHAT_MODEL", "");
  vi.stubEnv("ASSISTANT_UTILITY_MODEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveModelForUser — key precedence", () => {
  it("prefers the user's key over the server env key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-server");
    settingsRow = {
      provider: "anthropic",
      chatModel: null,
      utilityModel: null,
      apiKeyCipher: encryptApiKey("sk-user"),
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.keySource).toBe("user");
  });

  it("falls back to the server env key when the user has none", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-server");
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.keySource).toBe("server");
    expect(resolved.spec).toBe("anthropic:claude-sonnet-4-6");
  });

  it("throws NoAIKeyConfiguredError when neither exists", async () => {
    await expect(resolveModelForUser(USER, "chat")).rejects.toThrow(
      NoAIKeyConfiguredError
    );
  });

  it("does not use a saved key belonging to another provider", async () => {
    // Key saved for OpenAI, but the resolved spec is Anthropic's default.
    settingsRow = {
      provider: "openai",
      chatModel: "anthropic:claude-sonnet-4-6",
      utilityModel: null,
      apiKeyCipher: encryptApiKey("sk-user-openai"),
      autonomy: "lite",
    };
    await expect(resolveModelForUser(USER, "chat")).rejects.toThrow(
      NoAIKeyConfiguredError
    );
  });

  it("treats an undecryptable key as absent rather than failing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-server");
    settingsRow = {
      provider: "anthropic",
      chatModel: null,
      utilityModel: null,
      apiKeyCipher: "not-valid-ciphertext",
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.keySource).toBe("server");
  });
});

describe("resolveModelForUser — model selection", () => {
  it("uses the user's explicit model override", async () => {
    settingsRow = {
      provider: "openai",
      chatModel: "openai:gpt-5.1-mini",
      utilityModel: null,
      apiKeyCipher: encryptApiKey("sk-user"),
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.spec).toBe("openai:gpt-5.1-mini");
  });

  it("honours ASSISTANT_CHAT_MODEL when the user has no override", async () => {
    vi.stubEnv("ASSISTANT_CHAT_MODEL", "google:gemini-2.5-pro");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "sk-server");
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.spec).toBe("google:gemini-2.5-pro");
  });

  it("picks the chosen provider's default when the env points elsewhere", async () => {
    // Server default is Anthropic; the user picked OpenAI without a model.
    vi.stubEnv("ASSISTANT_CHAT_MODEL", "anthropic:claude-sonnet-4-6");
    settingsRow = {
      provider: "openai",
      chatModel: null,
      utilityModel: null,
      apiKeyCipher: encryptApiKey("sk-user"),
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.spec).toBe("openai:gpt-5.1");
    expect(resolved.keySource).toBe("user");
  });

  it("resolves the utility model independently of the chat model", async () => {
    settingsRow = {
      provider: "anthropic",
      chatModel: "anthropic:claude-sonnet-4-6",
      utilityModel: "anthropic:claude-haiku-4-5",
      apiKeyCipher: encryptApiKey("sk-user"),
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "utility");
    expect(resolved.spec).toBe("anthropic:claude-haiku-4-5");
  });
});

describe("resolveModelForUser — server key allow-list", () => {
  it("replaces an arbitrary saved model with the server's when billing the server key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-server");
    settingsRow = {
      provider: "anthropic",
      chatModel: "anthropic:claude-opus-4-1",
      utilityModel: null,
      apiKeyCipher: null,
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.keySource).toBe("server");
    expect(resolved.spec).toBe("anthropic:claude-sonnet-4-6");
  });

  it("allows a provider default on the server key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-server");
    settingsRow = {
      provider: "openai",
      chatModel: null,
      utilityModel: null,
      apiKeyCipher: null,
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.keySource).toBe("server");
    expect(resolved.spec).toBe("openai:gpt-5.1");
  });

  it("keeps any model when the user pays with their own key", async () => {
    settingsRow = {
      provider: "anthropic",
      chatModel: "anthropic:claude-opus-4-1",
      utilityModel: null,
      apiKeyCipher: encryptApiKey("sk-user"),
      autonomy: "lite",
    };
    const resolved = await resolveModelForUser(USER, "chat");
    expect(resolved.spec).toBe("anthropic:claude-opus-4-1");
  });
});
