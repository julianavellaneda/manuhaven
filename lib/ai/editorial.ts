import { z } from "zod";
import { generateForUser } from "./generate";
import { InputTooShortError, InvalidResponseError } from "./errors";
import { chunkByChapter, type ChapterChunk } from "./chunk-by-chapter";
import {
  buildPerChapterPrompt,
  buildSynthesisPrompt,
  buildStylePrompt,
} from "./prompts/editorial";
import { validateWithSchema } from "./validation";
import type { Genre } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const chapterInt = z.number().int().min(1);
const score = z.number().min(1).max(100);

const ChapterAnalysisSchema = z.object({
  chapter: chapterInt,
  pacingScore: score,
  pace: z.enum(["fast", "moderate", "slow"]),
  pacingNote: z.string(),
  characters: z.array(z.string()).default([]),
  proseNote: z.string(),
  overusedWords: z
    .array(z.object({ word: z.string(), count: z.number().int().min(0) }))
    .default([]),
  adverbDensity: z.number().min(0),
  dialogueTags: z
    .array(z.object({ tag: z.string(), count: z.number().int().min(0) }))
    .default([]),
  avgSentenceLength: z.number().min(0),
  sentenceLengthStddev: z.number().min(0),
  monotonous: z.boolean(),
});

export type ChapterAnalysis = z.infer<typeof ChapterAnalysisSchema>;

export const EditorialReportSchema = z.object({
  overallScore: score,
  pacing: z.object({
    score,
    analysis: z.string(),
    slowSections: z
      .array(z.object({ chapter: chapterInt, description: z.string() }))
      .default([]),
    fastSections: z
      .array(z.object({ chapter: chapterInt, description: z.string() }))
      .default([]),
  }),
  characterArcs: z
    .array(
      z.object({
        character: z.string(),
        arc: z.string(),
        consistency: score,
        issues: z.array(z.string()).default([]),
      })
    )
    .default([]),
  plotStructure: z.object({
    actBreaks: z
      .array(z.object({ chapter: chapterInt, description: z.string() }))
      .default([]),
    plotHoles: z.array(z.string()).default([]),
    unresolved: z.array(z.string()).default([]),
  }),
  proseQuality: z.object({
    overusedWords: z
      .array(
        z.object({
          word: z.string(),
          count: z.number().int().min(0),
          suggestion: z.string(),
        })
      )
      .default([]),
    adverbDensity: z.number().min(0),
    dialogueTagVariety: z
      .array(
        z.object({ tag: z.string(), count: z.number().int().min(0) })
      )
      .default([]),
    sentenceLengthVariation: z.object({
      mean: z.number().min(0),
      stddev: z.number().min(0),
      monotonousSections: z
        .array(z.object({ chapter: chapterInt, description: z.string() }))
        .default([]),
    }),
  }),
  strengths: z.array(z.string()).min(1).max(8),
  suggestions: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        chapter: chapterInt,
        description: z.string(),
      })
    )
    .default([]),
});

export type EditorialReport = z.infer<typeof EditorialReportSchema>;

export const StyleAnalysisSchema = z.object({
  genreAlignment: score,
  toneProfile: z.object({
    dominant: z.string(),
    secondary: z.string(),
    outlierChapters: z.array(chapterInt).default([]),
  }),
  readingLevel: z.object({
    grade: z.number(),
    score: z.number(),
    comparison: z.enum(["above", "at", "below"]),
  }),
  paceProfile: z
    .array(
      z.object({
        chapter: chapterInt,
        pace: z.enum(["fast", "moderate", "slow"]),
      })
    )
    .default([]),
  styleMarkers: z.object({
    dialogueRatio: z.number().min(0).max(1),
    descriptionDensity: z.number().min(0).max(1),
    actionDensity: z.number().min(0).max(1),
    introspectionDensity: z.number().min(0).max(1),
  }),
  outlierPassages: z
    .array(
      z.object({
        chapter: chapterInt,
        startParagraph: z.number().int().min(0),
        issue: z.string(),
        suggestion: z.string(),
      })
    )
    .default([]),
});

export type StyleAnalysis = z.infer<typeof StyleAnalysisSchema>;

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const GENRE_LABELS: Record<Genre, string> = {
  romance: "romance",
  thriller: "thriller",
  fantasy: "fantasy",
  scifi: "science fiction",
  literary: "literary fiction",
  other: "fiction",
};

