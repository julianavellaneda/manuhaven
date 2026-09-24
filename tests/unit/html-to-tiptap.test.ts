import { describe, expect, it } from "vitest";
import { htmlToTiptap } from "@/lib/manuscript/html-to-tiptap";
import { txtToTiptap } from "@/lib/manuscript/txt-to-tiptap";

const t = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) =>
  marks ? { type: "text", text, marks } : { type: "text", text };

describe("htmlToTiptap", () => {
  it("returns a doc with one empty paragraph for empty input", () => {
    expect(htmlToTiptap("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(htmlToTiptap("   \n  ")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("converts headings of every level and paragraphs", () => {
    const doc = htmlToTiptap("<h1>Title</h1><h3>Sub</h3><p>Body</p><p></p>");
    expect(doc.content).toEqual([
      { type: "heading", attrs: { level: 1 }, content: [t("Title")] },
      { type: "heading", attrs: { level: 3 }, content: [t("Sub")] },
      { type: "paragraph", content: [t("Body")] },
      { type: "paragraph", content: undefined },
    ]);
  });

  it("maps inline formatting tags to marks, nesting them in order", () => {
    const doc = htmlToTiptap(
      "<p>a <strong>b <em>c</em></strong> <u>d</u> <s>e</s> <b>f</b><i>g</i></p>",
    );
    expect(doc.content![0].content).toEqual([
      t("a "),
      t("b ", [{ type: "bold" }]),
      t("c", [{ type: "bold" }, { type: "italic" }]),
      t(" "),
      t("d", [{ type: "underline" }]),
      t(" "),
      t("e", [{ type: "strike" }]),
      t(" "),
      t("f", [{ type: "bold" }]),
      t("g", [{ type: "italic" }]),
    ]);
  });

  it("turns links into link marks and <br> into hard breaks", () => {
    const doc = htmlToTiptap('<p><a href="https://example.com">site</a><br>next</p>');
    expect(doc.content![0].content).toEqual([
      t("site", [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }]),
      { type: "hardBreak" },
      t("next"),
    ]);
  });

  it("unwraps unknown inline elements but keeps outer marks", () => {
    const doc = htmlToTiptap('<p><em><span class="x">inner</span></em></p>');
    expect(doc.content![0].content).toEqual([t("inner", [{ type: "italic" }])]);
  });

  it("converts lists, wrapping inline list items in paragraphs", () => {
    const doc = htmlToTiptap("<ul><li>one</li><li><b>two</b></li></ul><ol><li>x</li></ol>");
    expect(doc.content).toEqual([
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [t("one")] }] },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [t("two", [{ type: "bold" }])] }],
          },
        ],
      },
      {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("x")] }] }],
      },
    ]);
  });

  it("supports nested lists inside list items", () => {
    const doc = htmlToTiptap("<ul><li><p>outer</p><ul><li>inner</li></ul></li></ul>");
    const item = doc.content![0].content![0];
    expect(item.content).toEqual([
      { type: "paragraph", content: [t("outer")] },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("inner")] }] }],
      },
    ]);
  });

  it("keeps mixed inline content of a list item in one paragraph before a nested list", () => {
    const doc = htmlToTiptap("<ul><li>plain <em>styled</em> end<ol><li>n</li></ol></li><li></li></ul>");
    expect(doc.content![0].content).toEqual([
      {
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [t("plain "), t("styled", [{ type: "italic" }]), t(" end")],
          },
          {
            type: "orderedList",
            content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("n")] }] }],
          },
        ],
      },
      { type: "listItem", content: [{ type: "paragraph" }] },
    ]);
  });

  it("drops empty lists and ignores non-li children of lists", () => {
    const doc = htmlToTiptap("<ul></ul><p>after</p>");
    expect(doc.content).toEqual([{ type: "paragraph", content: [t("after")] }]);
  });

  it("converts blockquotes, falling back to an empty paragraph", () => {
    const doc = htmlToTiptap("<blockquote><p>q</p></blockquote><blockquote></blockquote>");
    expect(doc.content).toEqual([
      { type: "blockquote", content: [{ type: "paragraph", content: [t("q")] }] },
      { type: "blockquote", content: [{ type: "paragraph" }] },
    ]);
  });

  it("flattens container elements and wraps loose text in paragraphs", () => {
    const doc = htmlToTiptap("<div><section><p>in</p></section>  loose text  <hr></div>");
    expect(doc.content).toEqual([
      { type: "paragraph", content: [t("in")] },
      { type: "paragraph", content: [t("loose text")] },
      { type: "horizontalRule" },
    ]);
  });

  it("keeps markup-looking text as plain text, never as nodes", () => {
    const doc = htmlToTiptap("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(doc.content).toEqual([{ type: "paragraph", content: [t("<script>alert(1)</script>")] }]);
  });
});

describe("txtToTiptap", () => {
  it("returns a doc with one empty paragraph for blank input", () => {
    expect(txtToTiptap("\n\n  \n")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("detects chapter-style headings as H1", () => {
    const doc = txtToTiptap(
      "Prologue\n\nIt began.\n\nChapter 1\n\nText.\n\nChapter Two\n\nPart IV\n\nTHE END",
    );
    const headings = doc.content!.filter((n) => n.type === "heading").map((n) => n.content![0].text);
    expect(headings).toEqual(["Prologue", "Chapter 1", "Chapter Two", "Part IV", "THE END"]);
    expect(doc.content![1]).toEqual({ type: "paragraph", content: [t("It began.")] });
  });

  it("does not treat mixed-case prose as a heading", () => {
    const doc = txtToTiptap("Chapter one was long ago.\n\nShe said nothing.");
    expect(doc.content!.every((n) => n.type === "paragraph")).toBe(true);
  });

  it("splits single newlines into separate paragraphs and normalizes CRLF/CR", () => {
    const doc = txtToTiptap("line one\r\nline two\r\n\r\nline three\rline four");
    expect(doc.content).toEqual([
      { type: "paragraph", content: [t("line one")] },
      { type: "paragraph", content: [t("line two")] },
      { type: "paragraph", content: [t("line three")] },
      { type: "paragraph", content: [t("line four")] },
    ]);
  });
});
