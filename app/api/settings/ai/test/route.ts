import { NextResponse } from "next/server";
import { NoAIKeyConfiguredError } from "@/lib/ai/errors";
import { generateForUser } from "@/lib/ai/generate";
import { AI_THROTTLED_BODY, enforceAiThrottle } from "@/lib/ai/throttle";
import { getSessionUser } from "@/lib/auth/session";

/**
 * "Test connection" for Settings → AI: resolves the user's configured model
 * and spends a handful of tokens proving the key works. Deliberately sends no
 * manuscript content.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each test spends real tokens, so it counts against the AI throttle too.
  if (!(await enforceAiThrottle(user.id, null, "settings_test"))) {
    return NextResponse.json(AI_THROTTLED_BODY, { status: 429 });
  }

  let model: string;
  try {
    ({ model } = await generateForUser({
      userId: user.id,
      system: "You are a connection check.",
      user: "Reply with the single word: ok",
      // OpenAI rejects anything under 16, so this is the smallest budget
      // that works across all three providers.
      maxTokens: 16,
      maxRetries: 0,
    }));
  } catch (err) {
    if (err instanceof NoAIKeyConfiguredError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      );
    }
    // Provider errors are shown to the user (wrong key, no credit, bad model),
    // so surface the message but never anything derived from the key itself.
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Connection failed",
        code: "provider_error",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, model });
}
