/**
 * Converts plain text to Tiptap-compatible JSON.
 * Chapter headings are detected by pattern matching.
 */

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
}

const CHAPTER_PATTERNS = [
  // "Chapter 1", "Chapter One", "Chapter I"
  /^chapter\s+[\divxlc]+$/i,
  /^chapter\s+\w+$/i,
  // "Part I", "Part 1", "Part One"
  /^part\s+[\divxlc]+$/i,
  /^part\s+\w+$/i,
  // "Prologue", "Epilogue", "Preface", "Introduction"
  /^(prologue|epilogue|preface|introduction|foreword|afterword)$/i,
  // ALL-CAPS short lines (likely titles, max 60 chars)
  /^[A-Z][A-Z\s\d:!?'",.\-]{0,59}$/,
];

function isChapterHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;

  return CHAPTER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function txtToTiptap(text: string): TiptapNode {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split by double newlines into blocks
  const blocks = normalized.split(/\n\n+/);
  const content: TiptapNode[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length === 0) continue;

    if (isChapterHeading(trimmed)) {
      content.push({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: trimmed }],
      });
    } else {
      // Split single newlines within a block into separate paragraphs
      const lines = trimmed.split("\n");
      for (const line of lines) {
        const lineTrimmed = line.trim();
        if (lineTrimmed.length > 0) {
          content.push({
            type: "paragraph",
            content: [{ type: "text", text: lineTrimmed }],
          });
        }
      }
    }
  }

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}
