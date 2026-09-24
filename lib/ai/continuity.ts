import { z } from "zod";
import { generateForUser } from "./generate";
import { InputTooShortError, InvalidResponseError } from "./errors";
import { chunkByChapter } from "./chunk-by-chapter";
import { buildContinuityPrompt } from "./prompts/continuity";
import { validateWithSchema } from "./validation";

const chapterInt = z.number().int().min(1);

const PhysicalTraitSchema = z.object({
  trait: z.string(),
  value: z.string(),
  firstMention: chapterInt,
});

const RelationshipSchema = z.object({
  character: z.string(),
  type: z.string(),
  since: chapterInt,
});

const CharacterSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  description: z.string(),
  physicalTraits: z.array(PhysicalTraitSchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
  firstAppearance: chapterInt,
  lastAppearance: chapterInt,
});

const LocationDetailSchema = z.object({
  detail: z.string(),
  firstMention: chapterInt,
});

const LocationSchema = z.object({
  name: z.string(),
  description: z.string(),
  details: z.array(LocationDetailSchema).default([]),
});

const TimelineEventSchema = z.object({
  event: z.string(),
  chapter: chapterInt,
  relativeTime: z.string(),
});

const InconsistencySchema = z.object({
  type: z.enum(["character", "location", "timeline", "object"]),
  description: z.string(),
  chapters: z.array(chapterInt),
  severity: z.enum(["error", "warning"]),
});

export const StoryBibleSchema = z.object({
  characters: z.array(CharacterSchema).default([]),
  locations: z.array(LocationSchema).default([]),
  timeline: z.array(TimelineEventSchema).default([]),
  inconsistencies: z.array(InconsistencySchema).default([]),
});

export type StoryBible = z.infer<typeof StoryBibleSchema>;

export interface GenerateStoryBibleOptions {
  tiptapJson: unknown;
  /** Authenticated user id — selects their BYOK key and model. */
  userId: string;
}

const MIN_TOTAL_WORDS = 200;

export async function generateStoryBible(
  opts: GenerateStoryBibleOptions
): Promise<StoryBible> {
  const chapters = chunkByChapter(opts.tiptapJson, 2_500);
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);

  if (chapters.length === 0 || totalWords < MIN_TOTAL_WORDS) {
    throw new InputTooShortError(
      "Manuscript is too short to build a Story Bible"
    );
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { system, user } = buildContinuityPrompt({
      chapters,
      strict: attempt > 0,
    });
    const response = await generateForUser({
      userId: opts.userId,
      system,
      user,
      maxTokens: 6_000,
      timeoutMs: 240_000,
    });
    try {
      return validateWithSchema(response.text, StoryBibleSchema);
    } catch (err) {
      if (attempt === 0 && err instanceof InvalidResponseError) continue;
      throw err;
    }
  }
  throw new InvalidResponseError(
    "Story Bible validation failed after retry"
  );
}
