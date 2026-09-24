// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStorage } from "@/lib/storage/fs";
import { InvalidStorageKeyError, type StorageProvider } from "@/lib/storage/types";

let parent: string;
let root: string;
let storage: StorageProvider;

beforeEach(async () => {
  parent = await mkdtemp(path.join(tmpdir(), "manuhaven-storage-"));
  root = path.join(parent, "files");
  storage = createFsStorage(root);
});

afterEach(async () => {
  await rm(parent, { recursive: true, force: true });
});

async function read(key: string): Promise<string | null> {
  const file = await storage.get(key);
  if (!file) return null;
  return new Response(file.body).text();
}

describe("fs storage", () => {
  it("round-trips a file and reports its size", async () => {
    await storage.put("u/p/cover.png", new TextEncoder().encode("hello"));
    const file = await storage.get("u/p/cover.png");
    expect(file?.size).toBe(5);
    expect(await read("u/p/cover.png")).toBe("hello");
  });

  it("replaces a file without leaving temp files behind", async () => {
    await storage.put("u/p/cover.png", new TextEncoder().encode("one"));
    await storage.put("u/p/cover.png", new TextEncoder().encode("two"));
    expect(await read("u/p/cover.png")).toBe("two");
    expect(await readdir(path.join(root, "u/p"))).toEqual(["cover.png"]);
  });

  it("returns null for a missing file or a directory", async () => {
    await storage.put("u/p/cover.png", new Uint8Array([1]));
    expect(await storage.get("u/p/missing.png")).toBeNull();
    expect(await storage.get("u/p")).toBeNull();
  });

  it("deletes idempotently", async () => {
    await storage.put("u/p/cover.png", new Uint8Array([1]));
    await storage.delete("u/p/cover.png");
    await storage.delete("u/p/cover.png");
    expect(await storage.get("u/p/cover.png")).toBeNull();
  });

  it("deletes a prefix and nothing outside it", async () => {
    await storage.put("alice/p1/cover.png", new Uint8Array([1]));
    await storage.put("alice/p2/manuscript/original.txt", new Uint8Array([1]));
    await storage.put("alicex/p1/cover.png", new Uint8Array([1]));
    await storage.deletePrefix("alice/");
    expect(await storage.get("alice/p1/cover.png")).toBeNull();
    expect(await storage.get("alice/p2/manuscript/original.txt")).toBeNull();
    expect(await read("alicex/p1/cover.png")).not.toBeNull();
  });

  it.each([
    "../outside.txt",
    "u/../../outside.txt",
    "/tmp/outside.txt",
    "u/./p.txt",
  ])("refuses to touch %j", async (key) => {
    await writeFile(path.join(parent, "outside.txt"), "secret");
    const bytes = new Uint8Array([1]);
    await expect(storage.put(key, bytes)).rejects.toThrow(InvalidStorageKeyError);
    await expect(storage.get(key)).rejects.toThrow(InvalidStorageKeyError);
    await expect(storage.delete(key)).rejects.toThrow(InvalidStorageKeyError);
    expect(await readdir(parent)).toEqual(["outside.txt"]);
  });

  it("refuses a prefix that is not a folder or escapes the root", async () => {
    await expect(storage.deletePrefix("alice")).rejects.toThrow(InvalidStorageKeyError);
    await expect(storage.deletePrefix("../")).rejects.toThrow(InvalidStorageKeyError);
    await expect(storage.deletePrefix("/")).rejects.toThrow(InvalidStorageKeyError);
  });
});
