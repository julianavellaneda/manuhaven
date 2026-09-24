import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { royalties } from "@/lib/db/schema";
import { getOwnedProject } from "./projects";

/** Every royalty row the user has imported, newest period first. */
export async function listRoyalties(userId: string) {
  return getDb()
    .select({
      retailer: royalties.retailer,
      territory: royalties.territory,
      unitsSold: royalties.unitsSold,
      revenueUsd: royalties.revenueUsd,
      periodStart: royalties.periodStart,
    })
    .from(royalties)
    .where(eq(royalties.userId, userId))
    .orderBy(desc(royalties.periodStart));
}

export async function listProjectRoyalties(userId: string, projectId: string) {
  return getDb()
    .select({
      retailer: royalties.retailer,
      unitsSold: royalties.unitsSold,
      revenueUsd: royalties.revenueUsd,
      periodStart: royalties.periodStart,
    })
    .from(royalties)
    .where(
      and(eq(royalties.userId, userId), eq(royalties.projectId, projectId)),
    );
}

export interface RoyaltyImportRow {
  retailer: string;
  territory: string | null;
  unitsSold: number;
  unitsReturned: number;
  revenue: number;
  currency: string;
  revenueUsd: number | null;
  /** ISO date, YYYY-MM-DD. */
  periodStart: string;
  periodEnd: string;
}

/**
 * Insert or update imported CSV rows for one project. A re-import of the same
 * retailer, territory and period updates the row instead of duplicating it.
 * Returns false when the user does not own the project.
 */
export async function upsertRoyalties(
  userId: string,
  projectId: string,
  rows: RoyaltyImportRow[],
): Promise<boolean> {
  if (!(await getOwnedProject(userId, projectId))) return false;
  if (rows.length === 0) return true;
  await getDb()
    .insert(royalties)
    .values(
      rows.map((r) => ({
        ...r,
        userId,
        projectId,
        sourceType: "csv_upload",
      })),
    )
    .onConflictDoUpdate({
      target: [
        royalties.userId,
        royalties.projectId,
        royalties.retailer,
        royalties.territory,
        royalties.periodStart,
        royalties.periodEnd,
      ],
      set: {
        unitsSold: sql`excluded.units_sold`,
        unitsReturned: sql`excluded.units_returned`,
        revenue: sql`excluded.revenue`,
        currency: sql`excluded.currency`,
        revenueUsd: sql`excluded.revenue_usd`,
        importedAt: sql`now()`,
      },
    });
  return true;
}
