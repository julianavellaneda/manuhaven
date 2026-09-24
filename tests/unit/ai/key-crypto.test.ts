import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  MissingEncryptionSecretError,
  decryptApiKey,
  encryptApiKey,
  encryptionAvailable,
  keyHint,
} from "@/lib/ai/key-crypto";

const SECRET = "test-secret-do-not-use-in-production";

beforeEach(() => {
  vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryptApiKey / decryptApiKey", () => {
  it("round-trips a key", () => {
    const key = "sk-ant-api03-abcdef1234567890";
    expect(decryptApiKey(encryptApiKey(key))).toBe(key);
  });

  it("never emits the plaintext inside the ciphertext", () => {
    const key = "sk-ant-api03-abcdef1234567890";
    expect(encryptApiKey(key)).not.toContain(key);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const key = "sk-ant-api03-abcdef1234567890";
    expect(encryptApiKey(key)).not.toBe(encryptApiKey(key));
  });

  it("rejects tampered ciphertext via the GCM auth tag", () => {
    const encoded = encryptApiKey("sk-ant-api03-abcdef1234567890");
    const raw = Buffer.from(encoded, "base64");
    raw[raw.length - 1] ^= 0xff; // flip a bit in the ciphertext
    expect(() => decryptApiKey(raw.toString("base64"))).toThrow();
  });

  it("rejects a key encrypted under a different secret", () => {
    const encoded = encryptApiKey("sk-ant-api03-abcdef1234567890");
    vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", "a-completely-different-secret");
    expect(() => decryptApiKey(encoded)).toThrow();
  });

  it("rejects a truncated payload", () => {
    expect(() => decryptApiKey(Buffer.from("short").toString("base64"))).toThrow(
      /Malformed/
    );
  });

  it("throws a named error when the secret is unset", () => {
    vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", "");
    expect(() => encryptApiKey("sk-ant-123")).toThrow(
      MissingEncryptionSecretError
    );
    expect(encryptionAvailable()).toBe(false);
  });
});

describe("keyHint", () => {
  it("keeps the provider prefix and the last four characters", () => {
    const hint = keyHint("sk-ant-api03-abcdef12345678wxyz");
    expect(hint).toBe("sk-ant-…wxyz");
  });

  it("never returns the whole key", () => {
    const key = "sk-ant-api03-abcdef12345678wxyz";
    expect(keyHint(key)).not.toContain("abcdef");
    expect(keyHint(key).length).toBeLessThan(key.length);
  });

  it("degrades safely for a short value", () => {
    expect(keyHint("abcdefgh")).toBe("…efgh");
  });
});
