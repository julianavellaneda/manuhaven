import "server-only";

import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiUsageEvents } from "@/lib/db/schema";

// Token counts and timings only. Nothing here may ever take manuscript text.

/**
 * Claim a usage row before the model runs, with zero tokens, so concurrent
 * bursts all see each other in countRecentUsage(). Callers must have checked
 * that the user owns projectId; it is null for calls outside any project.
 */
export async function claimUsageEvent(
  userId: string,
  projectId: string | null,
  kind: string,
): Promise<string> {
  const [row] = await getDb()
    .insert(aiUsageEvents)
    .values({ userId, projectId, kind })
    .returning({ id: aiUsageEvents.id });
  return row.id;
}

export async function countRecentUsage(
  userId: string,
  since: Date,
): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(aiUsageEvents)
    .where(
      and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)),
    );
  return row.n;
}

/** Fill in a claimed row once the model has answered. */
export async function completeUsageEvent(
  userId: string,
  eventId: string,
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  },
): Promise<void> {
  await getDb()
    .update(aiUsageEvents)
    .set(usage)
    .where(and(eq(aiUsageEvents.id, eventId), eq(aiUsageEvents.userId, userId)));
}
