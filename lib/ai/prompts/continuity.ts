import type { ChapterChunk } from "@/lib/ai/chunk-by-chapter";

const SYSTEM_PROMPT = `You are a manuscript continuity editor. You build a precise "Story Bible" by reading a novel chapter-by-chapter and tracking every character, location, timeline beat, and physical detail. You catch contradictions: a character described as 6'2" in chapter 3 and 5'10" in chapter 12, a town said to be coastal in one scene and inland in another, an event that happens before and after the same reference point. You respond with valid JSON only — no preamble, no commentary, no markdown fences.`;

const STRICT_SCHEMA_NOTE = `\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a single JSON object matching this exact shape, with no extra text:
{
  "characters": [{"name": str, "aliases": [str], "description": str, "physicalTraits": [{"trait": str, "value": str, "firstMention": int}], "relationships": [{"character": str, "type": str, "since": int}], "firstAppearance": int, "lastAppearance": int}],
  "locations": [{"name": str, "description": str, "details": [{"detail": str, "firstMention": int}]}],
  "timeline": [{"event": str, "chapter": int, "relativeTime": str}],
  "inconsistencies": [{"type": "character"|"location"|"timeline"|"object", "description": str, "chapters": [int], "severity": "error"|"warning"}]
}`;

function formatChapter(c: ChapterChunk): string {
  return `=== Chapter ${c.index}: ${c.title} ===
${c.text}`;
}

export interface ContinuityPromptInput {
  chapters: ChapterChunk[];
  strict?: boolean;
}

export function buildContinuityPrompt({
  chapters,
  strict = false,
}: ContinuityPromptInput): { system: string; user: string } {
  const body = chapters.map(formatChapter).join("\n\n");
  const strictSuffix = strict ? STRICT_SCHEMA_NOTE : "";

  const user = `Read the following manuscript and produce a Story Bible. Use 1-indexed chapter numbers (the same numbers shown in the headers below) for every "firstMention", "firstAppearance", "lastAppearance", "since", and "chapter" / "chapters" field.

Output a single JSON object with these top-level keys:

1. "characters" — every named character. For each:
   - "name": canonical name
   - "aliases": other names/nicknames used in the text (empty array if none)
   - "description": 1–2 sentence summary of who they are
   - "physicalTraits": list of stable physical traits explicitly described (hair, eye color, height, scars, etc.). Each item: {"trait", "value", "firstMention" (chapter int)}
   - "relationships": connections to other named characters: {"character" (name), "type" (e.g. "sister", "rival", "mentor"), "since" (chapter int when established)}
   - "firstAppearance" / "lastAppearance": chapter integers

2. "locations" — every named place. For each:
   - "name", "description" (brief), "details" (list of fixed physical/geographic facts with firstMention chapter)

3. "timeline" — sequenced major events: {"event", "chapter", "relativeTime" (e.g. "morning", "three days later", "winter")}

4. "inconsistencies" — contradictions you detected in the text. For each:
   - "type": "character" | "location" | "timeline" | "object"
   - "description": what conflicts and how
   - "chapters": list of chapter integers where the conflict appears
   - "severity": "error" (factual contradiction) | "warning" (likely but not certain)

Only include entities that actually appear in the text. Empty arrays are fine. Return JSON only — no markdown, no commentary.${strictSuffix}

MANUSCRIPT:
${body}`;

  return { system: SYSTEM_PROMPT, user };
}
