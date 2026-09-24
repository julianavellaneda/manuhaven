import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { manuscripts } from "@/lib/db/schema";
import { getOwnedProject, ownedProjectIds } from "./projects";

export type Manuscript = typeof manuscripts.$inferSelect;

/** The project's manuscript, or null when there is none or it is not the user's. */
export async function getManuscript(
  userId: string,
  projectId: string,
): Promise<Manuscript | null> {
  const [row] = await getDb()
    .select()
    .from(manuscripts)
    .where(
      and(
        eq(manuscripts.projectId, projectId),
        inArray(manuscripts.projectId, ownedProjectIds(userId)),
      ),
    );
  return row ?? null;
}

/**
 * Create or replace the manuscript body. writingStats is left alone when
 * omitted. Returns false when the user does not own the project.
 */
export async function saveManuscriptContent(
  userId: string,
  projectId: string,
  content: {
    tiptapJson: unknown;
    wordCount: number;
    chapters: unknown;
    writingStats?: unknown;
  },
): Promise<boolean> {
  if (!(await getOwnedProject(userId, projectId))) return false;
  const { tiptapJson, wordCount, chapters, writingStats } = content;
  const set = {
    tiptapJson,
    wordCount,
    chapters,
    ...(writingStats !== undefined && { writingStats }),
  };
  await getDb()
    .insert(manuscripts)
    .values({ projectId, ...set })
    .onConflictDoUpdate({ target: manuscripts.projectId, set });
  return true;
}

/**
 * Replace the manuscript with a freshly uploaded file: its storage key, type
 * and parsed body. Returns the previous file key, so the caller can delete it
 * when it differs, or false when the user does not own the project.
 */
export async function saveUploadedManuscript(
  userId: string,
  projectId: string,
  upload: {
    fileKey: string;
    fileType: "docx" | "txt";
    tiptapJson: unknown;
    wordCount: number;
    chapters: unknown;
  },
): Promise<{ previousFileKey: string | null } | false> {
  if (!(await getOwnedProject(userId, projectId))) return false;
  return getDb().transaction(async (tx) => {
    const [previous] = await tx
      .select({ fileKey: manuscripts.fileKey })
      .from(manuscripts)
      .where(eq(manuscripts.projectId, projectId))
      .for("update");
    const set = { ...upload, uploadedAt: new Date() };
    await tx
      .insert(manuscripts)
      .values({ projectId, ...set })
      .onConflictDoUpdate({ target: manuscripts.projectId, set });
    return { previousFileKey: previous?.fileKey ?? null };
  });
}

/** Columns the AI routes write back: generated analysis and cooldown stamps. */
export type ManuscriptAiUpdate = Partial<
  Pick<
    Manuscript,
    | "storyBible"
    | "editorialReport"
    | "styleAnalysis"
    | "lastAiContinuityAt"
    | "lastAiEditorialAt"
  >
>;

/** Returns false when there is no manuscript the user owns to update. */
export async function updateManuscriptAi(
  userId: string,
  projectId: string,
  update: ManuscriptAiUpdate,
): Promise<boolean> {
  const rows = await getDb()
    .update(manuscripts)
    .set(update)
    .where(
      and(
        eq(manuscripts.projectId, projectId),
        inArray(manuscripts.projectId, ownedProjectIds(userId)),
      ),
    )
    .returning({ id: manuscripts.id });
  return rows.length > 0;
}

/** The per-manuscript AI cooldown stamps. */
export type AiCooldown =
  | "lastAiMetadataAt"
  | "lastAiEditorialAt"
  | "lastAiContinuityAt";

export type AiCooldownClaim =
  | { ok: true; stampedAt: Date; previous: Date | null }
  | { ok: false; retryAt: Date };

/**
 * Stamp a cooldown now if its window has elapsed, under a row lock, so
 * parallel requests can't all pass the check before any of them stamps.
 * Returns null when there is no manuscript the user owns.
 */
export async function claimAiCooldown(
  userId: string,
  projectId: string,
  cooldown: AiCooldown,
  windowMs: number,
): Promise<AiCooldownClaim | null> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: manuscripts.id, last: manuscripts[cooldown] })
      .from(manuscripts)
      .where(
        and(
          eq(manuscripts.projectId, projectId),
          inArray(manuscripts.projectId, ownedProjectIds(userId)),
        ),
      )
      .for("update");
    if (!row) return null;

    const now = new Date();
    if (row.last && now.getTime() - row.last.getTime() < windowMs) {
      return { ok: false, retryAt: new Date(row.last.getTime() + windowMs) };
    }
    await tx
      .update(manuscripts)
      .set({ [cooldown]: now })
      .where(eq(manuscripts.id, row.id));
    return { ok: true, stampedAt: now, previous: row.last };
  });
}

/**
 * Undo a claim after the generation failed, so a provider error doesn't cost
 * the user a whole window. A no-op if anything re-stamped since.
 */
export async function releaseAiCooldown(
  userId: string,
  projectId: string,
  cooldown: AiCooldown,
  claim: { stampedAt: Date; previous: Date | null },
): Promise<void> {
  await getDb()
    .update(manuscripts)
    .set({ [cooldown]: claim.previous })
    .where(
      and(
        eq(manuscripts.projectId, projectId),
        inArray(manuscripts.projectId, ownedProjectIds(userId)),
        eq(manuscripts[cooldown], claim.stampedAt),
      ),
    );
}
