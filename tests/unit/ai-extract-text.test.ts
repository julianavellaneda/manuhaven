import { describe, it, expect } from "vitest";
import { tiptapToPlainText } from "@/lib/ai/extract-text";

describe("tiptapToPlainText", () => {
  it("extracts text from paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph." }],
        },
      ],
    };
    const out = tiptapToPlainText(doc);
    expect(out).toContain("Hello world.");
    expect(out).toContain("Second paragraph.");
  });

  it("prefixes headings with markdown hashes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Chapter One" }],
        },
      ],
    };
    expect(tiptapToPlainText(doc)).toContain("## Chapter One");
  });

  it("truncates at token budget", () => {
    const paragraphs = Array.from({ length: 2000 }, (_, i) => ({
      type: "paragraph",
      content: [{ type: "text", text: `word${i} ` }],
    }));
    const doc = { type: "doc", content: paragraphs };
    const out = tiptapToPlainText(doc, 100);
    const wordCount = out.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(Math.floor(100 / 1.3) + 5);
  });

  it("handles empty/invalid input", () => {
    expect(tiptapToPlainText(null)).toBe("");
    expect(tiptapToPlainText(undefined)).toBe("");
    expect(tiptapToPlainText({})).toBe("");
  });

  it("strips formatting marks but keeps text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and italic" },
          ],
        },
      ],
    };
    expect(tiptapToPlainText(doc)).toContain("bold and italic");
  });
});
