import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { contentTypeForKey, isValidKey } from "./keys";
import { InvalidStorageKeyError, type StorageProvider } from "./types";

export type S3StorageConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

function checkKey(key: string): string {
  if (!isValidKey(key)) throw new InvalidStorageKeyError();
  return key;
}

/**
 * Any S3-compatible bucket: AWS, Cloudflare R2, RustFS, Garage. The bucket
 * must already exist and should not be public; files are only ever read
 * through /api/files.
 */
export function createS3Storage(config: S3StorageConfig): StorageProvider {
  const { bucket } = config;
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Not every S3-compatible server accepts the SDK's default flexible
    // checksums; only send them where the API requires one.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    async put(key, body) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: checkKey(key),
          Body: body,
          ContentType: contentTypeForKey(key),
        }),
      );
    },

    async get(key) {
      try {
        const res = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: checkKey(key) }),
        );
        if (!res.Body) return null;
        return {
          body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
          size: res.ContentLength ?? 0,
        };
      } catch (err) {
        if (err instanceof NoSuchKey) return null;
        throw err;
      }
    },

    async delete(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: checkKey(key) }),
      );
    },

    async deletePrefix(prefix) {
      if (!prefix.endsWith("/") || !isValidKey(prefix.slice(0, -1))) {
        throw new InvalidStorageKeyError();
      }
      // One DeleteObject per key rather than a batched DeleteObjects, which
      // needs a Content-MD5 that some S3-compatible servers handle
      // differently. A user has a handful of files, so this is cheap.
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        for (const { Key } of page.Contents ?? []) {
          if (Key) {
            await client.send(
              new DeleteObjectCommand({ Bucket: bucket, Key }),
            );
          }
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },
  };
}
