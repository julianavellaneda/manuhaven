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

function parseInlineNodes(
  element: Node,
  marks: TiptapMark[] = []
): TiptapNode[] {
  const nodes: TiptapNode[] = [];

  for (const child of Array.from(element.childNodes)) {
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
      const childNodes = parseChildren(element);
      // If there are no block-level children, wrap inline content in a paragraph
      const hasBlock = childNodes.some((n) =>
        ["paragraph", "heading", "bulletList", "orderedList", "blockquote"].includes(
          n.type
        )
      );
      if (hasBlock) {
        nodes.push({ type: "listItem", content: childNodes });
      } else {
        const inline = parseInlineNodes(element);
        nodes.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: inline.length > 0 ? inline : undefined,
            },
          ],
        });
      }
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
