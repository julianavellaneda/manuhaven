import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { MAX_MANUSCRIPT_SIZE_BYTES } from "@/lib/constants";
import { saveUploadedManuscript } from "@/lib/db/queries/manuscripts";
import { getOwnedProject } from "@/lib/db/queries/projects";
import {
  buildChapterSummary,
  countWordsInNodes,
  splitIntoChapters,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";
import { getStorage } from "@/lib/storage";
import { manuscriptKey } from "@/lib/storage/keys";
import { sniffManuscript } from "@/lib/storage/sniff";
import { readFileField, readMultipart, UploadError } from "@/lib/storage/upload";

// The browser parses the file (mammoth needs the DOM) and sends the result
// beside the original. The parsed JSON can outgrow the file it came from, so
// it gets a budget of its own.
const MAX_TIPTAP_JSON_BYTES = MAX_MANUSCRIPT_SIZE_BYTES;

const tiptapDocSchema: z.ZodType<TiptapDoc> = z.object({
  type: z.literal("doc"),
  content: z.array(z.any()),
});

/**
 * Replace the project's manuscript with an uploaded file. Multipart fields:
 * `file` (the .docx or .txt original) and `tiptapJson` (its parsed body, as
 * a JSON string). Word count and chapters are recomputed here.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId } = await params;

  try {
    if (!(await getOwnedProject(user.id, projectId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const form = await readMultipart(
      request,
      MAX_MANUSCRIPT_SIZE_BYTES + MAX_TIPTAP_JSON_BYTES,
    );
    const bytes = await readFileField(form, "file", MAX_MANUSCRIPT_SIZE_BYTES);
    const ext = sniffManuscript(bytes);
    const claimedExt = form.get("fileType");
    if (!ext || ext !== claimedExt) {
      return NextResponse.json(
        { error: "The manuscript must be a .docx or UTF-8 .txt file" },
        { status: 415 },
      );
    }

    const rawJson = form.get("tiptapJson");
    if (typeof rawJson !== "string" || rawJson.length > MAX_TIPTAP_JSON_BYTES) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    let tiptapJson: TiptapDoc;
    try {
      tiptapJson = tiptapDocSchema.parse(JSON.parse(rawJson));
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const storage = getStorage();
    const key = manuscriptKey(user.id, projectId, ext);
    await storage.put(key, bytes);

    const result = await saveUploadedManuscript(user.id, projectId, {
      fileKey: key,
      fileType: ext,
      tiptapJson,
      // Never trust client math.
      wordCount: countWordsInNodes(tiptapJson.content ?? []),
      chapters: buildChapterSummary(splitIntoChapters(tiptapJson)),
    });
    if (!result) {
      await storage.delete(key);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // A .txt replacing a .docx (or the reverse) leaves the old file behind.
    // The upload has succeeded by now, so a failed cleanup only orphans a
    // file the user can no longer reach.
    if (result.previousFileKey && result.previousFileKey !== key) {
      await storage.delete(result.previousFileKey).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Could not save the manuscript. Please try again." },
      { status: 500 },
    );
  }
}
