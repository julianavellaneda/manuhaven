import { describe, it, expect } from "vitest";
import { chunkByChapter } from "@/lib/ai/chunk-by-chapter";

function h1(text: string) {
  return {
    type: "heading",
    attrs: { level: 1 },
    content: [{ type: "text", text }],
  };
}

function p(text: string) {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

describe("chunkByChapter", () => {
  it("splits on H1 headings, 1-indexed", () => {
    const doc = {
      type: "doc",
      content: [
        h1("Chapter One"),
        p("First chapter body."),
        h1("Chapter Two"),
        p("Second chapter body."),
      ],
    };
    const chunks = chunkByChapter(doc);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].index).toBe(1);
    expect(chunks[0].title).toBe("Chapter One");
    expect(chunks[0].text).toContain("First chapter body");
    expect(chunks[1].index).toBe(2);
    expect(chunks[1].title).toBe("Chapter Two");
    expect(chunks[1].text).toContain("Second chapter body");
  });

  it("treats pre-H1 prose as chapter 1 with default title", () => {
    const doc = {
      type: "doc",
      content: [p("Front matter prose."), h1("Real Chapter"), p("Body.")],
    };
    const chunks = chunkByChapter(doc);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toContain("Front matter prose");
    expect(chunks[1].title).toBe("Real Chapter");
  });

  it("returns a single chunk for documents with no H1", () => {
    const doc = {
      type: "doc",
      content: [p("Just one big chunk of text.")],
    };
    const chunks = chunkByChapter(doc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(1);
    expect(chunks[0].text).toContain("Just one big chunk");
  });

  it("returns [] for empty/invalid input", () => {
    expect(chunkByChapter(null)).toEqual([]);
    expect(chunkByChapter(undefined)).toEqual([]);
    expect(chunkByChapter({})).toEqual([]);
    expect(
      chunkByChapter({ type: "doc", content: [h1("Empty")] })
    ).toEqual([]);
  });

  it("truncates oversized chapters to maxWordsPerChunk", () => {
    const longText = Array.from({ length: 1000 }, (_, i) => `w${i}`).join(" ");
    const doc = {
      type: "doc",
      content: [h1("Big Chapter"), p(longText)],
    };
    const chunks = chunkByChapter(doc, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].wordCount).toBeLessThanOrEqual(100);
  });

  it("computes wordCount from the truncated text", () => {
    const doc = {
      type: "doc",
      content: [h1("One"), p("alpha beta gamma delta epsilon")],
    };
    const chunks = chunkByChapter(doc);
    expect(chunks[0].wordCount).toBe(5);
  });
});
