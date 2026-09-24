import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCSVRoyaltySource,
  SUPPORTED_CSV_RETAILERS,
  type SupportedCSVRetailer,
} from "@/lib/providers/royalties/csv-royalties";
import { getSessionUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { upsertRoyalties } from "@/lib/db/queries/royalties";

const uploadSchema = z.object({
  retailer: z.enum(SUPPORTED_CSV_RETAILERS),
  projectId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const preview = url.searchParams.get("preview") === "true";

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const retailer = formData.get("retailer") as string | null;
    const projectId = formData.get("projectId") as string | null;

    // Validate inputs
    const parsed = uploadSchema.safeParse({ retailer, projectId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max for CSV reports)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Verify user owns the project
    const project = await getOwnedProject(user.id, parsed.data.projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you do not have access" },
        { status: 404 }
      );
    }

    // Parse the CSV
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const source = createCSVRoyaltySource(
      parsed.data.retailer as SupportedCSVRetailer,
      parsed.data.projectId
    );
    const records = await source.parseReport(buffer, file.name);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No valid records found in the CSV file" },
        { status: 400 }
      );
    }

    // Preview mode: return parsed records without saving
    if (preview) {
      return NextResponse.json({
        records: records.map((r) => ({
          ...r,
          periodStart: r.periodStart.toISOString(),
          periodEnd: r.periodEnd.toISOString(),
        })),
        saved: false,
        count: records.length,
      });
    }

    // Save mode: upsert records into royalties table
    const saved = await upsertRoyalties(
      user.id,
      parsed.data.projectId,
      records.map((r) => ({
        retailer: r.retailer,
        territory: r.territory,
        unitsSold: r.unitsSold,
        unitsReturned: r.unitsReturned,
        revenue: r.revenue,
        currency: r.currency,
        revenueUsd: r.revenueUsd,
        periodStart: r.periodStart.toISOString().split("T")[0],
        periodEnd: r.periodEnd.toISOString().split("T")[0],
      }))
    ).catch(() => false);

    if (!saved) {
      console.error("Royalties upsert failed", {
        projectId: parsed.data.projectId,
      });
      return NextResponse.json(
        { error: "Failed to save royalty records" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      records: records.map((r) => ({
        ...r,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
      })),
      saved: true,
      count: records.length,
    });
  } catch (err) {
    console.error("Royalty upload error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
