import "server-only";

import {
  claimUsageEvent,
  countRecentUsage,
} from "@/lib/db/queries/ai-usage";

export const AI_THROTTLE_WINDOW_MS = 60_000;
export const AI_THROTTLE_MAX_CALLS = 10;

/** The 429 body every AI route returns when the burst throttle trips. */
export const AI_THROTTLED_BODY = {
  error: "Too many AI requests; try again in a moment",
  code: "rate_limited",
  retryAfterSeconds: 30,
} as const;

/**
 * Burst throttle shared by every AI route: at most AI_THROTTLE_MAX_CALLS model
 * calls per user per minute, whoever's key pays. It protects the server, so it
 * applies with a user key too.
 *
 * The usage row is claimed BEFORE the model runs and counted after, so
 * concurrent bursts all see each other. Returns the claimed event id, or null
 * when the caller is over the cap.
 */
export async function enforceAiThrottle(
  userId: string,
  projectId: string | null,
  kind: string,
): Promise<string | null> {
  const usageEventId = await claimUsageEvent(userId, projectId, kind);
  if (process.env.AI_RATELIMIT_DISABLED === "true") return usageEventId;

  const count = await countRecentUsage(
    userId,
    new Date(Date.now() - AI_THROTTLE_WINDOW_MS),
  );
  // This request's own claim is included, so the cap is `>`, not `>=`.
  return count > AI_THROTTLE_MAX_CALLS ? null : usageEventId;
}
