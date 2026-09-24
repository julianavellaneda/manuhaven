import {
  APICallError,
  stepCountIs,
  streamText,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";
import { AIAPIError, RateLimitError } from "@/lib/ai/errors";
import { resolveModelForUser } from "@/lib/ai/assistant/models";
import type { AssistantTooling } from "@/lib/ai/assistant/tools";
import type {
  AssistantStreamEvent,
  AssistantToolCallRecord,
} from "@/lib/ai/assistant/types";

/**
 * Thin wrapper over AI SDK streamText (spec: architecture.md §2): the SDK's
 * step loop executes tool calls provider-agnostically; this maps its stream
 * parts onto our SSE event union and returns usage totals on `done`.
 * Golden Rule #5: only this directory imports `ai` / `@ai-sdk/*`.
 */

export const ASSISTANT_MAX_STEPS = 6;
const DEFAULT_MAX_OUTPUT_TOKENS = 2_048;

export interface StreamAssistantChatOptions {
  /** Authenticated user id — selects their BYOK key and model. */
  userId: string;
  system: SystemModelMessage[];
  messages: ModelMessage[];
  tooling: AssistantTooling;
  abortSignal?: AbortSignal;
  maxOutputTokens?: number;
}

function mapStreamError(error: unknown): Error {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return new RateLimitError();
    return new AIAPIError(error.message, error.statusCode);
  }
  if (error instanceof Error) return new AIAPIError(error.message);
  return new AIAPIError("Assistant provider error");
}

export async function* streamAssistantChat(
  opts: StreamAssistantChatOptions
): AsyncGenerator<AssistantStreamEvent> {
  const { model, spec } = await resolveModelForUser(opts.userId, "chat");
  const started = Date.now();

  const result = streamText({
    model,
    system: opts.system,
    messages: opts.messages,
    tools: opts.tooling.tools,
    stopWhen: stepCountIs(ASSISTANT_MAX_STEPS),
    abortSignal: opts.abortSignal,
    maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    temperature: 0.7,
  });

  let text = "";
  const toolCalls: AssistantToolCallRecord[] = [];
  let usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  let aborted = false;

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta": {
        text += part.text;
        yield { type: "text_delta", text: part.text };
        break;
      }
      case "tool-call": {
        const input = (part.input ?? {}) as Record<string, unknown>;
        toolCalls.push({ id: part.toolCallId, name: part.toolName, input });
        yield {
          type: "tool_call",
          id: part.toolCallId,
          name: part.toolName,
          input,
        };
        break;
      }
      case "tool-result": {
        const meta = opts.tooling.summarizeToolResult(
          part.toolName,
          part.output
        );
        const record = toolCalls.find((c) => c.id === part.toolCallId);
        if (record) record.meta = meta;
        yield {
          type: "tool_result",
          id: part.toolCallId,
          name: part.toolName,
          meta,
        };
        break;
      }
      case "tool-error": {
        const meta = { error: true };
        const record = toolCalls.find((c) => c.id === part.toolCallId);
        if (record) record.meta = meta;
        yield {
          type: "tool_result",
          id: part.toolCallId,
          name: part.toolName,
          meta,
        };
        break;
      }
      case "finish": {
        usage = {
          inputTokens: part.totalUsage.inputTokens ?? 0,
          outputTokens: part.totalUsage.outputTokens ?? 0,
          cacheReadTokens:
            part.totalUsage.inputTokenDetails.cacheReadTokens ?? 0,
          cacheWriteTokens:
            part.totalUsage.inputTokenDetails.cacheWriteTokens ?? 0,
        };
        break;
      }
      case "abort": {
        aborted = true;
        break;
      }
      case "error": {
        throw mapStreamError(part.error);
      }
      default:
        break;
    }
  }

  if (aborted) return;

  const latencyMs = Date.now() - started;
  // Token counts and metadata only — never message or manuscript text.
  console.log("[ai] assistant chat", {
    model: spec,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    toolCalls: toolCalls.length,
    latencyMs,
  });

  yield { type: "done", text, toolCalls, usage, model: spec, latencyMs };
}
