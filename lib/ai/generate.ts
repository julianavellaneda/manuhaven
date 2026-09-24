import { APICallError, generateText } from "ai";
import { AIAPIError, RateLimitError } from "@/lib/ai/errors";
import { resolveModelForUser } from "@/lib/ai/assistant/models";

/**
 * One-shot text generation for the editorial features (metadata, editorial
 * report, continuity). Runs through the same model registry and BYOK key
 * resolution as the assistant, so there is exactly one provider layer.
 */

export const DEFAULT_TIMEOUT_MS = 120_000;

export interface GenerateOptions {
  /** Authenticated user id — selects their BYOK key and model. */
  userId: string;
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** The resolved "provider:modelId" spec. */
  model: string;
  latencyMs: number;
}

function mapError(error: unknown): Error {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return new RateLimitError();
    return new AIAPIError(error.message, error.statusCode);
  }
  if (error instanceof AIAPIError) return error;
  return new AIAPIError(
    error instanceof Error ? error.message : "Unknown AI error"
  );
}

export async function generateForUser(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const { model, spec } = await resolveModelForUser(opts.userId, "chat");
  const started = Date.now();

  // The SDK retries 429/5xx internally, replacing the hand-rolled backoff the
  // raw provider clients used to carry.
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const result = await generateText({
      model,
      system: opts.system,
      prompt: opts.user,
      maxOutputTokens: opts.maxTokens ?? 4096,
      abortSignal: controller.signal,
      maxRetries: opts.maxRetries ?? 2,
    });

    return {
      text: result.text,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      model: spec,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    throw mapError(err);
  } finally {
    // Never log prompt or completion text: it is manuscript content.
    clearTimeout(timeout);
  }
}
