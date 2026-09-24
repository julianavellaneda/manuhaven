import type { z } from "zod";
import { InvalidResponseError } from "./errors";

export function extractJSON(raw: string): unknown {
  if (!raw) throw new InvalidResponseError("Empty AI response");

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : raw;

  const start = candidate.indexOf("{");
  if (start === -1) throw new InvalidResponseError("No JSON object in response");

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          // JSON.parse messages quote the input, i.e. model output about the
          // manuscript, so they never make it into the error.
          throw new InvalidResponseError("Failed to parse JSON");
        }
      }
    }
  }
  throw new InvalidResponseError("Unterminated JSON object in response");
}

export function validateWithSchema<T>(raw: string, schema: z.ZodType<T>): T {
  const parsed = extractJSON(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidResponseError(
      `Schema validation failed: ${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`
    );
  }
  return result.data;
}
