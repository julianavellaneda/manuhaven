import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseModelSpec,
  resolveLanguageModel,
} from "@/lib/ai/assistant/models";
import { AIAPIError, NoAIKeyConfiguredError } from "@/lib/ai/errors";

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-google-key");
  vi.stubEnv("ASSISTANT_CHAT_MODEL", "");
  vi.stubEnv("ASSISTANT_UTILITY_MODEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseModelSpec", () => {
  it("parses provider:modelId", () => {
    expect(parseModelSpec("anthropic:claude-sonnet-4-6")).toEqual({
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
  });

  it("keeps colons inside the model id", () => {
    expect(parseModelSpec("openai:ft:gpt-5.1:org")).toEqual({
      provider: "openai",
      modelId: "ft:gpt-5.1:org",
    });
  });

  it.each(["", "claude-sonnet-4-6", "unknown:model", "anthropic:"])(
    "rejects %j",
    (spec) => {
      expect(() => parseModelSpec(spec)).toThrow(AIAPIError);
    }
  );
});

describe("resolveLanguageModel", () => {
  it.each([
    "anthropic:claude-sonnet-4-6",
    "openai:gpt-5.1",
    "google:gemini-3-flash",
  ])("resolves %s", (spec) => {
    const resolved = resolveLanguageModel(spec);
    expect(resolved.spec).toBe(spec);
    expect(resolved.model).toBeTruthy();
  });

  it("throws NoAIKeyConfiguredError when no key is available", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    expect(() => resolveLanguageModel("google:gemini-3-flash")).toThrow(
      NoAIKeyConfiguredError
    );
  });

  it("reports where the key came from", () => {
    expect(resolveLanguageModel("anthropic:claude-sonnet-4-6").keySource).toBe(
      "server"
    );
    expect(
      resolveLanguageModel("anthropic:claude-sonnet-4-6", "sk-user").keySource
    ).toBe("user");
  });

  it("uses an explicit key even when the server has none", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const resolved = resolveLanguageModel("google:gemini-3-flash", "sk-user");
    expect(resolved.keySource).toBe("user");
    expect(resolved.model).toBeTruthy();
  });
});
