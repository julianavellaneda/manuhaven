"use server";

import { z } from "zod";
import { GENRES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth/session";
import { createProject } from "@/lib/db/queries/projects";
import { saveManuscriptContent } from "@/lib/db/queries/manuscripts";

// Server Functions are reachable by a direct POST, so each one checks the
// session and ownership itself, like an API route.

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: "unauthorized" | "invalid" | "failed" };

const newProjectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  genre: z.enum(GENRES).nullable(),
});

export async function createProjectAction(input: {
  title: string;
  genre: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = newProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const { id } = await createProject(user.id, parsed.data);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "failed" };
  }
}

const BLANK_MANUSCRIPT = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Chapter 1" }],
    },
    { type: "paragraph" },
  ],
};

/** Give a project with no manuscript an empty one to write in. */
export async function startBlankManuscriptAction(
  projectId: string,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!z.string().uuid().safeParse(projectId).success) {
    return { ok: false, error: "invalid" };
  }

  try {
    const saved = await saveManuscriptContent(user.id, projectId, {
      tiptapJson: BLANK_MANUSCRIPT,
      wordCount: 0,
      chapters: [{ title: "Chapter 1", wordCount: 0 }],
    });
    return saved ? { ok: true } : { ok: false, error: "invalid" };
  } catch {
    return { ok: false, error: "failed" };
  }
}
