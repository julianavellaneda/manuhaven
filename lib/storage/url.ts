/**
 * The URL a stored file is served from. The database holds storage keys,
 * never URLs; every file is read through the authz-checked /api/files route.
 */
export function fileUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}
