import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Symmetric encryption for user-supplied AI API keys.
 *
 * Keys are encrypted in the application rather than with pgcrypto so the
 * secret never travels through SQL text (where it would land in
 * pg_stat_statements and query logs), no database extension is required, and
 * the same code works against any Postgres. The ciphertext is read by one
 * query function, getAiSettingsWithCipher() in lib/db/queries/ai-settings.ts,
 * and never leaves the server.
 *
 * Format: base64( iv[12] || authTag[16] || ciphertext ), AES-256-GCM.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
const TAG_BYTES = 16;
const KEY_BYTES = 32;
// Fixed salt: the secret is already high-entropy and per-deployment, and a
// random per-record salt would have to be stored alongside the ciphertext for
// no gain against the threat this defends (a leaked database dump).
const SALT = "manuhaven.ai-key.v1";

export class MissingEncryptionSecretError extends Error {
  constructor() {
    super(
      "AI_KEY_ENCRYPTION_SECRET is not set. Generate one with " +
        "`openssl rand -base64 32` and add it to your environment before " +
        "saving an API key."
    );
    this.name = "MissingEncryptionSecretError";
  }
}

function derivedKey(): Buffer {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length === 0) throw new MissingEncryptionSecretError();
  return scryptSync(secret, SALT, KEY_BYTES);
}

/** True when the deployment can store user API keys at all. */
export function encryptionAvailable(): boolean {
  return Boolean(process.env.AI_KEY_ENCRYPTION_SECRET);
}

export function encryptApiKey(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, derivedKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptApiKey(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("Malformed encrypted API key");
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, derivedKey(), iv);
  decipher.setAuthTag(tag);
  // GCM's final() throws on a tag mismatch, so tampering surfaces here.
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * A redacted form safe to store unencrypted and show in the UI: the provider
 * prefix, an ellipsis, and the last four characters. Short keys degrade to
 * the last four alone rather than leaking a larger fraction of themselves.
 */
export function keyHint(plain: string): string {
  const trimmed = plain.trim();
  const tail = trimmed.slice(-4);
  if (trimmed.length < 12) return `…${tail}`;
  const dash = trimmed.indexOf("-", trimmed.indexOf("-") + 1);
  const prefix =
    dash > 0 && dash <= 8 ? trimmed.slice(0, dash + 1) : trimmed.slice(0, 3);
  return `${prefix}…${tail}`;
}
