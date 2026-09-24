type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
};

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule",
]);

export interface ChapterChunk {
  /** 1-indexed chapter number, suitable for display and for matching the AI's `chapter` references. */
  index: number;
  title: string;
  text: string;
  wordCount: number;
}

function nodeToText(node: TiptapNode, out: string[]): void {
  if (!node) return;
  if (node.type === "text" && typeof node.text === "string") {
    out.push(node.text);
    return;
  }
  if (node.type && BLOCK_TYPES.has(node.type) && node.type !== "heading") {
    for (const child of node.content ?? []) nodeToText(child, out);
    out.push("\n\n");
    return;
  }
  for (const child of node.content ?? []) nodeToText(child, out);
}

function headingTitle(node: TiptapNode): string {
  const parts: string[] = [];
  for (const child of node.content ?? []) nodeToText(child, parts);
  return parts.join("").replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

/**
 * Split a Tiptap document into per-chapter chunks. A "chapter" is the content
 * between consecutive H1 headings (or the entire document, if no H1 exists).
 * Each chunk is truncated to ~maxWordsPerChunk words to fit the model context.
 */
export function chunkByChapter(
  doc: unknown,
  maxWordsPerChunk = 2_500
): ChapterChunk[] {
  if (!doc || typeof doc !== "object") return [];
  const root = doc as TiptapNode;
  const top = root.content ?? [];

  const chunks: ChapterChunk[] = [];
  let currentTitle = "Untitled";
  let currentBuffer: string[] = [];
  let started = false;

  const flush = () => {
    const text = currentBuffer
      .join("")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!text && !started) return;
    const truncated = truncateWords(text, maxWordsPerChunk);
    chunks.push({
      index: chunks.length + 1,
      title: currentTitle,
      text: truncated,
      wordCount: wordCount(truncated),
    });
    currentBuffer = [];
  };

  for (const node of top) {
    if (
      node.type === "heading" &&
      (node.attrs?.level === 1 || node.attrs?.level === undefined)
    ) {
      if (started) flush();
      currentTitle = headingTitle(node) || `Chapter ${chunks.length + 1}`;
      started = true;
      continue;
    }
    if (!started) {
      // Pre-content before any H1 — treat as chapter 1 / front matter.
      started = true;
      currentTitle = "Untitled";
    }
    nodeToText(node, currentBuffer);
  }

  if (started) flush();
  return chunks.filter((c) => c.text.length > 0);
}
