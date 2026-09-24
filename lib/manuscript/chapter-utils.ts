/**
 * Chapter-based manuscript splitting and merging utilities.
 *
 * The editor loads one chapter at a time into ProseMirror to keep
 * performance smooth even for 100K+ word manuscripts.
 */

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

export interface Chapter {
  id: string;
  title: string;
  content: TiptapDoc;
  wordCount: number;
}

/**
 * Count words in an array of Tiptap nodes by walking text nodes.
 */
export function countWordsInNodes(nodes: TiptapNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      const trimmed = node.text.trim();
      if (trimmed.length > 0) {
        count += trimmed.split(/\s+/).length;
      }
    }
    if (node.content) {
      count += countWordsInNodes(node.content);
    }
  }
  return count;
}

/**
 * Extract a plain-text title from a heading node.
 */
function extractTitle(node: TiptapNode): string {
  if (!node.content) return "Untitled";
  const parts: string[] = [];
  for (const child of node.content) {
    if (child.text) parts.push(child.text);
    if (child.content) {
      parts.push(extractTitle(child));
    }
  }
  return parts.join("") || "Untitled";
}

/**
 * Split a full Tiptap document into chapters by H1 headings.
 *
 * - Content before the first H1 becomes "Front Matter".
 * - Each H1 starts a new chapter that includes all subsequent nodes
 *   until the next H1.
 */
export function splitIntoChapters(doc: TiptapDoc | null): Chapter[] {
  if (!doc || !doc.content || doc.content.length === 0) {
    return [
      {
        id: "chapter-0",
        title: "Chapter 1",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        wordCount: 0,
      },
    ];
  }

  const groups: { title: string; nodes: TiptapNode[] }[] = [];
  let currentGroup: { title: string; nodes: TiptapNode[] } | null = null;

  for (const node of doc.content) {
    const isH1 =
      node.type === "heading" &&
      (node.attrs?.level === 1 || node.attrs?.level === undefined);

    if (isH1) {
      // Start a new chapter
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        title: extractTitle(node),
        nodes: [node],
      };
    } else {
      if (!currentGroup) {
        // Content before any H1
        currentGroup = { title: "Front Matter", nodes: [] };
      }
      currentGroup.nodes.push(node);
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  if (groups.length === 0) {
    return [
      {
        id: "chapter-0",
        title: "Chapter 1",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        wordCount: 0,
      },
    ];
  }

  return groups.map((group, index) => ({
    id: `chapter-${index}`,
    title: group.title,
    content: {
      type: "doc" as const,
      content: group.nodes.length > 0 ? group.nodes : [{ type: "paragraph" }],
    },
    wordCount: countWordsInNodes(group.nodes),
  }));
}

/**
 * Merge an array of chapters back into a single Tiptap document.
 */
export function mergeChapters(chapters: Chapter[]): TiptapDoc {
  const allNodes: TiptapNode[] = [];
  for (const chapter of chapters) {
    if (chapter.content.content) {
      allNodes.push(...chapter.content.content);
    }
  }
  return {
    type: "doc",
    content: allNodes.length > 0 ? allNodes : [{ type: "paragraph" }],
  };
}

/**
 * Build the chapter summary array for the database `chapters` column.
 */
export function buildChapterSummary(
  chapters: Chapter[]
): { title: string; wordCount: number }[] {
  return chapters.map((ch) => ({
    title: ch.title,
    wordCount: ch.wordCount,
  }));
}
