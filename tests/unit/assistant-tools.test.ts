import { describe, expect, it } from "vitest";
import { buildAssistantTools } from "@/lib/ai/assistant/tools";
import type { ChapterChunk } from "@/lib/ai/chunk-by-chapter";
import type { StoryBible } from "@/lib/ai/continuity";

const chapters: ChapterChunk[] = [
  { index: 1, title: "One", text: "Elena walked the pier.", wordCount: 4 },
  { index: 2, title: "Two", text: "word ".repeat(6_000).trim(), wordCount: 6_000 },
];

const storyBible: StoryBible = {
  characters: [
    {
      name: "Elena",
      aliases: ["Ellie"],
      description: "Cartographer.",
      physicalTraits: [],
      relationships: [],
      firstAppearance: 1,
      lastAppearance: 2,
    },
    {
      name: "Marco",
      aliases: [],
      description: "Sailor.",
      physicalTraits: [],
      relationships: [],
      firstAppearance: 1,
      lastAppearance: 1,
    },
  ],
  locations: [{ name: "Puerto Viejo", description: "Harbor.", details: [] }],
  timeline: [],
  inconsistencies: [],
};

const callOptions = { toolCallId: "t1", messages: [] };

function build(overrides: Partial<Parameters<typeof buildAssistantTools>[0]> = {}) {
  return buildAssistantTools({
    chapters,
    storyBible,
    mode: "editorial",
    ...overrides,
  });
}

describe("read_chapter", () => {
  it("returns the chapter text", async () => {
    const { tools } = build();
    const result = (await tools.read_chapter.execute!(
      { chapter_index: 1 },
      callOptions
    )) as Record<string, unknown>;
    expect(result).toMatchObject({
      chapter_index: 1,
      title: "One",
      text: "Elena walked the pier.",
    });
  });

  it("truncates very long chapters", async () => {
    const { tools } = build();
    const result = (await tools.read_chapter.execute!(
      { chapter_index: 2 },
      callOptions
    )) as { text: string };
    expect(result.text).toContain("[Chapter truncated at 4,600 words]");
    expect(result.text.length).toBeLessThan(chapters[1].text.length);
  });

  it("reports a helpful error for an out-of-range chapter", async () => {
    const { tools } = build();
    const result = (await tools.read_chapter.execute!(
      { chapter_index: 9 },
      callOptions
    )) as { error: string };
    expect(result.error).toContain("Chapter 9 does not exist");
    expect(result.error).toContain("1–2");
  });

  it("is blocked in off mode", async () => {
    const { tools } = build({ mode: "off" });
    const result = (await tools.read_chapter.execute!(
      { chapter_index: 1 },
      callOptions
    )) as { error?: string };
    expect(result.error).toContain("not available");
  });
});

describe("query_codex", () => {
  it("matches by name or alias, case-insensitively", async () => {
    const { tools } = build();
    const result = (await tools.query_codex.execute!(
      { name: "ellie" },
      callOptions
    )) as { matches: number; characters: Array<{ name: string }> };
    expect(result.matches).toBe(1);
    expect(result.characters[0].name).toBe("Elena");
  });

  it("filters by entity type", async () => {
    const { tools } = build();
    const result = (await tools.query_codex.execute!(
      { entity_type: "location" },
      callOptions
    )) as { matches: number; locations: Array<{ name: string }> };
    expect(result.matches).toBe(1);
    expect(result.locations[0].name).toBe("Puerto Viejo");
  });

  it("explains an empty codex instead of failing", async () => {
    const { tools } = build({ storyBible: null });
    const result = (await tools.query_codex.execute!({}, callOptions)) as {
      note: string;
    };
    expect(result.note).toContain("no story bible");
  });

  it("returns a no-match note", async () => {
    const { tools } = build();
    const result = (await tools.query_codex.execute!(
      { name: "zzz" },
      callOptions
    )) as { matches: number; note: string };
    expect(result.matches).toBe(0);
    expect(result.note).toContain("No Codex entries matched");
  });
});

describe("summarizeToolResult", () => {
  it("never includes chapter text", async () => {
    const tooling = build();
    const output = await tooling.tools.read_chapter.execute!(
      { chapter_index: 1 },
      callOptions
    );
    const meta = tooling.summarizeToolResult("read_chapter", output);
    expect(meta).toEqual({ chapter_index: 1, title: "One", word_count: 4 });
    expect(JSON.stringify(meta)).not.toContain("pier");
  });

  it("summarizes codex lookups as a match count", () => {
    const tooling = build();
    const meta = tooling.summarizeToolResult("query_codex", {
      matches: 3,
      characters: [{ name: "Elena" }],
    });
    expect(meta).toEqual({ matches: 3 });
  });

  it("flags errored tool runs", () => {
    const tooling = build();
    expect(
      tooling.summarizeToolResult("read_chapter", { error: "nope" })
    ).toEqual({ error: true });
  });
});
