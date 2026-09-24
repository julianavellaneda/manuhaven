import "server-only";

import path from "node:path";
import { createFsStorage } from "./fs";
import { createS3Storage } from "./s3";
import type { StorageProvider } from "./types";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3`);
  return value;
}

function createStorage(): StorageProvider {
  const driver = process.env.STORAGE_DRIVER || "fs";
  if (driver === "fs") {
    return createFsStorage(
      process.env.STORAGE_DIR || path.join(process.cwd(), ".data", "files"),
    );
  }
  if (driver === "s3") {
    return createS3Storage({
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || "us-east-1",
      bucket: required("S3_BUCKET"),
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    });
  }
  throw new Error(`Unknown STORAGE_DRIVER "${driver}" (expected fs or s3)`);
}

let instance: StorageProvider | undefined;

/**
 * The configured storage driver. Lazy, so importing this module during
 * `next build` never reads storage configuration.
 */
export function getStorage(): StorageProvider {
  instance ??= createStorage();
  return instance;
}
