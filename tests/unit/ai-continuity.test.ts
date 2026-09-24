import { describe, it, expect } from "vitest";
import { StoryBibleSchema } from "@/lib/ai/continuity";

describe("StoryBibleSchema", () => {
  const minimal = {
    characters: [],
    locations: [],
    timeline: [],
    inconsistencies: [],
  };

  it("accepts the empty shape", () => {
    expect(StoryBibleSchema.parse(minimal)).toEqual(minimal);
  });

  it("rejects chapter index 0 (chapters are 1-indexed)", () => {
    const bad = {
      ...minimal,
      characters: [
        {
          name: "Mira",
          aliases: [],
          description: "Protagonist.",
          physicalTraits: [],
          relationships: [],
          firstAppearance: 0,
          lastAppearance: 1,
        },
      ],
    };
    expect(() => StoryBibleSchema.parse(bad)).toThrow();
  });

  it("rejects chapter 0 in inconsistencies", () => {
    const bad = {
      ...minimal,
      inconsistencies: [
        {
          type: "character",
          description: "Hair color shifts.",
          chapters: [0, 5],
          severity: "warning",
        },
      ],
    };
    expect(() => StoryBibleSchema.parse(bad)).toThrow();
  });

  it("accepts a valid 1-indexed entry", () => {
    const ok = {
      ...minimal,
      characters: [
        {
          name: "Mira",
          aliases: ["M"],
          description: "Protagonist.",
          physicalTraits: [
            { trait: "hair", value: "auburn", firstMention: 1 },
          ],
          relationships: [],
          firstAppearance: 1,
          lastAppearance: 12,
        },
      ],
      inconsistencies: [
        {
          type: "timeline",
          description: "Day count off by one",
          chapters: [3, 4],
          severity: "error",
        },
      ],
    };
    expect(StoryBibleSchema.parse(ok)).toBeTruthy();
  });

  it("defaults missing optional arrays", () => {
    const partial = {
      characters: [
        {
          name: "Mira",
          description: "Protagonist.",
          firstAppearance: 1,
          lastAppearance: 2,
        },
      ],
    };
    const parsed = StoryBibleSchema.parse(partial);
    expect(parsed.locations).toEqual([]);
    expect(parsed.characters[0].aliases).toEqual([]);
    expect(parsed.characters[0].physicalTraits).toEqual([]);
  });
});
