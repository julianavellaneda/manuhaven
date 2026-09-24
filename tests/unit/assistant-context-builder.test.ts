import { describe, expect, it } from "vitest";
import {
  buildModelMessages,
  buildSystemBlocks,
} from "@/lib/ai/assistant/context-builder";
import type { ChapterChunk } from "@/lib/ai/chunk-by-chapter";
import type { StoryBible } from "@/lib/ai/continuity";

const chapters: ChapterChunk[] = [
  { index: 1, title: "The Letters", text: "…", wordCount: 2_340 },
  { index: 2, title: "North Road", text: "…", wordCount: 1_982 },
];

const storyBible: StoryBible = {
  characters: [
    {
      name: "Elena",
      aliases: ["Ellie"],
      description: "A cartographer with green eyes.",
      physicalTraits: [],
      relationships: [],
      firstAppearance: 1,
      lastAppearance: 2,
    },
  ],
  locations: [{ name: "Puerto Viejo", description: "Harbor town.", details: [] }],
  timeline: [{ event: "The letters arrive", chapter: 1, relativeTime: "day 1" }],
  inconsistencies: [
    {
      type: "character",
      description: "Eye color changes",
      chapters: [1, 2],
      severity: "warning",
    },
  ],
};

describe("buildSystemBlocks", () => {
  it("returns core + book blocks with a cache breakpoint on the book block", () => {
    const blocks = buildSystemBlocks({
      projectTitle: "Tides",
      genre: "fantasy",
      chapters,
      storyBible,
      locale: "en",
      mode: "editorial",
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].providerOptions).toBeUndefined();
    expect(blocks[1].providerOptions).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  it("includes the outline, codex digest, and mode module", () => {
    const blocks = buildSystemBlocks({
      projectTitle: "Tides",
      genre: "fantasy",
      chapters,
      storyBible,
      locale: "en",
      mode: "editorial",
    });
    expect(blocks[0].content).toContain("EDITORIAL");
    expect(blocks[1].content).toContain('"Tides"');
    expect(blocks[1].content).toContain("1. The Letters (2,340 words)");
    expect(blocks[1].content).toContain("Elena (aka Ellie)");
    expect(blocks[1].content).toContain("Puerto Viejo");
    expect(blocks[1].content).toContain("continuity flags: 1");
  });

  it("switches the response-language instruction with the locale", () => {
    const es = buildSystemBlocks({
      projectTitle: "Tides",
      genre: null,
      chapters,
      storyBible: null,
      locale: "es",
      mode: "editorial",
    });
    expect(es[1].content).toContain("Responde en español");
    expect(es[1].content).toContain("The Codex is empty");
  });
});

describe("buildModelMessages", () => {
  it("caps history at 20 and marks the last history message for caching", () => {
    const history = Array.from({ length: 24 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      text: `msg ${i}`,
    }));
    const messages = buildModelMessages({ history, message: "current" });
    expect(messages).toHaveLength(21);
    expect(messages[0].content).toBe("msg 4");
    expect(messages[19].providerOptions).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
    expect(messages[20]).toEqual({ role: "user", content: "current" });
  });

  it("drops a leading assistant turn so the model always sees a user first", () => {
    // An aborted turn leaves an unanswered user row, shifting the window so
    // that a raw recency slice can begin on an assistant message.
    const history = Array.from({ length: 25 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      text: `msg ${i}`,
    }));
    const messages = buildModelMessages({ history, message: "current" });
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("msg 6");
    expect(messages).toHaveLength(20);
    expect(messages[18].providerOptions).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  it("drops history entirely when the window holds no user turn", () => {
    const history = Array.from({ length: 3 }, (_, i) => ({
      role: "assistant" as const,
      text: `msg ${i}`,
    }));
    const messages = buildModelMessages({ history, message: "current" });
    expect(messages).toEqual([{ role: "user", content: "current" }]);
  });

  it("prefixes the turn context onto the user message", () => {
    const messages = buildModelMessages({
      history: [],
      message: "What color are her eyes?",
      turnContext: { chapterIndex: 3, chapterTitle: "North Road" },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe(
      "[The author is currently viewing chapter 3: North Road.]\n\nWhat color are her eyes?"
    );
  });
});
