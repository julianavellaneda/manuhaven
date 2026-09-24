import "server-only";

import type { ExportExt } from "@/lib/storage/keys";

export interface PrintSettings {
  trimSize: "5x8" | "5.5x8.5" | "6x9";
  margins: "narrow" | "normal" | "wide";
  fontSize: "small" | "medium" | "large";
}

export interface ConvertRequest {
  html: string;
  metadata: Record<string, string | null | undefined>;
  /** A converter stylesheet name: the template's genre, lowercased. */
  templateId: string;
  cover?: { base64: string; contentType: string };
  printSettings?: PrintSettings;
}

/**
 * The converter was unreachable or refused the job. `status` is its HTTP
 * status, or null when it could not be reached. Carries no response text:
 * the converter never echoes manuscript content, and neither does this.
 */
export class ConverterError extends Error {
  constructor(readonly status: number | null) {
    super(
      status === null
        ? "Converter unreachable"
        : `Converter returned ${status}`,
    );
    this.name = "ConverterError";
  }
}

// WeasyPrint gets 120s inside the converter; allow for the transfer on top.
const CONVERT_TIMEOUT_MS = 180_000;

/**
 * Render a book with the converter service (services/converter). JSON goes
 * in, the file's bytes come back; the converter holds no credentials and the
 * caller stores the result.
 */
export async function convert(
  format: ExportExt,
  request: ConvertRequest,
): Promise<Uint8Array> {
  const baseUrl = process.env.CONVERTER_URL || "http://localhost:3001";
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/convert/${format}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CONVERTER_API_KEY}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(CONVERT_TIMEOUT_MS),
    });
  } catch {
    throw new ConverterError(null);
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new ConverterError(res.status);
  }
  return new Uint8Array(await res.arrayBuffer());
}
