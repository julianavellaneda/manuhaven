import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { manuscripts, projects } from "@/lib/db/schema";

export type Project = typeof projects.$inferSelect;

/**
 * The ids of every project the user owns, as a subquery. Tables that hang off
 * a project (manuscripts, exports) are scoped with
 * `inArray(table.projectId, ownedProjectIds(userId))`.
 */
export function ownedProjectIds(userId: string) {
  return getDb()
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));
}

/** A project, or null when it does not exist or belongs to someone else. */
export async function getOwnedProject(
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const [row] = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return row ?? null;
}

/** Non-archived projects for the dashboard board, most recently updated first. */
export async function listDashboardProjects(userId: string) {
  return getDb()
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      genre: projects.genre,
      coverKey: projects.coverKey,
      updatedAt: projects.updatedAt,
      wordCount: manuscripts.wordCount,
    })
    .from(projects)
    .leftJoin(manuscripts, eq(manuscripts.projectId, projects.id))
    .where(
      and(
        eq(projects.userId, userId),
        sql`${projects.status} is distinct from 'archived'`,
      ),
    )
    .orderBy(desc(projects.updatedAt));
}

/** Every project, for pickers. Ordered by title. */
export async function listProjectOptions(userId: string) {
  return getDb()
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.title));
}

export async function createProject(
  userId: string,
  values: { title: string; genre: string | null },
): Promise<{ id: string }> {
  const [row] = await getDb()
    .insert(projects)
    .values({ userId, title: values.title, genre: values.genre })
    .returning({ id: projects.id });
  return row;
}

/**
 * Store AI-generated metadata on the project and stamp the manuscript's
 * metadata cooldown, in one transaction so neither lands without the other.
 * Returns false when the user does not own the project.
 */
export async function saveProjectAiMetadata(
  userId: string,
  projectId: string,
  aiMetadata: unknown,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const updated = await tx
      .update(projects)
      .set({ aiMetadata })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning({ id: projects.id });
    if (updated.length === 0) return false;
    await tx
      .update(manuscripts)
      .set({ lastAiMetadataAt: new Date() })
      .where(eq(manuscripts.projectId, projectId));
    return true;
  });
}

/**
 * Point the project at a new cover. Returns the previous cover key, so the
 * caller can delete it when it differs, or false when the user does not own
 * the project.
 */
export async function setProjectCover(
  userId: string,
  projectId: string,
  coverKey: string,
): Promise<{ previousCoverKey: string | null } | false> {
  return getDb().transaction(async (tx) => {
    const [previous] = await tx
      .select({ coverKey: projects.coverKey })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .for("update");
    if (!previous) return false;
    await tx
      .update(projects)
      .set({ coverKey })
      .where(eq(projects.id, projectId));
    return { previousCoverKey: previous.coverKey };
  });
}
