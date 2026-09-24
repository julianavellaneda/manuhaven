import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { assistantConversations, assistantMessages } from "@/lib/db/schema";

// Conversations carry user_id directly; messages are scoped through their
// conversation. Archived conversations are invisible to every read here.

function activeConversation(userId: string, conversationId: string) {
  return and(
    eq(assistantConversations.id, conversationId),
    eq(assistantConversations.userId, userId),
    isNull(assistantConversations.archivedAt),
  );
}

function ownedConversationIds(userId: string) {
  return getDb()
    .select({ id: assistantConversations.id })
    .from(assistantConversations)
    .where(
      and(
        eq(assistantConversations.userId, userId),
        isNull(assistantConversations.archivedAt),
      ),
    );
}

/**
 * An active conversation the user owns, or null. Pass projectId to also
 * require that it belongs to that project.
 */
export async function getConversation(
  userId: string,
  conversationId: string,
  projectId?: string,
) {
  const [row] = await getDb()
    .select({
      id: assistantConversations.id,
      title: assistantConversations.title,
      projectId: assistantConversations.projectId,
      createdAt: assistantConversations.createdAt,
      updatedAt: assistantConversations.updatedAt,
    })
    .from(assistantConversations)
    .where(
      and(
        activeConversation(userId, conversationId),
        projectId ? eq(assistantConversations.projectId, projectId) : undefined,
      ),
    );
  return row ?? null;
}

/** The 20 most recently active conversations on a project. */
export async function listConversations(userId: string, projectId: string) {
  return getDb()
    .select({
      id: assistantConversations.id,
      title: assistantConversations.title,
      createdAt: assistantConversations.createdAt,
      updatedAt: assistantConversations.updatedAt,
    })
    .from(assistantConversations)
    .where(
      and(
        eq(assistantConversations.projectId, projectId),
        eq(assistantConversations.userId, userId),
        isNull(assistantConversations.archivedAt),
      ),
    )
    .orderBy(desc(assistantConversations.updatedAt))
    .limit(20);
}

/** Callers must have checked that the user owns projectId. */
export async function createConversation(
  userId: string,
  projectId: string,
): Promise<string> {
  const [row] = await getDb()
    .insert(assistantConversations)
    .values({ userId, projectId })
    .returning({ id: assistantConversations.id });
  return row.id;
}

/** Bump updated_at so the conversation sorts first. */
export async function touchConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  await getDb()
    .update(assistantConversations)
    .set({ updatedAt: new Date() })
    .where(activeConversation(userId, conversationId));
}

/** Name the conversation, unless a concurrent turn already has. */
export async function setConversationTitleIfUnset(
  userId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  await getDb()
    .update(assistantConversations)
    .set({ title })
    .where(
      and(
        activeConversation(userId, conversationId),
        isNull(assistantConversations.title),
      ),
    );
}

/** Soft-delete. Returns false when there was no active conversation to archive. */
export async function archiveConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const rows = await getDb()
    .update(assistantConversations)
    .set({ archivedAt: new Date() })
    .where(activeConversation(userId, conversationId))
    .returning({ id: assistantConversations.id });
  return rows.length > 0;
}

/** Messages oldest first, capped at `limit` of the most recent. */
export async function listMessages(
  userId: string,
  conversationId: string,
  limit: number,
) {
  const rows = await getDb()
    .select({
      id: assistantMessages.id,
      role: assistantMessages.role,
      content: assistantMessages.content,
      toolCalls: assistantMessages.toolCalls,
      createdAt: assistantMessages.createdAt,
    })
    .from(assistantMessages)
    .where(
      and(
        eq(assistantMessages.conversationId, conversationId),
        inArray(assistantMessages.conversationId, ownedConversationIds(userId)),
      ),
    )
    .orderBy(desc(assistantMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

/**
 * Append a message. Returns false when the conversation is not an active one
 * the user owns.
 */
export async function insertMessage(
  userId: string,
  conversationId: string,
  message: {
    role: "user" | "assistant";
    content: { text: string };
    toolCalls?: unknown;
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
  },
): Promise<boolean> {
  if (!(await getConversation(userId, conversationId))) return false;
  await getDb()
    .insert(assistantMessages)
    .values({ conversationId, ...message });
  return true;
}
