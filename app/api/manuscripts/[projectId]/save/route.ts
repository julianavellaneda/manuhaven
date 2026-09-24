import { NextResponse } from "next/server";
import { z } from "zod";
import {
  countWordsInNodes,
  buildChapterSummary,
  splitIntoChapters,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";
import { MAX_MANUSCRIPT_SIZE_BYTES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth/session";
import { saveManuscriptContent } from "@/lib/db/queries/manuscripts";

// Top-level nodes are paragraphs and headings; a long novel has tens of
// thousands, so this only stops abuse.
const MAX_TOP_LEVEL_NODES = 200_000;
// The client prunes writing stats to a year of days.
const MAX_STATS_DAYS = 400;

const tiptapDocSchema: z.ZodType<TiptapDoc> = z.object({
  type: z.literal("doc"),
  content: z.array(z.any()).max(MAX_TOP_LEVEL_NODES),
});

const writingStatsSchema = z.object({
  sessions: z
    .record(
      z.iso.date(),
      z.object({
        words: z.number().int().nonnegative(),
        seconds: z.number().int().nonnegative(),
      })
    )
    .refine((sessions) => Object.keys(sessions).length <= MAX_STATS_DAYS),
  dailyGoal: z.number().int().positive().max(100_000),
});

const bodySchema = z.object({
  tiptapJson: tiptapDocSchema,
  writingStats: writingStatsSchema.optional(),
});

class BodyTooLargeError extends Error {}

async function readBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_MANUSCRIPT_SIZE_BYTES) throw new BodyTooLargeError();
  // Always read as text: sendBeacon can't reliably set application/json.
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_MANUSCRIPT_SIZE_BYTES) {
    throw new BodyTooLargeError();
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!z.uuid().safeParse(projectId).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await readBody(request);
    parsed = bodySchema.parse(raw);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "Manuscript too large" },
        { status: 413 }
      );
    }
    const message =
      err instanceof z.ZodError
        ? "Invalid payload"
        : err instanceof Error
          ? err.message
          : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { tiptapJson, writingStats } = parsed;

  // Server-side word count + chapter summary — never trust client math.
  const wordCount = countWordsInNodes(tiptapJson.content ?? []);
  const chapters = splitIntoChapters(tiptapJson);
  const chapterSummary = buildChapterSummary(chapters);

  let saved: boolean;
  try {
    saved = await saveManuscriptContent(user.id, projectId, {
      tiptapJson,
      wordCount,
      chapters: chapterSummary,
      writingStats,
    });
  } catch {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
  if (!saved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    wordCount,
    savedAt: new Date().toISOString(),
  });
}
