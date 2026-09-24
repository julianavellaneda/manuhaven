/**
 * Where uploaded and generated files live. The database stores keys (see
 * keys.ts), never URLs; browsers read files through /api/files. Every method
 * rejects a key that fails isValidKey().
 */
export interface StorageProvider {
  /** Create or replace the object at key. */
  put(key: string, body: Uint8Array): Promise<void>;
  /** The object's bytes as a stream, or null when there is none. */
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>;
  /** Remove one object. A missing object is not an error. */
  delete(key: string): Promise<void>;
  /**
   * Remove every object under a folder-like prefix ending in "/", such as
   * `${userId}/`.
   */
  deletePrefix(prefix: string): Promise<void>;
}

export class InvalidStorageKeyError extends Error {
  constructor() {
    super("Invalid storage key");
    this.name = "InvalidStorageKeyError";
  }
}
