import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SearchAndReplace, type SearchStorage } from "@/lib/editor/extensions/search-and-replace";

let editor: Editor | null = null;

function makeEditor(content: string) {
  editor = new Editor({ extensions: [StarterKit, SearchAndReplace], content });
  return editor;
}

const storage = (e: Editor) =>
  (e.storage as unknown as Record<string, SearchStorage>).manuhavenSearch;

/** Text covered by each current match. */
const matchedText = (e: Editor) =>
  storage(e).results.map((r) => e.state.doc.textBetween(r.from, r.to));

/** Decorations the plugin renders, as [text, class] pairs. */
function decorations(e: Editor): [string, string][] {
  const plugin = e.state.plugins.find((pl) =>
    (pl as unknown as { key: string }).key.startsWith("manuhaven-search"),
  );
  // Decoration attrs are not public API; read them off the inline decoration type.
  const set = plugin!.getState(e.state) as {
    find: () => { from: number; to: number; type: { attrs: { class: string } } }[];
  };
  return set
    .find()
    .map((d) => [e.state.doc.textBetween(d.from, d.to), d.type.attrs.class] as [string, string]);
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("SearchAndReplace — searching", () => {
  it("finds case-insensitive matches across paragraphs by default", () => {
    const e = makeEditor("<p>The cat sat.</p><p>CAT and Cat.</p>");
    e.commands.setSearchTerm("cat");
    expect(matchedText(e)).toEqual(["cat", "CAT", "Cat"]);
    expect(storage(e).activeIndex).toBe(0);
  });

  it("respects case sensitivity and recomputes when it is toggled", () => {
    const e = makeEditor("<p>Cat cat CAT</p>");
    e.commands.setSearchTerm("cat");
    e.commands.setCaseSensitive(true);
    expect(matchedText(e)).toEqual(["cat"]);
    e.commands.setCaseSensitive(false);
    expect(matchedText(e)).toHaveLength(3);
  });

  it("treats regex metacharacters literally", () => {
    const e = makeEditor("<p>a.b axb (a+b) a.b</p>");
    e.commands.setSearchTerm("a.b");
    expect(matchedText(e)).toEqual(["a.b", "a.b"]);
    e.commands.setSearchTerm("(a+b)");
    expect(matchedText(e)).toEqual(["(a+b)"]);
  });

  it("finds matches inside marked text", () => {
    const e = makeEditor("<p>plain <strong>bold word</strong></p>");
    e.commands.setSearchTerm("word");
    expect(matchedText(e)).toEqual(["word"]);
  });

  it("finds nothing for an empty term or no occurrences", () => {
    const e = makeEditor("<p>hello</p>");
    e.commands.setSearchTerm("");
    expect(storage(e).results).toEqual([]);
    e.commands.setSearchTerm("zzz");
    expect(storage(e).results).toEqual([]);
    expect(decorations(e)).toEqual([]);
  });

  it("decorates matches, highlighting the active one", () => {
    const e = makeEditor("<p>one two one two</p>");
    e.commands.setSearchTerm("two");
    expect(decorations(e)).toEqual([
      ["two", "manuhaven-search-active"],
      ["two", "manuhaven-search-match"],
    ]);
  });

  it("clearSearch removes results and decorations", () => {
    const e = makeEditor("<p>one one</p>");
    e.commands.setSearchTerm("one");
    e.commands.clearSearch();
    expect(storage(e).searchTerm).toBe("");
    expect(storage(e).results).toEqual([]);
    expect(decorations(e)).toEqual([]);
  });

  it("recomputes matches when the document changes", () => {
    const e = makeEditor("<p>one</p>");
    e.commands.setSearchTerm("one");
    e.commands.insertContentAt(e.state.doc.content.size - 1, " one one");
    expect(matchedText(e)).toEqual(["one", "one", "one"]);
  });
});

describe("SearchAndReplace — navigation", () => {
  it("cycles forward and backward with wrap-around", () => {
    const e = makeEditor("<p>x x x</p>");
    e.commands.setSearchTerm("x");
    e.commands.gotoNext();
    expect(storage(e).activeIndex).toBe(1);
    e.commands.gotoNext();
    e.commands.gotoNext();
    expect(storage(e).activeIndex).toBe(0);
    e.commands.gotoPrevious();
    expect(storage(e).activeIndex).toBe(2);
    expect(decorations(e)[2][1]).toBe("manuhaven-search-active");
  });

  it("fails navigation when there are no matches", () => {
    const e = makeEditor("<p>x</p>");
    e.commands.setSearchTerm("y");
    expect(e.commands.gotoNext()).toBe(false);
    expect(e.commands.gotoPrevious()).toBe(false);
  });
});

describe("SearchAndReplace — replacing", () => {
  it("replaces only the active match and refreshes the results", () => {
    const e = makeEditor("<p>red red red</p>");
    e.commands.setSearchTerm("red");
    e.commands.setReplaceTerm("blue");
    e.commands.gotoNext();
    expect(e.commands.replace()).toBe(true);
    expect(e.getText()).toBe("red blue red");
    expect(matchedText(e)).toEqual(["red", "red"]);
  });

  it("clamps the active index when the last match is replaced", () => {
    const e = makeEditor("<p>a1 a1</p>");
    e.commands.setSearchTerm("a1");
    e.commands.setReplaceTerm("b");
    e.commands.gotoPrevious();
    e.commands.replace();
    expect(e.getText()).toBe("a1 b");
    expect(storage(e).activeIndex).toBe(0);
  });

  it("replace fails when there is no match", () => {
    const e = makeEditor("<p>abc</p>");
    e.commands.setSearchTerm("zzz");
    expect(e.commands.replace()).toBe(false);
    expect(e.getText()).toBe("abc");
  });

  it("replaceAll replaces every match, even when the replacement contains the term", () => {
    const e = makeEditor("<p>Cat cat</p><p>cAt</p>");
    e.commands.setSearchTerm("cat");
    e.commands.setReplaceTerm("cats and cat");
    expect(e.commands.replaceAll()).toBe(true);
    expect(e.getText({ blockSeparator: "|" })).toBe("cats and cat cats and cat|cats and cat");
  });

  it("replaceAll with an empty replacement deletes the matches", () => {
    const e = makeEditor("<p>um, well, um, yes</p>");
    e.commands.setSearchTerm("um, ");
    e.commands.setReplaceTerm("");
    e.commands.replaceAll();
    expect(e.getText()).toBe("well, yes");
  });

  it("replaceAll preserves the marks of the replaced text", () => {
    const e = makeEditor("<p><strong>old</strong> old</p>");
    e.commands.setSearchTerm("old");
    e.commands.setReplaceTerm("new");
    e.commands.replaceAll();
    expect(e.getHTML()).toBe("<p><strong>new</strong> new</p>");
  });

  it("replaceAll fails without matches", () => {
    const e = makeEditor("<p>abc</p>");
    expect(e.commands.replaceAll()).toBe(false);
  });

  it("replacement is a single undoable step", () => {
    const e = makeEditor("<p>a a a</p>");
    e.commands.setSearchTerm("a");
    e.commands.setReplaceTerm("b");
    e.commands.replaceAll();
    expect(e.getText()).toBe("b b b");
    e.commands.undo();
    expect(e.getText()).toBe("a a a");
  });
});