export type EditorialProgressEvent =
  | { type: "start"; totalChapters: number }
  | { type: "chapter"; index: number; total: number; title: string }
  | { type: "synthesizing" }
  | { type: "style" };

export interface GenerateEditorialReportOptions {
  tiptapJson: unknown;
  genre: Genre;
  /** Authenticated user id — selects their BYOK key and model. */
  userId: string;
  /** Max number of per-chapter calls in flight at once. */
  concurrency?: number;
  onProgress?: (event: EditorialProgressEvent) => void;
}

export interface EditorialPipelineResult {
  report: EditorialReport;
  style: StyleAnalysis;
}

const MIN_TOTAL_WORDS = 200;

async function analyzeChapter(
  chapter: ChapterChunk,
  userId: string
): Promise<ChapterAnalysis> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { system, user } = buildPerChapterPrompt({
      chapter,
      strict: attempt > 0,
    });
    const res = await generateForUser({ userId, system, user, maxTokens: 1500, timeoutMs: 120_000 });
    try {
      return validateWithSchema(res.text, ChapterAnalysisSchema);
    } catch (err) {
      if (attempt === 0 && err instanceof InvalidResponseError) continue;
      throw err;
    }
  }
  throw new InvalidResponseError(
    "Per-chapter analysis validation failed after retry"
  );
}

async function synthesize(
  analyses: ChapterAnalysis[],
  genreLabel: string,
  userId: string
): Promise<EditorialReport> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { system, user } = buildSynthesisPrompt({
      chapterAnalyses: analyses,
      genreLabel,
      strict: attempt > 0,
    });
    const res = await generateForUser({ userId, system, user, maxTokens: 6000, timeoutMs: 240_000 });
    try {
      return validateWithSchema(res.text, EditorialReportSchema);
    } catch (err) {
      if (attempt === 0 && err instanceof InvalidResponseError) continue;
      throw err;
    }
  }
  throw new InvalidResponseError(
    "Editorial synthesis validation failed after retry"
  );
}

async function analyzeStyle(
  analyses: ChapterAnalysis[],
  genreLabel: string,
  userId: string
): Promise<StyleAnalysis> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { system, user } = buildStylePrompt({
      chapterAnalyses: analyses,
      genreLabel,
      strict: attempt > 0,
    });
    const res = await generateForUser({ userId, system, user, maxTokens: 3000, timeoutMs: 180_000 });
    try {
      return validateWithSchema(res.text, StyleAnalysisSchema);
    } catch (err) {
      if (attempt === 0 && err instanceof InvalidResponseError) continue;
      throw err;
    }
  }
  throw new InvalidResponseError(
    "Style analysis validation failed after retry"
  );
}

/**
 * Run a function across an array with bounded concurrency, preserving input
 * order in the result.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers: Promise<void>[] = [];
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };
  for (let w = 0; w < Math.min(limit, items.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return out;
}

export async function generateEditorialReport(
  opts: GenerateEditorialReportOptions
): Promise<EditorialPipelineResult> {
  const chapters = chunkByChapter(opts.tiptapJson, 2_500);
  const totalWords = chapters.reduce((s, c) => s + c.wordCount, 0);
  if (chapters.length === 0 || totalWords < MIN_TOTAL_WORDS) {
    throw new InputTooShortError(
      "Manuscript is too short for an editorial report"
    );
  }

  const genreLabel = GENRE_LABELS[opts.genre] ?? "fiction";
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 6));

  opts.onProgress?.({ type: "start", totalChapters: chapters.length });

  let completed = 0;
  const analyses = await mapWithConcurrency(
    chapters,
    concurrency,
    async (ch) => {
      const result = await analyzeChapter(ch, opts.userId);
      completed++;
      opts.onProgress?.({
        type: "chapter",
        index: completed,
        total: chapters.length,
        title: ch.title,
      });
      return result;
    }
  );

  opts.onProgress?.({ type: "synthesizing" });
  const report = await synthesize(analyses, genreLabel, opts.userId);

  opts.onProgress?.({ type: "style" });
  const style = await analyzeStyle(analyses, genreLabel, opts.userId);

  return { report, style };
}
