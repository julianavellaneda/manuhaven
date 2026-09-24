import { describe, expect, it } from "vitest";
import {
  contentTypeForKey,
  coverKey,
  isValidKey,
  manuscriptKey,
} from "@/lib/storage/keys";
import { sniffCover, sniffManuscript } from "@/lib/storage/sniff";

const USER = "8f5b7c1e-3c2a-4d7e-9a61-0b1c2d3e4f50";
const PROJECT = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) =>
      typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p,
    ),
  );

describe("storage keys", () => {
  it("lays keys out under the user and project", () => {
    expect(manuscriptKey(USER, PROJECT, "docx")).toBe(
      `${USER}/${PROJECT}/manuscript/original.docx`,
    );
    expect(coverKey(USER, PROJECT, "png")).toBe(`${USER}/${PROJECT}/cover.png`);
  });

  it("accepts the keys the app writes", () => {
    expect(isValidKey(manuscriptKey(USER, PROJECT, "txt"))).toBe(true);
    expect(isValidKey(coverKey(USER, PROJECT, "webp"))).toBe(true);
  });

  it.each([
    "",
    "/etc/passwd",
    "../secret",
    `${USER}/../other/cover.png`,
    `${USER}/./cover.png`,
    `${USER}//cover.png`,
    `${USER}/..cover.png`,
    `${USER}\\..\\cover.png`,
    `${USER}/.hidden`,
    `${USER}/cover.png/`,
    `${USER}/co ver.png`,
    "a".repeat(513),
  ])("rejects %j", (key) => {
    expect(isValidKey(key)).toBe(false);
  });

  it("serves by extension, falling back to octet-stream", () => {
    expect(contentTypeForKey("u/p/cover.jpg")).toBe("image/jpeg");
    expect(contentTypeForKey("u/p/exports/x.pdf")).toBe("application/pdf");
    expect(contentTypeForKey("u/p/cover.svg")).toBe("application/octet-stream");
  });
});

describe("sniffCover", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(sniffCover(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(
      sniffCover(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe("png");
    expect(sniffCover(bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 "))).toBe("webp");
  });

  it("rejects SVG, GIF, truncated and renamed files", () => {
    expect(sniffCover(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffCover(bytes("GIF89a"))).toBeNull();
    expect(sniffCover(bytes([0x89, 0x50]))).toBeNull();
    expect(sniffCover(bytes("RIFF", [1, 2, 3, 4], "WAVE"))).toBeNull();
  });
});

describe("sniffManuscript", () => {
  it("recognises a ZIP container as docx", () => {
    expect(sniffManuscript(bytes([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe("docx");
  });

  it("accepts UTF-8 text", () => {
    expect(sniffManuscript(new TextEncoder().encode("Chapter 1\n\nIt was ñ.")))
      .toBe("txt");
  });

  it("rejects binary and invalid UTF-8", () => {
    expect(sniffManuscript(bytes("abc", [0], "def"))).toBeNull();
    expect(sniffManuscript(bytes([0xc3, 0x28]))).toBeNull();
    expect(sniffManuscript(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
  });
});
