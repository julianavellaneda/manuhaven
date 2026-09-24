import type { AutonomyMode } from "@/lib/ai/assistant/types";

export type AssistantToolName = "read_chapter" | "query_codex";

/**
 * Single source of truth for which tools each autonomy mode may use.
 * Enforced server-side inside each tool's execute — never trust the
 * client's mode claim. The chat route currently hardcodes `editorial`.
 */
const TOOL_MODES: Record<AssistantToolName, readonly AutonomyMode[]> = {
  read_chapter: ["lite", "editorial", "collaborator"],
  query_codex: ["lite", "editorial", "collaborator"],
};

export function isToolAllowed(
  tool: AssistantToolName,
  mode: AutonomyMode
): boolean {
  return TOOL_MODES[tool].includes(mode);
}
