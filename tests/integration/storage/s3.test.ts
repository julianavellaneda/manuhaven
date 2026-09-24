// The s3 driver against a real S3-compatible server. Skipped unless
// S3_TEST_ENDPOINT is set; see tests/integration/README.md.

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createS3Storage } from "@/lib/storage/s3";
import { InvalidStorageKeyError } from "@/lib/storage/types";

const endpoint = process.env.S3_TEST_ENDPOINT;
const config = {
  endpoint,
  region: "us-east-1",
  bucket: `manuhaven-test-${randomUUID().slice(0, 8)}`,
  accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? "manuhaven",
  secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? "manuhaven-secret",
  forcePathStyle: true,
};

const text = (s: string) => new TextEncoder().encode(s);

describe.skipIf(!endpoint)("s3 storage", () => {
  const storage = createS3Storage(config);

  beforeAll(async () => {
    const client = new S3Client({
      endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: config,
    });
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  });

  it("round-trips a file and reports its size", async () => {
    await storage.put("u/p/cover.png", text("hello"));
    const file = await storage.get("u/p/cover.png");
    expect(file?.size).toBe(5);
    expect(await new Response(file!.body).text()).toBe("hello");
  });

  it("returns null for a missing file and deletes idempotently", async () => {
    expect(await storage.get("u/p/missing.png")).toBeNull();
    await storage.delete("u/p/missing.png");
  });

  it("deletes a prefix and nothing outside it", async () => {
    await storage.put("alice/p1/cover.png", text("1"));
    await storage.put("alice/p2/manuscript/original.txt", text("2"));
    await storage.put("alicex/p1/cover.png", text("3"));
    await storage.deletePrefix("alice/");
    expect(await storage.get("alice/p1/cover.png")).toBeNull();
    expect(await storage.get("alice/p2/manuscript/original.txt")).toBeNull();
    expect(await storage.get("alicex/p1/cover.png")).not.toBeNull();
  });

  it("refuses invalid keys and prefixes", async () => {
    await expect(storage.put("../x", text("x"))).rejects.toThrow(InvalidStorageKeyError);
    await expect(storage.deletePrefix("")).rejects.toThrow(InvalidStorageKeyError);
    await expect(storage.deletePrefix("/")).rejects.toThrow(InvalidStorageKeyError);
  });
});
