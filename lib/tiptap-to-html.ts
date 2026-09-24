/**
 * Converts Tiptap (ProseMirror) JSON to semantic HTML.
 *
 * The output is designed for EPUB/PDF templates: chapter sections,
 * scene breaks, drop-cap-ready openers, and clean semantic markup.
 */

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** HTML-escape user text to prevent XSS */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarks(
  text: string,
  marks?: { type: string; attrs?: Record<string, unknown> }[]
): string {
  const escaped = esc(text);
  if (!marks || marks.length === 0) return escaped;

  return marks.reduce<string>((acc, mark) => {
    switch (mark.type) {
      case "bold":
        return `<strong>${acc}</strong>`;
      case "italic":
        return `<em>${acc}</em>`;
      case "strike":
        return `<s>${acc}</s>`;
      case "code":
        return `<code>${acc}</code>`;
      case "underline":
        return `<u>${acc}</u>`;
      case "link": {
        const href = esc(String(mark.attrs?.href ?? ""));
        return `<a href="${href}">${acc}</a>`;
      }
      default:
        return acc;
    }
  }, escaped);
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case "doc":
      return renderChildren(node);

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const tag = `h${Math.min(level, 6)}`;
      const cls = level === 1 ? ' class="chapter-title"' : "";
      return `<${tag}${cls}>${renderChildren(node)}</${tag}>\n`;
    }

    case "paragraph":
      return `<p>${renderChildren(node) || "&nbsp;"}</p>\n`;

    case "blockquote":
      return `<blockquote>\n${renderChildren(node)}</blockquote>\n`;

    case "bulletList":
      return `<ul>\n${renderChildren(node)}</ul>\n`;

    case "orderedList":
      return `<ol>\n${renderChildren(node)}</ol>\n`;

    case "listItem":
      return `<li>${renderChildren(node)}</li>\n`;

    case "horizontalRule":
      return `<hr class="scene-break" />\n`;

    case "hardBreak":
      return "<br />";

    case "text":
      return renderMarks(node.text ?? "", node.marks);

    default:
      return renderChildren(node);
  }
}

function renderChildren(node: TiptapNode): string {
  if (!node.content) return "";
  return node.content.map(renderNode).join("");
}

/**
 * Wrap content between H1 chapter-title headings in <section class="chapter">.
 * Also marks the first <p> after an H1 with class="chapter-opening" for
 * drop-cap styling.
 */
function wrapChapters(html: string): string {
  // Split on H1 tags (keep them in the result)
  const parts = html.split(/(?=<h1\s)/);

  if (parts.length <= 1) {
    // No H1 headings — return as-is
    return html;
  }

  const sections: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("<h1")) {
      // Mark the first <p> after the H1 as chapter-opening
      const processed = trimmed.replace(
        /(<\/h1>\s*\n?\s*)(<p>)/,
        '$1<p class="chapter-opening">'
      );
      sections.push(`<section class="chapter">\n${processed}\n</section>\n`);
    } else {
      // Content before the first H1 — leave unwrapped
      sections.push(trimmed);
    }
  }

  return sections.join("\n");
}

/**
 * Convert Tiptap JSON document to semantic HTML string.
 *
 * @param doc - The root Tiptap JSON document node (type: "doc")
 * @returns Clean semantic HTML suitable for EPUB/PDF template styling
 */
export function tiptapToHtml(doc: TiptapNode): string {
  const rawHtml = renderNode(doc);
  return wrapChapters(rawHtml);
}

export type { TiptapNode };
