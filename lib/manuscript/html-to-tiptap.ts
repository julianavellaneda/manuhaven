/**
 * Converts HTML (typically from mammoth .docx conversion) to Tiptap-compatible JSON.
 * Runs client-side only (uses DOMParser).
 */

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "ul",
  "ol",
  "hr",
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "nav",
]);

function parseInlineNodes(
  element: Node,
  marks: TiptapMark[] = []
): TiptapNode[] {
  return parseInlineList(Array.from(element.childNodes), marks);
}

function parseInlineList(
  children: Node[],
  marks: TiptapMark[] = []
): TiptapNode[] {
  const nodes: TiptapNode[] = [];

  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.length > 0) {
        const node: TiptapNode = { type: "text", text };
        if (marks.length > 0) {
          node.marks = [...marks];
        }
        nodes.push(node);
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      const markMap: Record<string, string> = {
        strong: "bold",
        b: "bold",
        em: "italic",
        i: "italic",
        u: "underline",
        s: "strike",
        strike: "strike",
      };

      if (tag === "br") {
        nodes.push({ type: "hardBreak" });
      } else if (markMap[tag]) {
        const newMarks = [...marks, { type: markMap[tag] }];
        nodes.push(...parseInlineNodes(el, newMarks));
      } else if (tag === "a") {
        const href = el.getAttribute("href");
        const newMarks = [
          ...marks,
          { type: "link", attrs: { href, target: "_blank" } },
        ];
        nodes.push(...parseInlineNodes(el, newMarks));
      } else {
        // Unknown inline element — recurse and preserve marks
        nodes.push(...parseInlineNodes(el, marks));
      }
    }
  }

  return nodes;
}

function parseBlockElement(element: HTMLElement): TiptapNode[] {
  const tag = element.tagName.toLowerCase();
  const nodes: TiptapNode[] = [];

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = parseInt(tag[1], 10);
      const content = parseInlineNodes(element);
      nodes.push({
        type: "heading",
        attrs: { level },
        content: content.length > 0 ? content : undefined,
      });
      break;
    }

    case "p": {
      const content = parseInlineNodes(element);
      nodes.push({
        type: "paragraph",
        content: content.length > 0 ? content : undefined,
      });
      break;
    }

    case "blockquote": {
      const childNodes = parseChildren(element);
      nodes.push({
        type: "blockquote",
        content:
          childNodes.length > 0
            ? childNodes
            : [{ type: "paragraph" }],
      });
      break;
    }

    case "ul": {
      const items = parseListItems(element);
      if (items.length > 0) {
        nodes.push({ type: "bulletList", content: items });
      }
      break;
    }

    case "ol": {
      const items = parseListItems(element);
      if (items.length > 0) {
        nodes.push({ type: "orderedList", content: items });
      }
      break;
    }

    case "li": {
      // Block children stay blocks; each run of inline content between them
      // becomes one paragraph, keeping its marks.
      const content: TiptapNode[] = [];
      let run: Node[] = [];
      const flush = () => {
        const inline = parseInlineList(run);
        if (inline.some((n) => n.type !== "text" || n.text?.trim())) {
          content.push({ type: "paragraph", content: inline });
        }
        run = [];
      };
      for (const child of Array.from(element.childNodes)) {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          BLOCK_TAGS.has((child as HTMLElement).tagName.toLowerCase())
        ) {
          flush();
          content.push(...parseBlockElement(child as HTMLElement));
        } else {
          run.push(child);
        }
      }
      flush();
      nodes.push({
        type: "listItem",
        content: content.length > 0 ? content : [{ type: "paragraph" }],
      });
      break;
    }

    case "hr": {
      nodes.push({ type: "horizontalRule" });
      break;
    }

    case "br": {
      nodes.push({ type: "paragraph" });
      break;
    }

    case "div":
    case "section":
    case "article":
    case "main":
    case "header":
    case "footer":
    case "nav": {
      // Container elements — recurse into children
      nodes.push(...parseChildren(element));
      break;
    }

    default: {
      // Unknown block element — try to parse as paragraph with inline content
      const content = parseInlineNodes(element);
      if (content.length > 0) {
        nodes.push({ type: "paragraph", content });
      }
      break;
    }
  }

  return nodes;
}

function parseListItems(element: HTMLElement): TiptapNode[] {
  const items: TiptapNode[] = [];
  for (const child of Array.from(element.children)) {
    if (child.tagName.toLowerCase() === "li") {
      items.push(...parseBlockElement(child as HTMLElement));
    }
  }
  return items;
}

function parseChildren(element: HTMLElement): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      nodes.push(...parseBlockElement(child as HTMLElement));
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").trim();
      if (text.length > 0) {
        nodes.push({
          type: "paragraph",
          content: [{ type: "text", text }],
        });
      }
    }
  }
  return nodes;
}

export function htmlToTiptap(html: string): TiptapNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const content = parseChildren(doc.body);

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}
