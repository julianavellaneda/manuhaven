export type AssistantLocale = "en" | "es";

export type AutonomyMode = "off" | "lite" | "editorial" | "collaborator";

export interface AssistantToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface AssistantUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/**
 * Events produced by the assistant chat stream (lib/ai/assistant/chat.ts).
 * The chat route maps these 1:1 onto SSE frames of the same name; the
 * client consumes them through lib/ai/sse-client.ts.
 */
export type AssistantStreamEvent =
  | { type: "text_delta"; text: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      id: string;
      name: string;
      meta: Record<string, unknown>;
    }
  | {
      type: "done";
      text: string;
      toolCalls: AssistantToolCallRecord[];
      usage: AssistantUsage;
      model: string;
      latencyMs: number;
    };
