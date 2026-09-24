import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import {
  archiveConversation,
  getConversation,
  listMessages,
} from "@/lib/db/queries/assistant";

const paramsSchema = z.object({
  conversationId: z.string().uuid(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { conversationId } = parsed.data;

  const conversation = await getConversation(user.id, conversationId);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  let rows: Awaited<ReturnType<typeof listMessages>>;
  try {
    rows = await listMessages(user.id, conversationId, 200);
  } catch {
    console.error("[ai/assistant] failed to load messages", { conversationId });
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }

  const messages = rows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      text:
        row.content &&
        typeof row.content === "object" &&
        typeof (row.content as { text?: unknown }).text === "string"
          ? (row.content as { text: string }).text
          : "",
      toolCalls: row.toolCalls ?? null,
      createdAt: row.createdAt,
    }));

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      project_id: conversation.projectId,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    },
    messages,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { conversationId } = parsed.data;

  let archived: boolean;
  try {
    archived = await archiveConversation(user.id, conversationId);
  } catch {
    console.error("[ai/assistant] failed to archive conversation", {
      conversationId,
    });
    return NextResponse.json(
      { error: "Failed to archive conversation" },
      { status: 500 }
    );
  }
  if (!archived) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
