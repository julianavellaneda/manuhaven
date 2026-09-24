import { describe, expect, it } from "vitest";
import { tiptapToHtml, type TiptapNode } from "@/lib/tiptap-to-html";

const doc = (...content: TiptapNode[]): TiptapNode => ({ type: "doc", content });
const p = (...content: TiptapNode[]): TiptapNode => ({ type: "paragraph", content });
const text = (t: string, marks?: TiptapNode["marks"]): TiptapNode =>
  marks ? { type: "text", text: t, marks } : { type: "text", text: t };
const heading = (level: number, t: string): TiptapNode => ({
  type: "heading",
  attrs: { level },
  content: [text(t)],
});

/** Parse the output the way a reader/renderer would. */
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html").body;

describe("tiptapToHtml — escaping", () => {
  it("escapes markup in text so it renders as text, not elements", () => {
    const html = tiptapToHtml(doc(p(text(`<script>alert("x")</script> & 'y' <img src=x onerror=alert(1)>`))));
    expect(html).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39; &lt;img src=x onerror=alert(1)&gt;</p>\n",
    );
    const body = parse(html);
    expect(body.querySelector("script")).toBeNull();
    expect(body.querySelector("img")).toBeNull();
    expect(body.textContent).toBe(`<script>alert("x")</script> & 'y' <img src=x onerror=alert(1)>\n`);
  });

  it("escapes text inside headings and marks", () => {
    const html = tiptapToHtml(
      doc({ type: "heading", attrs: { level: 2 }, content: [text("<b>", [{ type: "bold" }])] }),
    );
    expect(html).toBe("<h2><strong>&lt;b&gt;</strong></h2>\n");
  });

  it("cannot break out of a link's href attribute", () => {
    const evil = `https://x.test/" onmouseover="alert(1)" data-x='`;
    const html = tiptapToHtml(doc(p(text("click", [{ type: "link", attrs: { href: evil } }]))));
    const a = parse(html).querySelector("a")!;
    expect(a.getAttribute("href")).toBe(evil);
    expect(a.getAttributeNames()).toEqual(["href"]);
    expect(html).toContain("&quot; onmouseover=&quot;alert(1)&quot; data-x=&#39;");
  });

  it.each(["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<b>", "file:///etc/passwd"])(
    "drops the unsafe link href %s",
    (href) => {
      const html = tiptapToHtml(doc(p(text("x", [{ type: "link", attrs: { href } }]))));
      expect(html).toBe('<p><a href="">x</a></p>\n');
    },
  );

  it.each(["https://x.test/", "mailto:a@x.test", "#chapter-2", "notes.xhtml"])(
    "keeps the link href %s",
    (href) => {
      const html = tiptapToHtml(doc(p(text("x", [{ type: "link", attrs: { href } }]))));
      expect(parse(html).querySelector("a")!.getAttribute("href")).toBe(href);
    },
  );

  it("escapes ampersands in hrefs and renders a missing href as empty", () => {
    const html = tiptapToHtml(
      doc(
        p(
          text("q", [{ type: "link", attrs: { href: "https://x.test/?a=1&b=2" } }]),
          text("none", [{ type: "link" }]),
        ),
      ),
    );
    expect(html).toBe('<p><a href="https://x.test/?a=1&amp;b=2">q</a><a href="">none</a></p>\n');
  });

  it("does not let escaped '<h1 ' in text start a chapter section", () => {
    const html = tiptapToHtml(doc(p(text("<h1 class=x>fake</h1>"))));
    expect(html).not.toContain("<section");
  });
});

describe("tiptapToHtml — structure", () => {
  it("renders marks nested in array order", () => {
    const html = tiptapToHtml(
      doc(
        p(
          text("x", [
            { type: "bold" },
            { type: "italic" },
            { type: "strike" },
            { type: "code" },
            { type: "underline" },
            { type: "highlight" },
          ]),
        ),
      ),
    );
    expect(html).toBe("<p><u><code><s><em><strong>x</strong></em></s></code></u></p>\n");
  });

  it("renders block nodes semantically", () => {
    const html = tiptapToHtml(
      doc(
        { type: "blockquote", content: [p(text("q"))] },
        { type: "bulletList", content: [{ type: "listItem", content: [p(text("a"))] }] },
        { type: "orderedList", content: [{ type: "listItem", content: [p(text("b"))] }] },
        { type: "horizontalRule" },
        p(text("l1"), { type: "hardBreak" }, text("l2")),
        { type: "paragraph" },
      ),
    );
    expect(html).toBe(
      "<blockquote>\n<p>q</p>\n</blockquote>\n" +
        "<ul>\n<li><p>a</p>\n</li>\n</ul>\n" +
        "<ol>\n<li><p>b</p>\n</li>\n</ol>\n" +
        '<hr class="scene-break" />\n' +
        "<p>l1<br />l2</p>\n" +
        "<p>&nbsp;</p>\n",
    );
  });

  it("renders unknown node types by rendering their children", () => {
    const html = tiptapToHtml(doc({ type: "callout", content: [p(text("inside"))] }));
    expect(html).toBe("<p>inside</p>\n");
  });

  it("caps heading levels at h6 and only classes H1 as a chapter title", () => {
    const html = tiptapToHtml(doc(heading(2, "two"), heading(9, "deep")));
    expect(html).toBe("<h2>two</h2>\n<h6>deep</h6>\n");
  });

  it("returns an empty string for an empty doc", () => {
    expect(tiptapToHtml({ type: "doc" })).toBe("");
  });
});

describe("tiptapToHtml — chapters", () => {
  it("wraps each H1 and its content in a chapter section and marks the opener", () => {
    const html = tiptapToHtml(
      doc(
        p(text("front matter")),
        heading(1, "One"),
        p(text("first")),
        p(text("second")),
        heading(1, "Two"),
        heading(2, "Sub"),
        p(text("third")),
      ),
    );
    const body = parse(html);
    const sections = body.querySelectorAll("section.chapter");
    expect(sections).toHaveLength(2);

    // Front matter stays outside any section.
    expect(body.firstElementChild!.tagName).toBe("P");
    expect(body.firstElementChild!.textContent).toBe("front matter");

    const [one, two] = Array.from(sections);
    expect(one.querySelector("h1.chapter-title")!.textContent).toBe("One");
    const openers = one.querySelectorAll("p.chapter-opening");
    expect(openers).toHaveLength(1);
    expect(openers[0].textContent).toBe("first");
    expect(one.querySelectorAll("p")).toHaveLength(2);

    // An H2 directly after the H1 means no drop-cap opener.
    expect(two.querySelector("h2")!.textContent).toBe("Sub");
    expect(two.querySelector("p.chapter-opening")).toBeNull();
  });

  it("wraps a single-chapter document that starts with its H1", () => {
    const html = tiptapToHtml(doc(heading(1, "Only"), p(text("body"))));
    expect(html).toBe(
      '<section class="chapter">\n' +
        '<h1 class="chapter-title">Only</h1>\n<p class="chapter-opening">body</p>\n' +
        "</section>\n",
    );
  });

  it("does not wrap documents without H1s", () => {
    const html = tiptapToHtml(doc(heading(2, "x"), p(text("y"))));
    expect(html).toBe("<h2>x</h2>\n<p>y</p>\n");
  });
});
