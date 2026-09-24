import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ASSISTANT_PROVIDERS,
  parseModelSpec,
} from "@/lib/ai/assistant/models";
import {
  MissingEncryptionSecretError,
  encryptApiKey,
  keyHint,
} from "@/lib/ai/key-crypto";
import { getSessionUser } from "@/lib/auth/session";
import { saveAiSettings } from "@/lib/db/queries/ai-settings";

const modelSpec = z
  .string()
  .trim()
  .max(200)
  .refine(
    (v) => {
      if (v.length === 0) return true;
      try {
        parseModelSpec(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Expected "provider:modelId"' }
  );

const BodySchema = z.object({
  provider: z.enum(ASSISTANT_PROVIDERS as [string, ...string[]]).nullable(),
  chatModel: modelSpec.nullable().optional(),
  utilityModel: modelSpec.nullable().optional(),
  autonomy: z.enum(["off", "lite", "editorial", "collaborator"]),
  // Absent = leave the stored key alone. Empty string = clear it.
  apiKey: z.string().max(500).optional(),
});

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { provider, chatModel, utilityModel, autonomy, apiKey } = parsed.data;

  const update: Parameters<typeof saveAiSettings>[1] = {
    provider,
    chatModel: chatModel || null,
    utilityModel: utilityModel || null,
    autonomy,
  };

  if (apiKey !== undefined) {
    const trimmed = apiKey.trim();
    if (trimmed.length === 0) {
      update.apiKeyCipher = null;
      update.apiKeyHint = null;
    } else {
      try {
        update.apiKeyCipher = encryptApiKey(trimmed);
      } catch (err) {
        if (err instanceof MissingEncryptionSecretError) {
          return NextResponse.json(
            { error: err.message, code: "no_encryption_secret" },
            { status: 503 }
          );
        }
        throw err;
      }
      update.apiKeyHint = keyHint(trimmed);
    }
  }

  try {
    // Returns the public columns only: the ciphertext never leaves the server.
    const settings = await saveAiSettings(user.id, update);
    return NextResponse.json({ settings });
  } catch {
    // A driver error can echo the submitted row, so log nothing from it.
    console.error("[settings/ai] save failed");
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }
}
