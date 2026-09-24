import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { exportResponse, runExport } from "@/lib/export/run-export";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
  printSettings: z.object({
    trimSize: z.enum(["5x8", "5.5x8.5", "6x9"]),
    margins: z.enum(["narrow", "normal", "wide"]),
    fontSize: z.enum(["small", "medium", "large"]),
  }),
});

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    return exportResponse(
      await runExport(user.id, { format: "pdf", ...parsed.data })
    );
  } catch {
    return NextResponse.json(
      { error: "Export failed. Please try again." },
      { status: 500 }
    );
  }
}
