import { describe, it, expect, beforeAll } from "vitest";
import {
  splitIntoChapters,
  mergeChapters,
  buildChapterSummary,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";
import { generateLargeManuscript } from "../fixtures/generate-large-doc";

let largeDoc: TiptapDoc;

beforeAll(() => {
  largeDoc = generateLargeManuscript() as TiptapDoc;
});

describe("splitIntoChapters — performance", () => {
  it("splits a 100K-word document in under 2000ms", () => {
    const start = performance.now();
    const chapters = splitIntoChapters(largeDoc);
    const elapsed = performance.now() - start;

    console.log(`splitIntoChapters: ${elapsed.toFixed(1)}ms`);
    expect(chapters.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });

  it("produces exactly 20 chapters", () => {
    const chapters = splitIntoChapters(largeDoc);
    expect(chapters).toHaveLength(20);
  });

  it("total word count is approximately 100,000 (within 10%)", () => {
    const chapters = splitIntoChapters(largeDoc);
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    console.log(`Total word count: ${totalWords.toLocaleString()}`);
    expect(totalWords).toBeGreaterThanOrEqual(90_000);
    expect(totalWords).toBeLessThanOrEqual(110_000);
  });
});

describe("mergeChapters — round-trip fidelity", () => {
  it("split then merge produces the original document content", () => {
    const chapters = splitIntoChapters(largeDoc);
    const merged = mergeChapters(chapters);

    expect(merged.type).toBe("doc");
    expect(merged.content.length).toBe(largeDoc.content.length);
    expect(JSON.stringify(merged)).toBe(JSON.stringify(largeDoc));
  });
});

describe("individual chapter extraction — performance", () => {
  it("extracting a single chapter completes in under 500ms", () => {
    const start = performance.now();
    const chapters = splitIntoChapters(largeDoc);
    const chapter10 = chapters[9]; // Chapter 10
    const elapsed = performance.now() - start;

    console.log(`Single chapter extraction: ${elapsed.toFixed(1)}ms`);
    expect(chapter10).toBeDefined();
    expect(chapter10.title).toBe("Chapter 10");
    expect(chapter10.wordCount).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("buildChapterSummary — correctness", () => {
  it("produces correct chapter titles for all 20 chapters", () => {
    const chapters = splitIntoChapters(largeDoc);
    const summary = buildChapterSummary(chapters);

    expect(summary).toHaveLength(20);

    for (let i = 0; i < 20; i++) {
      expect(summary[i].title).toBe(`Chapter ${i + 1}`);
      expect(summary[i].wordCount).toBeGreaterThan(0);
    }
  });

  it("summary word counts match chapter word counts", () => {
    const chapters = splitIntoChapters(largeDoc);
    const summary = buildChapterSummary(chapters);

    for (let i = 0; i < chapters.length; i++) {
      expect(summary[i].wordCount).toBe(chapters[i].wordCount);
    }
  });
});
