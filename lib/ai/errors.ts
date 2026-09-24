/**
 * Shared AI error types.
 *
 * These live apart from any provider module so that route handlers and
 * validation helpers can import them without pulling in a model SDK.
 */

export class AIAPIError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AIAPIError";
  }
}

export class RateLimitError extends AIAPIError {
  constructor(message = "AI provider rate limit exceeded") {
    super(message, 429);
    this.name = "RateLimitError";
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

/**
 * Thrown when input fails a precondition before the AI is ever called
 * (e.g. manuscript too short). Distinct from InvalidResponseError so route
 * handlers can map it to 4xx instead of 5xx.
 */
export class InputTooShortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputTooShortError";
  }
}

/**
 * Thrown when neither the user nor the server has supplied an API key for the
 * requested provider. This is the normal state of a fresh self-hosted install,
 * not a failure: routes map it to 409 `no_ai_key` and the UI turns that into a
 * link to Settings → AI. It is deliberately not 402 — nothing is for sale.
 */
export class NoAIKeyConfiguredError extends Error {
  readonly code = "no_ai_key" as const;
  constructor(
    /** The provider that had no key, e.g. "anthropic". */
    public provider: string
  ) {
    super(`No API key configured for ${provider}`);
    this.name = "NoAIKeyConfiguredError";
  }
}
