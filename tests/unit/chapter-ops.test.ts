import { describe, expect, it } from "vitest";
import {
  blankChapter,
  deleteChapter,
  mergeWithNext,
  nextChapterTitle,
  renameChapter,
  reorderChapters,
  splitChapterAt,
} from "@/lib/manuscript/chapter-ops";
import type { Chapter, TiptapNode } from "@/lib/manuscript/chapter-utils";

const h1 = (text: string): TiptapNode => ({
  type: "heading",
  attrs: { level: 1 },
  content: [{ type: "text", text }],
});
const h2 = (text: string): TiptapNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const p = (text: string): TiptapNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

function chapter(id: string, title: string, body: TiptapNode[] = []): Chapter {
  return {
    id,
    title,
    content: { type: "doc", content: [h1(title), ...body] },
    wordCount: 0,
  };
}

const three = () => [
  chapter("a", "Chapter 1", [p("one two")]),
  chapter("b", "Chapter 2", [p("three four five")]),
  chapter("c", "Chapter 3", [p("six")]),
];

const text = (node: TiptapNode | undefined) =>
  (node?.content ?? []).map((n) => n.text ?? "").join("");

describe("nextChapterTitle", () => {
  it("continues after the highest numbered chapter, not the insertion point", () => {
    expect(nextChapterTitle(three(), 0)).toBe("Chapter 4");
  });

  it("ignores titles that are not exactly 'Chapter N'", () => {
    const chapters = [
      chapter("a", "Prologue"),
      chapter("b", "chapter 7"),
      chapter("c", "Chapter 12: The End"),
      chapter("d", "Chapter Nine"),
    ];
    expect(nextChapterTitle(chapters, 0)).toBe("Chapter 8");
  });

  it("starts at Chapter 1 with no numbered chapters", () => {
    expect(nextChapterTitle([], 0)).toBe("Chapter 1");
    expect(nextChapterTitle([chapter("a", "Prologue")], 0)).toBe("Chapter 1");
  });
});

describe("blankChapter", () => {
  it("has a matching H1 and an empty paragraph", () => {
    const ch = blankChapter("Chapter 5");
    expect(ch.title).toBe("Chapter 5");
    expect(ch.wordCount).toBe(0);
    expect(ch.content.content).toEqual([h1("Chapter 5"), { type: "paragraph" }]);
  });

  it("defaults the title", () => {
    expect(blankChapter().title).toBe("New Chapter");
  });
});

describe("renameChapter", () => {
  it("updates the title and the leading H1 without touching other chapters", () => {
    const before = three();
    const after = renameChapter(before, 1, "  The Storm  ");
    expect(after[1].title).toBe("The Storm");
    expect(after[1].content.content[0]).toEqual(h1("The Storm"));
    expect(after[1].content.content[1]).toEqual(p("three four five"));
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    // Input is not mutated.
    expect(before[1].title).toBe("Chapter 2");
    expect(text(before[1].content.content[0])).toBe("Chapter 2");
  });

  it("falls back to 'Untitled' for a blank title", () => {
    expect(renameChapter(three(), 0, "   ")[0].title).toBe("Untitled");
  });

  it("prepends an H1 when the chapter starts with a paragraph or H2", () => {
    const noHeading: Chapter = {
      id: "x",
      title: "Old",
      content: { type: "doc", content: [p("body")] },
      wordCount: 1,
    };
    const [renamed] = renameChapter([noHeading], 0, "New");
    expect(renamed.content.content).toEqual([h1("New"), p("body")]);

    const withH2: Chapter = {
      id: "y",
      title: "Old",
      content: { type: "doc", content: [h2("Section"), p("body")] },
      wordCount: 1,
    };
    const [renamedH2] = renameChapter([withH2], 0, "New");
    expect(renamedH2.content.content).toEqual([h1("New"), h2("Section"), p("body")]);
  });

  it("treats a heading with no level as the title heading", () => {
    const ch: Chapter = {
      id: "z",
      title: "Old",
      content: {
        type: "doc",
        content: [{ type: "heading", content: [{ type: "text", text: "Old" }] }],
      },
      wordCount: 0,
    };
    const [renamed] = renameChapter([ch], 0, "New");
    expect(renamed.content.content).toHaveLength(1);
    expect(text(renamed.content.content[0])).toBe("New");
  });

  it("returns the same array for an out-of-range index", () => {
    const chapters = three();
    expect(renameChapter(chapters, -1, "X")).toBe(chapters);
    expect(renameChapter(chapters, 3, "X")).toBe(chapters);
  });
});

