import "server-only";

// Size slack for multipart boundaries and part headers.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 411 | 413,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Parse a multipart upload, refusing oversize bodies from their
 * Content-Length before buffering them. Browsers always send one for a
 * FormData body; a request without it is refused rather than buffered blind.
 * `maxBodyBytes` bounds the whole request; callers still check each file's
 * own limit.
 */
export async function readMultipart(
  request: Request,
  maxBodyBytes: number,
): Promise<FormData> {
  const declared = Number(request.headers.get("content-length"));
  if (!declared) throw new UploadError("Content-Length required", 411);
  if (declared > maxBodyBytes + MULTIPART_OVERHEAD_BYTES) {
    throw new UploadError("File too large", 413);
  }
  try {
    return await request.formData();
  } catch {
    throw new UploadError("Expected a multipart form upload", 400);
  }
}

/** The named file field's bytes, enforcing its size limit. */
export async function readFileField(
  form: FormData,
  name: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const file = form.get(name);
  if (!(file instanceof File) || file.size === 0) {
    throw new UploadError(`Missing file field "${name}"`, 400);
  }
  if (file.size > maxBytes) throw new UploadError("File too large", 413);
  return new Uint8Array(await file.arrayBuffer());
}
