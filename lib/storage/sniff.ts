// Upload type checks by content, not by file name or the browser-supplied
// MIME type. Only formats the app can use are accepted; SVG in particular is
// never a cover, since it can carry script.

import type { CoverExt, ManuscriptExt } from "./keys";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export function sniffCover(bytes: Uint8Array): CoverExt | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return "webp";
  }
  return null;
}

/**
 * A .docx is a ZIP container; a .txt must be valid UTF-8 with no NUL bytes.
 * Returns null when the bytes are neither.
 */
export function sniffManuscript(bytes: Uint8Array): ManuscriptExt | null {
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "docx";
  if (bytes.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "txt";
  } catch {
    return null;
  }
}