describe("reorderChapters", () => {
  it("moves a chapter forward and backward", () => {
    expect(reorderChapters(three(), 0, 2).map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(reorderChapters(three(), 2, 0).map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input", () => {
    const chapters = three();
    reorderChapters(chapters, 0, 1);
    expect(chapters.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("returns the same array for no-op or out-of-range moves", () => {
    const chapters = three();
    expect(reorderChapters(chapters, 1, 1)).toBe(chapters);
    expect(reorderChapters(chapters, -1, 0)).toBe(chapters);
    expect(reorderChapters(chapters, 0, 3)).toBe(chapters);
  });
});

describe("deleteChapter", () => {
  it("removes the chapter at the index", () => {
    expect(deleteChapter(three(), 1).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("replaces the last remaining chapter with a blank Chapter 1", () => {
    const [only] = deleteChapter([chapter("a", "Prologue", [p("words here")])], 0);
    expect(only.id).not.toBe("a");
    expect(only.title).toBe("Chapter 1");
    expect(only.content.content).toEqual([h1("Chapter 1"), { type: "paragraph" }]);
  });
});

describe("mergeWithNext", () => {
  it("appends the next chapter's body, drops its H1 and recounts words", () => {
    const merged = mergeWithNext(three(), 0);
    expect(merged.map((c) => c.id)).toEqual(["a", "c"]);
    expect(merged[0].title).toBe("Chapter 1");
    expect(merged[0].content.content).toEqual([
      h1("Chapter 1"),
      p("one two"),
      p("three four five"),
    ]);
    // "Chapter 1" (2) + "one two" (2) + "three four five" (3)
    expect(merged[0].wordCount).toBe(7);
  });

  it("keeps the next chapter's leading H2", () => {
    const chapters: Chapter[] = [
      chapter("a", "One", [p("x")]),
      { id: "b", title: "Two", content: { type: "doc", content: [h2("Sub"), p("y")] }, wordCount: 0 },
    ];
    const [merged] = mergeWithNext(chapters, 0);
    expect(merged.content.content).toEqual([h1("One"), p("x"), h2("Sub"), p("y")]);
  });

  it("is a no-op on the last chapter or an invalid index", () => {
    const chapters = three();
    expect(mergeWithNext(chapters, 2)).toBe(chapters);
    expect(mergeWithNext(chapters, -1)).toBe(chapters);
  });
});

describe("splitChapterAt", () => {
  const long = () => [
    chapter("a", "Chapter 1", [p("alpha"), p("beta gamma"), p("delta")]),
    chapter("b", "Chapter 2"),
  ];

  it("moves nodes from the split index into a new chapter with a fallback H1", () => {
    const result = splitChapterAt(long(), 0, 2, "Chapter 3")!;
    expect(result.newActiveIndex).toBe(1);
    expect(result.chapters.map((c) => c.title)).toEqual(["Chapter 1", "Chapter 3", "Chapter 2"]);
    expect(result.updatedActive.content.content).toEqual([h1("Chapter 1"), p("alpha")]);
    expect(result.updatedActive.wordCount).toBe(3);
    expect(result.newChapter.content.content).toEqual([
      h1("Chapter 3"),
      p("beta gamma"),
      p("delta"),
    ]);
    expect(result.newChapter.wordCount).toBe(5);
    expect(result.chapters[1]).toBe(result.newChapter);
    expect(result.newChapter.id).not.toBe("a");
  });

  it("takes the new title from an H1 that starts the split", () => {
    const chapters = [chapter("a", "One", [p("x"), h1("  Two  "), p("y")])];
    const result = splitChapterAt(chapters, 0, 2, "Fallback")!;
    expect(result.newChapter.title).toBe("Two");
    expect(result.newChapter.content.content).toEqual([h1("  Two  "), p("y")]);
  });

  it("uses the fallback title when the leading H1 is empty", () => {
    const chapters = [
      chapter("a", "One", [{ type: "heading", attrs: { level: 1 } }, p("y")]),
    ];
    expect(splitChapterAt(chapters, 0, 1)!.newChapter.title).toBe("New Chapter");
  });

  it("gives the new chapter an empty paragraph when split at the end", () => {
    const result = splitChapterAt(long(), 0, 99, "Tail")!;
    expect(result.updatedActive.content.content).toHaveLength(4);
    expect(result.newChapter.content.content).toEqual([h1("Tail"), { type: "paragraph" }]);
    expect(result.newChapter.wordCount).toBe(1);
  });

  it("leaves an empty paragraph behind when split at the start", () => {
    const result = splitChapterAt(long(), 0, -5, "Ignored")!;
    expect(result.updatedActive.content.content).toEqual([{ type: "paragraph" }]);
    expect(result.updatedActive.wordCount).toBe(0);
    // Original H1 moved over, so its text becomes the new title.
    expect(result.newChapter.title).toBe("Chapter 1");
  });

  it("returns null for a missing chapter", () => {
    expect(splitChapterAt(long(), 5, 0)).toBeNull();
  });
});
