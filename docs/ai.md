# AI in ManuHaven

The AI here reads what you wrote and tells you things about it. It does not
write your novel. That is a product decision rather than a technical limit, and
it shapes everything below.

**It is also optional.** With no key configured, the AI surfaces show an empty
state and every other part of the studio behaves normally. Nothing is degraded,
nothing nags.

## What it does

| Feature | Where | Model |
|---|---|---|
| **Metadata** | Preview | utility |
| **Editorial report** | Editorial (streams over SSE) | chat |
| **Style analysis** | Editorial | chat |
| **Continuity / Codex** | Editor → Codex tab | chat |
| **Assistant** | Editor, side panel | chat |

Two model roles: a **chat** model for anything that reasons over the manuscript,
and a cheaper **utility** model for short structured extraction like keywords
and BISAC codes.

## Bring your own key

Key resolution, in `lib/ai/assistant/models.ts`:

```
the user's saved key  →  the server's env key  →  NoAIKeyConfiguredError
```

A user's key only applies to the provider it was saved for; switching provider
in Settings without pasting a matching key falls through to the server key, or
to the error. Routes turn that error into **409 `no_ai_key`**, which the UI
renders as a link to Settings → AI. Streaming routes resolve the model *before*
opening the stream, so a missing key is a clean status code rather than an
error inside a half-open SSE connection.

Supported providers: **Anthropic**, **OpenAI**, **Google**. Models are
identified by a `"provider:modelId"` spec, so changing vendor or model is a
settings edit, never a deploy:

| Setting | Default |
|---|---|
| `ASSISTANT_CHAT_MODEL` | `anthropic:claude-sonnet-4-6` |
| `ASSISTANT_UTILITY_MODEL` | `anthropic:claude-haiku-4-5` |

A user who picks a provider but no explicit model gets that provider's
defaults (`openai:gpt-5.1`, `google:gemini-2.5-pro`, and their smaller
siblings for utility work) rather than the server's, which may point at a
different vendor entirely.

### How the key is stored

Keys are encrypted with `AI_KEY_ENCRYPTION_SECRET` before they are written to
`user_ai_settings`, and the ciphertext column is withheld from the client roles
at the grant level — the browser cannot read it back even with a valid session.
After saving, the UI shows "key set" and offers to replace it; the value is
never returned.

Rotating the secret makes existing keys undecryptable. That is handled as
"absent" rather than as an error, so users are simply asked for a key again.
Never log the ciphertext or the plaintext.

## One provider layer

All AI goes through a single path, and this is enforced in review:

- `lib/ai/assistant/models.ts` resolves the model and key.
- `lib/ai/generate.ts` (one-shot) and `lib/ai/assistant/chat.ts` (streaming)
  are the only callers of the AI SDK.

Nothing else constructs a provider client. There is exactly one place to add a
provider, one place BYOK is applied, and one place usage is recorded.

## The assistant

The assistant is grounded in the actual manuscript rather than in a summary.
It has two tools:

- `read_chapter` — fetch a chapter by number or title, so the model quotes what
  you wrote instead of recalling it.
- `query_codex` — look up a character, place, or object in the Codex.

Tool availability is gated by autonomy mode, enforced server-side inside each
tool's `execute`. The client's claimed mode is never trusted. Today all modes
may use both tools; the distinction becomes meaningful when editing tools
arrive (see `ROADMAP.md` v0.4).

## Budgets and cooldowns

Per-manuscript cooldowns — 24 hours for metadata and continuity, 7 days for the
full editorial report — exist to cap inference spend when *the server* is
paying. When a user brings their own key they are paying their provider
directly, and making them wait a week to re-run a report on their own book
would be hostile, so the cooldowns do not apply to them. The cooldown is
stamped under a row lock *before* generating (`claimAiCooldown`), so parallel
requests can't all pass the check, and released again if generation fails.

A burst throttle (`lib/ai/throttle.ts`: 10 model calls per user per minute)
applies to every AI route, including Settings → AI "Test connection", whoever's
key pays, because it protects the server rather than the bill.

On the server's key, a user can only run the operator's configured models and
each provider's defaults. Any other saved model falls back to the server's, so
a saved setting can't bill an arbitrary model to the server.

`AI_RATELIMIT_DISABLED=true` lifts the cooldowns and the throttle in
development. Never set it in production.

Every call claims a row in `ai_usage_events` before the model runs; the
assistant also fills in the resolved model spec, token counts and latency,
which is what makes cost comparable across vendors. It records no manuscript
text.

## Privacy

Manuscript text sent to a provider is processed and discarded:

- **Never logged.** Not `console.log`, not analytics, not error reports. The
  assistant's own conversation history is stored, because you asked for a
  conversation; the manuscript context assembled for a request is not.
- **Never used for training** by this project, under any circumstances.
- **Not retained by us**, because there is no "us" — with your own key, the
  data relationship for that text is between you and your provider, under
  their terms. Read them. Provider policies differ, and a self-hosted install
  cannot promise anything about someone else's servers.

Self-hosted installs send no telemetry.

## Costs

You are billed by your provider, per token. A full editorial report on an
80,000-word novel sends the manuscript in chapter-sized chunks and costs on the
order of a few dollars at current Sonnet-class pricing. The assistant is far
cheaper: it reads a chapter at a time, on demand, rather than the whole book.

If you want to know exactly, `ai_usage_events` has the token counts.
