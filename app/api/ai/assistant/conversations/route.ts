import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/db/queries/assistant";

const querySchema = z.object({
  projectId: z.string().uuid(),
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    projectId: searchParams.get("projectId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const rows = await listConversations(user.id, parsed.data.projectId);
    return NextResponse.json({
      conversations: rows.map((c) => ({
        id: c.id,
        title: c.title,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      })),
    });
  } catch {
    console.error("[ai/assistant] failed to list conversations", {
      projectId: parsed.data.projectId,
    });
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}
