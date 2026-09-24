import "server-only";

import { and, count, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookExports } from "@/lib/db/schema";
import { getOwnedProject, ownedProjectIds } from "./projects";

/**
 * Claim an export row, status "processing", before the converter runs, so
 * concurrent requests all see each other in countRecentExports(). Returns the
 * export id, or null when the user does not own the project.
 */
export async function claimExport(
  userId: string,
  values: { projectId: string; format: "epub" | "pdf"; templateId: string },
): Promise<string | null> {
  if (!(await getOwnedProject(userId, values.projectId))) return null;
  const [row] = await getDb()
    .insert(bookExports)
    .values({ ...values, status: "processing" })
    .returning({ id: bookExports.id });
  return row.id;
}

/** Exports claimed across all of the user's projects since `since`. */
export async function countRecentExports(
  userId: string,
  since: Date,
): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(bookExports)
    .where(
      and(
        inArray(bookExports.projectId, ownedProjectIds(userId)),
        gte(bookExports.createdAt, since),
      ),
    );
  return row.n;
}

/**
 * Settle a claimed export. False when there is no such export on a project
 * the user owns (for instance, the project was deleted mid-render).
 */
export async function finishExport(
  userId: string,
  exportId: string,
  values:
    | { status: "complete"; fileKey: string; fileSizeBytes: number }
    | { status: "failed"; errorMessage: string },
): Promise<boolean> {
  const rows = await getDb()
    .update(bookExports)
    .set(values)
    .where(
      and(
        eq(bookExports.id, exportId),
        inArray(bookExports.projectId, ownedProjectIds(userId)),
      ),
    )
    .returning({ id: bookExports.id });
  return rows.length > 0;
}

/** Drop a claim that was refused, so it does not count against the user. */
export async function deleteExport(
  userId: string,
  exportId: string,
): Promise<void> {
  await getDb()
    .delete(bookExports)
    .where(
      and(
        eq(bookExports.id, exportId),
        inArray(bookExports.projectId, ownedProjectIds(userId)),
      ),
    );
}
