// Storage key layout. Every key starts with the owner's user id, then the
// project id, so /api/files can authorize a key from its first two segments
// and account deletion is one deletePrefix(`${userId}/`).
//
//   {userId}/{projectId}/manuscript/original.{docx|txt}
//   {userId}/{projectId}/cover.{jpg|png|webp}
//   {userId}/{projectId}/exports/{exportId}.{epub|pdf}

export type ManuscriptExt = "docx" | "txt";
export type CoverExt = "jpg" | "png" | "webp";
export type ExportExt = "epub" | "pdf";

export function manuscriptKey(
  userId: string,
  projectId: string,
  ext: ManuscriptExt,
): string {
  return `${userId}/${projectId}/manuscript/original.${ext}`;
}

export function coverKey(
  userId: string,
  projectId: string,
  ext: CoverExt,
): string {
  return `${userId}/${projectId}/cover.${ext}`;
}

export function exportKey(
  userId: string,
  projectId: string,
  exportId: string,
  ext: ExportExt,
): string {
  return `${userId}/${projectId}/exports/${exportId}.${ext}`;
}

const CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  epub: "application/epub+zip",
  pdf: "application/pdf",
};

/**
 * The content type a key is served with. Keys are written only by this app,
 * with an extension chosen from the sniffed bytes, so the extension is
 * authoritative.
 */
export function contentTypeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * True for a relative key whose segments are plain names: no empty, `.` or
 * `..` segments, no backslashes, no leading slash. Both drivers refuse
 * anything else before touching the disk or the bucket.
 */
export function isValidKey(key: string): boolean {
  if (key.length === 0 || key.length > 512) return false;
  return key
    .split("/")
    .every((segment) => SEGMENT.test(segment) && !segment.includes(".."));
}
