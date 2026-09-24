import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { userAiSettings } from "@/lib/db/schema";

// api_key_cipher is read by exactly one function, getAiSettingsWithCipher(),
// whose only caller decrypts it server-side in lib/ai/assistant/models.ts.
// Everything else here selects the public columns, so the ciphertext cannot
// reach a page or a JSON response by accident.

const publicColumns = {
  provider: userAiSettings.provider,
  chatModel: userAiSettings.chatModel,
  utilityModel: userAiSettings.utilityModel,
  keyHint: userAiSettings.apiKeyHint,
  autonomy: userAiSettings.autonomy,
};

export type AiSettingsView = {
  provider: string | null;
  chatModel: string | null;
  utilityModel: string | null;
  keyHint: string | null;
  autonomy: string;
};

/** What the settings UI shows. Never includes the key or its ciphertext. */
export async function getAiSettings(
  userId: string,
): Promise<AiSettingsView | null> {
  const [row] = await getDb()
    .select(publicColumns)
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId));
  return row ?? null;
}

/** Server-side only: for decrypting the user's key. */
export async function getAiSettingsWithCipher(userId: string) {
  const [row] = await getDb()
    .select({
      provider: userAiSettings.provider,
      chatModel: userAiSettings.chatModel,
      utilityModel: userAiSettings.utilityModel,
      apiKeyCipher: userAiSettings.apiKeyCipher,
      autonomy: userAiSettings.autonomy,
    })
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId));
  return row ?? null;
}

/**
 * Create or update the user's settings. The key fields are optional: leave
 * them out to keep the stored key, or pass null to clear it.
 */
export async function saveAiSettings(
  userId: string,
  values: {
    provider: string | null;
    chatModel: string | null;
    utilityModel: string | null;
    autonomy: string;
    apiKeyCipher?: string | null;
    apiKeyHint?: string | null;
  },
): Promise<AiSettingsView> {
  const [row] = await getDb()
    .insert(userAiSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: userAiSettings.userId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning(publicColumns);
  return row;
}
