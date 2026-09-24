import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { getStorage } from "@/lib/storage";
import { contentTypeForKey, isValidKey } from "@/lib/storage/keys";

// Images and PDFs render in the page (cover thumbnails, the PDF preview
// iframe); everything else downloads. Keys are written only by this app with
// sniffed extensions, so the type is trustworthy either way.
function isInline(contentType: string): boolean {
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

/**
 * The one way a browser reads a stored file. A key belongs to the user in its
 * first segment and the project in its second (lib/storage/keys.ts); both
 * must be the caller's. Anything else is a 404, so keys can't be probed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notFound = () =>
    NextResponse.json({ error: "Not found" }, { status: 404 });

  const segments = (await params).key;
  const key = segments.join("/");
  const [ownerId, projectId] = segments;
  if (
    !isValidKey(key) ||
    segments.length < 3 ||
    ownerId !== user.id ||
    !z.uuid().safeParse(projectId).success
  ) {
    return notFound();
  }

  try {
    if (!(await getOwnedProject(user.id, projectId))) return notFound();

    const file = await getStorage().get(key);
    if (!file) return notFound();

    const contentType = contentTypeForKey(key);
    const filename = segments[segments.length - 1];
    return new Response(file.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(file.size),
        "Content-Disposition": `${isInline(contentType) ? "inline" : "attachment"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Please try again." },
      { status: 500 },
    );
  }
}
