import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { ChapterChunk } from "@/lib/ai/chunk-by-chapter";
import type { StoryBible } from "@/lib/ai/continuity";
import { isToolAllowed, type AssistantToolName } from "@/lib/ai/assistant/modes";
import type { AutonomyMode } from "@/lib/ai/assistant/types";

/**
 * Server-executed tool registry for the assistant chat loop
 * (see docs/ai.md, "The assistant"). Mode allowlists are
 * enforced inside execute — the client's mode claim is never trusted.
 * query_codex reads the `manuscripts.story_bible` blob until the codex
 * tables land (ROADMAP.md v0.3).
 */

// ~6k tokens at the repo's 1.3 tokens/word estimate (lib/ai/extract-text.ts).
const READ_CHAPTER_MAX_WORDS = 4_600;

export interface AssistantToolContext {
  chapters: ChapterChunk[];
  storyBible: StoryBible | null;
  mode: AutonomyMode;
}

export interface AssistantTooling {
  tools: ToolSet;
  /** Small, text-free summary of a tool result for UI activity chips. */
  summarizeToolResult: (
    name: string,
    output: unknown
  ) => Record<string, unknown>;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}\n\n[Chapter truncated at ${maxWords.toLocaleString("en-US")} words]`;
}

function modeGate(name: AssistantToolName, mode: AutonomyMode) {
  if (isToolAllowed(name, mode)) return null;
  return { error: "This tool is not available in the current assistant mode." };
}

function matchesName(query: string, name: string, aliases: string[] = []) {
  const q = query.toLowerCase();
  return [name, ...aliases].some((n) => n.toLowerCase().includes(q));
}

export function buildAssistantTools(
  ctx: AssistantToolContext
): AssistantTooling {
  const readChapter = tool({
    description:
      "Read the full text of one chapter of the manuscript. Use this to verify details before asserting them. Chapters are numbered from 1.",
    inputSchema: z.object({
      chapter_index: z
        .number()
        .int()
        .min(1)
        .describe("1-based chapter number from the chapter outline"),
    }),
    execute: async ({ chapter_index }) => {
      const gate = modeGate("read_chapter", ctx.mode);
      if (gate) return gate;
      const chapter = ctx.chapters.find((c) => c.index === chapter_index);
      if (!chapter) {
        return {
          error: `Chapter ${chapter_index} does not exist — the book has ${ctx.chapters.length} chapters (1–${ctx.chapters.length}).`,
        };
      }
      return {
        chapter_index: chapter.index,
        title: chapter.title,
        word_count: chapter.wordCount,
        text: truncateWords(chapter.text, READ_CHAPTER_MAX_WORDS),
      };
    },
  });

  const queryCodex = tool({
    description:
      "Look up entries in the book's Codex (story bible): characters, locations, timeline events, and known continuity flags. Filter by entity type and/or a name to search for.",
    inputSchema: z.object({
      entity_type: z
        .enum(["character", "location", "timeline_event", "inconsistency"])
        .optional()
        .describe("Restrict results to one entity type"),
      name: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe("Case-insensitive name or alias to search for"),
    }),
    execute: async ({ entity_type, name }) => {
      const gate = modeGate("query_codex", ctx.mode);
      if (gate) return gate;
      const bible = ctx.storyBible;
      if (!bible) {
        return {
          note: "The Codex is empty for this book — no story bible has been generated yet. Use read_chapter to answer from the manuscript directly.",
        };
      }
      const wantType = (t: string) => !entity_type || entity_type === t;
      const characters = wantType("character")
        ? bible.characters.filter(
            (c) => !name || matchesName(name, c.name, c.aliases)
          )
        : [];
      const locations = wantType("location")
        ? bible.locations.filter((l) => !name || matchesName(name, l.name))
        : [];
      const timeline = wantType("timeline_event")
        ? bible.timeline.filter(
            (t) => !name || t.event.toLowerCase().includes(name.toLowerCase())
          )
        : [];
      const inconsistencies = wantType("inconsistency")
        ? bible.inconsistencies.filter(
            (i) =>
              !name || i.description.toLowerCase().includes(name.toLowerCase())
          )
        : [];
      const matches =
        characters.length +
        locations.length +
        timeline.length +
        inconsistencies.length;
      if (matches === 0) {
        return {
          matches: 0,
          note: "No Codex entries matched. The Codex may be incomplete — try read_chapter to check the manuscript itself.",
        };
      }
      return { matches, characters, locations, timeline, inconsistencies };
    },
  });

  const summarizeToolResult = (
    name: string,
    output: unknown
  ): Record<string, unknown> => {
    const o = (output ?? {}) as Record<string, unknown>;
    if ("error" in o) return { error: true };
    if (name === "read_chapter") {
      return {
        chapter_index: o.chapter_index,
        title: o.title,
        word_count: o.word_count,
      };
    }
    if (name === "query_codex") {
      return { matches: typeof o.matches === "number" ? o.matches : 0 };
    }
    return {};
  };

  return {
    tools: { read_chapter: readChapter, query_codex: queryCodex },
    summarizeToolResult,
  };
}
