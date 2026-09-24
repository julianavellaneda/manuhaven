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

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

function truncateToTokenBudget(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  const maxWords = Math.floor(maxTokens / 1.3);
  const words = text.trim().split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

function walk(node: TiptapNode, out: string[]): void {
  if (!node) return;

  if (node.type === "text" && typeof node.text === "string") {
    out.push(node.text);
    return;
  }

  if (node.type === "heading") {
    const level = Number(node.attrs?.level ?? 1) || 1;
    out.push("\n\n" + "#".repeat(Math.min(level, 6)) + " ");
    for (const child of node.content ?? []) walk(child, out);
    out.push("\n\n");
    return;
  }

  if (node.type && BLOCK_TYPES.has(node.type)) {
    out.push("\n\n");
    for (const child of node.content ?? []) walk(child, out);
    out.push("\n\n");
    return;
  }

  for (const child of node.content ?? []) walk(child, out);
}

export function tiptapToPlainText(
  doc: unknown,
  maxTokens = 15_000
): string {
  if (!doc || typeof doc !== "object") return "";
  const parts: string[] = [];
  walk(doc as TiptapNode, parts);
  const text = parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return truncateToTokenBudget(text, maxTokens);
}
