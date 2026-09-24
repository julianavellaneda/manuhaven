/**
 * Chapter-ops — pure transforms that mutate the `chapters` array.
 * Editor-aware wiring (setContent, focus) lives in lib/editor/use-chapter-ops.ts.
 */

import {
  countWordsInNodes,
  type Chapter,
  type TiptapDoc,
  type TiptapNode,
} from "@/lib/manuscript/chapter-utils";

/**
 * Return the next "Chapter N" title as `Chapter <max + 1>`, where `max` is
 * the highest numeric suffix found across ALL existing chapter titles matching
 * `/^Chapter\s+(\d+)$/i`. This avoids duplicate titles when inserting or
 * splitting chapters in the middle of a list (e.g. inserting after "Chapter 1"
 * in [Chapter 1, Chapter 2, Chapter 3] now correctly yields "Chapter 4").
 * `_afterIndex` is kept in the signature for call-site compatibility.
 */
export function nextChapterTitle(
  chapters: Chapter[],
  _afterIndex: number
): string {
  let max = 0;
  for (const ch of chapters) {
    const m = ch.title.match(/^Chapter\s+(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `Chapter ${max + 1}`;
}

function blankChapter(title = "New Chapter"): Chapter {
  return {
    id: `chapter-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: title }],
        },
        { type: "paragraph" },
      ],
    },
    wordCount: 0,
  };
}

export function renameChapter(
  chapters: Chapter[],
  index: number,
  newTitle: string
): Chapter[] {
  if (index < 0 || index >= chapters.length) return chapters;
  const trimmed = newTitle.trim() || "Untitled";
  return chapters.map((ch, i) => {
    if (i !== index) return ch;
    // Also update the first H1 node if present; otherwise prepend one.
    const nodes = [...(ch.content.content ?? [])];
    const first = nodes[0];
    if (
      first &&
      first.type === "heading" &&
      (first.attrs?.level === 1 || first.attrs?.level === undefined)
    ) {
      nodes[0] = {
        ...first,
        content: [{ type: "text", text: trimmed }],
      };
    } else {
      nodes.unshift({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: trimmed }],
      });
    }
    return {
      ...ch,
      title: trimmed,
      content: { type: "doc", content: nodes },
    };
  });
}

export function reorderChapters(
  chapters: Chapter[],
  fromIndex: number,
  toIndex: number
): Chapter[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= chapters.length ||
    toIndex >= chapters.length
  ) {
    return chapters;
  }
  const next = [...chapters];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function deleteChapter(chapters: Chapter[], index: number): Chapter[] {
  if (chapters.length <= 1) {
    return [blankChapter("Chapter 1")];
  }
  return chapters.filter((_, i) => i !== index);
}

/**
 * Merge chapter at `index` with the next one. The next chapter's H1 is
 * dropped so the merged chapter keeps a single title.
 */
export function mergeWithNext(
  chapters: Chapter[],
  index: number
): Chapter[] {
  if (index < 0 || index >= chapters.length - 1) return chapters;
  const a = chapters[index];
  const b = chapters[index + 1];
  const bNodes = [...(b.content.content ?? [])];
  if (
    bNodes[0] &&
    bNodes[0].type === "heading" &&
    (bNodes[0].attrs?.level === 1 || bNodes[0].attrs?.level === undefined)
  ) {
    bNodes.shift();
  }
  const mergedNodes: TiptapNode[] = [
    ...(a.content.content ?? []),
    ...bNodes,
  ];
  const mergedDoc: TiptapDoc = { type: "doc", content: mergedNodes };
  const merged: Chapter = {
    ...a,
    content: mergedDoc,
    wordCount: countWordsInNodes(mergedNodes),
  };
  const next = [...chapters];
  next.splice(index, 2, merged);
  return next;
}

interface SplitResult {
  chapters: Chapter[];
  newActiveIndex: number;
  newChapter: Chapter;
  updatedActive: Chapter;
}

/**
 * Split chapter at `index` using a top-level-node index boundary.
 * `splitAtNodeIndex` = the zero-based index of the first node that goes
 * into the NEW chapter. Caller resolves the cursor position to a node
 * boundary (typically via editor.chain().splitBlock().run() first, then
 * mapping selection.$from.pos to a top-level index).
 */
export function splitChapterAt(
  chapters: Chapter[],
  index: number,
  splitAtNodeIndex: number,
  fallbackNewTitle?: string
): SplitResult | null {
  const active = chapters[index];
  if (!active) return null;
  const nodes = active.content.content ?? [];
  const safeIndex = Math.max(
    0,
    Math.min(splitAtNodeIndex, nodes.length)
  );
  const beforeNodes = nodes.slice(0, safeIndex);
  let afterNodes = nodes.slice(safeIndex);

  if (afterNodes.length === 0) {
    afterNodes = [{ type: "paragraph" }];
  }

  const firstAfter = afterNodes[0];
  const afterHasH1 =
    firstAfter &&
    firstAfter.type === "heading" &&
    (firstAfter.attrs?.level === 1 ||
      firstAfter.attrs?.level === undefined);

  let newTitle = fallbackNewTitle ?? "New Chapter";
  if (!afterHasH1) {
    afterNodes = [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: newTitle }],
      },
      ...afterNodes,
    ];
  } else {
    const inner = firstAfter.content
      ?.map((n) => n.text ?? "")
      .join("")
      .trim();
    if (inner) newTitle = inner;
  }

  const updatedActive: Chapter = {
    ...active,
    content: {
      type: "doc",
      content: beforeNodes.length > 0 ? beforeNodes : [{ type: "paragraph" }],
    },
    wordCount: countWordsInNodes(beforeNodes),
  };

  const newChapter: Chapter = {
    id: `chapter-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: newTitle,
    content: { type: "doc", content: afterNodes },
    wordCount: countWordsInNodes(afterNodes),
  };

  const next = [...chapters];
  next.splice(index, 1, updatedActive, newChapter);

  return {
    chapters: next,
    newActiveIndex: index + 1,
    newChapter,
    updatedActive,
  };
}

export { blankChapter };
