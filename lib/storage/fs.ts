import "server-only";

import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { isValidKey } from "./keys";
import { InvalidStorageKeyError, type StorageProvider } from "./types";

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

/** Files on a local volume under `root` (STORAGE_DIR). */
export function createFsStorage(root: string): StorageProvider {
  const base = path.resolve(root);

  // isValidKey already refuses `..` and absolute paths; the containment check
  // is a second line of defence against anything it misses.
  function resolve(key: string): string {
    if (!isValidKey(key)) throw new InvalidStorageKeyError();
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new InvalidStorageKeyError();
    return full;
  }

  return {
    async put(key, body) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      // Write beside the target and rename, so a reader never sees a
      // half-written file and a failed write leaves the old one intact.
      const tmp = `${full}.${randomUUID()}.tmp`;
      try {
        await writeFile(tmp, body);
        await rename(tmp, full);
      } catch (err) {
        await rm(tmp, { force: true });
        throw err;
      }
    },

    async get(key) {
      const full = resolve(key);
      let size: number;
      try {
        const info = await stat(full);
        if (!info.isFile()) return null;
        size = info.size;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
      const body = Readable.toWeb(
        createReadStream(full),
      ) as ReadableStream<Uint8Array>;
      return { body, size };
    },

    async delete(key) {
      try {
        await unlink(resolve(key));
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    },

    async deletePrefix(prefix) {
      if (!prefix.endsWith("/")) throw new InvalidStorageKeyError();
      await rm(resolve(prefix.slice(0, -1)), { recursive: true, force: true });
    },
  };
}
