import { resolveModelForUser } from "@/lib/ai/assistant/models";

/**
 * Resolve the user's model before doing any work, so a missing key is a plain
 * 409 instead of an error raised halfway through a request (or, worse, inside
 * an already-open SSE stream).
 *
 * Also reports whether the per-manuscript cooldowns should apply. Those
 * windows -- 24h for metadata and continuity, 7 days for the editorial report
 * -- existed to cap inference spend when the server paid for it. When the user
 * brought their own key they are paying their provider directly, and making
 * them wait a week to re-run a report on their own book is hostile. The
 * short burst throttle still applies to everyone: it protects the server.
 */
export async function preflightAI(userId: string): Promise<{
  keySource: "user" | "server";
  cooldownApplies: boolean;
}> {
  const { keySource } = await resolveModelForUser(userId, "chat");
  return {
    keySource,
    cooldownApplies:
      keySource === "server" && process.env.AI_RATELIMIT_DISABLED !== "true",
  };
}
