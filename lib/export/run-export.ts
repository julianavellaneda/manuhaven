import "server-only";

import { NextResponse } from "next/server";
import {
  claimExport,
  countRecentExports,
  deleteExport,
  finishExport,
} from "@/lib/db/queries/exports";
import { getManuscript } from "@/lib/db/queries/manuscripts";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { getTemplate } from "@/lib/db/queries/templates";
import { getStorage } from "@/lib/storage";
import { contentTypeForKey, exportKey } from "@/lib/storage/keys";
import { fileUrl } from "@/lib/storage/url";
import { tiptapToHtml, type TiptapNode } from "@/lib/tiptap-to-html";
import {
  convert,
  ConverterError,
  type ConvertRequest,
  type PrintSettings,
} from "./converter";

// Renders are CPU-heavy (WeasyPrint can take two minutes on a long book), so
// each user gets a bounded number per window. Refused attempts don't count.
export const EXPORT_THROTTLE_WINDOW_MS = 60 * 60 * 1000;
export const EXPORT_THROTTLE_MAX = 20;

export type ExportJob =
  | { format: "epub"; projectId: string; templateId: string }
  | {
      format: "pdf";
      projectId: string;
      templateId: string;
      printSettings: PrintSettings;
    };

export type ExportResult =
  | { ok: true; exportId: string; fileKey: string; fileSizeBytes: number }
  | { ok: false; status: 404 | 429 | 500 | 502; error: string };

const fail = (
  status: 404 | 429 | 500 | 502,
  error: string,
): ExportResult => ({ ok: false, status, error });

async function readCover(key: string): Promise<ConvertRequest["cover"]> {
  const file = await getStorage().get(key);
  if (!file) return undefined;
  const bytes = Buffer.from(await new Response(file.body).arrayBuffer());
  return { base64: bytes.toString("base64"), contentType: contentTypeForKey(key) };
}

/**
 * Render the user's manuscript to EPUB or PDF and store the file. Every step
 * is scoped to the user; the export row is claimed before the converter runs
 * so the throttle sees concurrent requests.
 */
export async function runExport(
  userId: string,
  job: ExportJob,
): Promise<ExportResult> {
  const { format, projectId, templateId } = job;

  const project = await getOwnedProject(userId, projectId);
  if (!project) return fail(404, "Project not found");

  const template = await getTemplate(templateId);
  if (!template) return fail(404, "Template not found");

  const manuscript = await getManuscript(userId, projectId);
  if (!manuscript?.tiptapJson) return fail(404, "No manuscript content found");

  const exportId = await claimExport(userId, { projectId, format, templateId });
  if (!exportId) return fail(404, "Project not found");

  const recent = await countRecentExports(
    userId,
    new Date(Date.now() - EXPORT_THROTTLE_WINDOW_MS),
  );
  // This request's own claim is included, so the cap is `>`, not `>=`.
  if (recent > EXPORT_THROTTLE_MAX) {
    await deleteExport(userId, exportId);
    return fail(429, "Too many exports; try again later");
  }

  const failed = (status: 500 | 502, error: string, reason: string) =>
    finishExport(userId, exportId, { status: "failed", errorMessage: reason })
      .catch(() => {})
      .then(() => fail(status, error));

  const request: ConvertRequest = {
    html: tiptapToHtml(manuscript.tiptapJson as TiptapNode),
    metadata: {
      title: project.title,
      subtitle: project.subtitle ?? undefined,
      authorName: project.authorName,
      description: project.description ?? undefined,
      isbn: project.isbn ?? undefined,
      genre: project.genre,
      language: project.language,
    },
    // The converter names its stylesheets after the lowercased genre.
    templateId: template.genre.toLowerCase(),
  };
  if (job.format === "pdf") request.printSettings = job.printSettings;
  // The cover is for the EPUB package; a print interior has none.
  if (format === "epub" && project.coverKey) {
    request.cover = await readCover(project.coverKey);
  }

  let bytes: Uint8Array;
  try {
    bytes = await convert(format, request);
  } catch (err) {
    const reason =
      err instanceof ConverterError ? err.message : "Converter request failed";
    return failed(502, "Conversion failed. Please try again.", reason);
  }

  const storage = getStorage();
  const key = exportKey(userId, projectId, exportId, format);
  try {
    await storage.put(key, bytes);
  } catch {
    return failed(500, "Could not save the export. Please try again.", "Storage write failed");
  }

  const saved = await finishExport(userId, exportId, {
    status: "complete",
    fileKey: key,
    fileSizeBytes: bytes.byteLength,
  });
  if (!saved) {
    await storage.delete(key).catch(() => {});
    return fail(404, "Project not found");
  }

  return { ok: true, exportId, fileKey: key, fileSizeBytes: bytes.byteLength };
}

/** The route response for a finished runExport(). */
export function exportResponse(result: ExportResult): NextResponse {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    fileUrl: fileUrl(result.fileKey),
    fileSizeBytes: result.fileSizeBytes,
    exportId: result.exportId,
  });
}
