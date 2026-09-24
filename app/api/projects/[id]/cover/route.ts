import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { MAX_COVER_SIZE_BYTES } from "@/lib/constants";
import { getOwnedProject, setProjectCover } from "@/lib/db/queries/projects";
import { getStorage } from "@/lib/storage";
import { coverKey } from "@/lib/storage/keys";
import { sniffCover } from "@/lib/storage/sniff";
import { readFileField, readMultipart, UploadError } from "@/lib/storage/upload";
import { fileUrl } from "@/lib/storage/url";

/** Replace the project's cover. Multipart body with one field, `file`. */
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

    const form = await readMultipart(request, MAX_COVER_SIZE_BYTES);
    const bytes = await readFileField(form, "file", MAX_COVER_SIZE_BYTES);
    const ext = sniffCover(bytes);
    if (!ext) {
      return NextResponse.json(
        { error: "The cover must be a JPEG, PNG or WebP image" },
        { status: 415 },
      );
    }

    const storage = getStorage();
    const key = coverKey(user.id, projectId, ext);
    await storage.put(key, bytes);

    const result = await setProjectCover(user.id, projectId, key);
    if (!result) {
      await storage.delete(key);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // A cover of a different type leaves the old file behind; remove it.
    // The upload has succeeded by now, so a failed cleanup only orphans a
    // file the user can no longer reach.
    if (result.previousCoverKey && result.previousCoverKey !== key) {
      await storage.delete(result.previousCoverKey).catch(() => {});
    }

    return NextResponse.json({ coverUrl: fileUrl(key) });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Could not save the cover. Please try again." },
      { status: 500 },
    );
  }
}
