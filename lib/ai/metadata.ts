import { z } from "zod";
import { BISAC_CODE_SET, type Genre } from "@/lib/constants";
import { generateForUser } from "./generate";
import { InvalidResponseError } from "./errors";
import { tiptapToPlainText } from "./extract-text";
import { buildMetadataPrompt } from "./prompts/metadata";
import { validateWithSchema } from "./validation";

const bisacCode = z
  .string()
  .regex(/^[A-Z]{3}\d{6}$/, "Must be a BISAC code (e.g. FIC027000)")
  .refine((c) => BISAC_CODE_SET.has(c), {
    message: "BISAC code is not in the supported fiction list",
  });

export const AIMetadataResponseSchema = z.object({
  keywords: z.array(z.string()).length(7),
  bisacPrimary: bisacCode,
  bisacSecondary: bisacCode,
  tagline: z.string().max(120),
  blurbShort: z.string().max(600),
  blurbLong: z.string().max(1500),
});

export type AIMetadataResult = z.infer<typeof AIMetadataResponseSchema>;

export interface GenerateMetadataOptions {
  tiptapJson: unknown;
  genre: Genre;
  /** Authenticated user id — selects their BYOK key and model. */
  userId: string;
}

export async function generateBookMetadata(
  opts: GenerateMetadataOptions
): Promise<AIMetadataResult> {
  const manuscriptText = tiptapToPlainText(opts.tiptapJson, 15_000);
  if (!manuscriptText || manuscriptText.length < 200) {
    throw new InvalidResponseError(
      "Manuscript is too short to generate metadata"
    );
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { system, user } = buildMetadataPrompt({
      genre: opts.genre,
      manuscriptText,
      strict: attempt > 0,
    });
    const response = await generateForUser({
      userId: opts.userId,
      system,
      user,
      maxTokens: 2048,
    });
    try {
      return validateWithSchema(response.text, AIMetadataResponseSchema);
    } catch (err) {
      if (attempt === 0 && err instanceof InvalidResponseError) continue;
      throw err;
    }
  }
  throw new InvalidResponseError("AI metadata validation failed after retry");
}
