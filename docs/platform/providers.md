# Provider Interfaces & Registries

External integrations go through typed interfaces rather than being called from
a page or component. This is a Golden Rule.

There are three of them: royalties, conversion, and AI.

---

## Royalties — `lib/providers/royalties/`

### Interface: `RoyaltySource` (`types.ts`)

```typescript
interface RoyaltySource {
  retailer: string;
  fetchRoyalties(dateRange: { start: Date; end: Date }): Promise<RoyaltyRecord[]>;
  parseReport(file: Buffer, fileName: string): Promise<RoyaltyRecord[]>;
  supportsAutoFetch(): boolean;
}
```

### Registry (`index.ts`)
- Pre-registers CSV sources for: amazon, apple, kobo, streetlib.
- `getRoyaltySource(retailer)` — lookup a registered source.

### Implementations

| Source | File | Status |
|---|---|---|
| CSVRoyaltySource | `csv-royalties.ts` | **Complete** — parses Amazon KDP, Apple Books, Kobo, and StreetLib CSV formats, with static-rate currency conversion. |

`fetchRoyalties` exists on the interface for a future API-backed source; no
current implementation auto-fetches (`supportsAutoFetch()` is false), so import
is a manual CSV upload.

---

## Conversion — `services/converter/`

A standalone Express service, not a `lib/providers/` module: it needs Pandoc
and WeasyPrint binaries, so it runs as its own container.

`app/api/convert/epub` and `app/api/convert/pdf` are the only callers, both
through `lib/export/run-export.ts`. They POST manuscript HTML, a `templateId`
and (for EPUB) the cover bytes; the service answers with the finished file,
which the app stores through `lib/storage/`. The converter holds no
credentials and fetches nothing.

See `services/converter/README.md` for the request contract and the template
CSS rules.

| Component | Status |
|---|---|
| Converter service | **Complete** — verified end to end: EPUB output passes epubcheck 5.1 (EPUB 3.3) with zero errors or warnings. |

---

## AI — `lib/ai/`

One provider layer, one key-resolution path. No route or component ever
constructs a vendor client.

Everything is built on the **Vercel AI SDK** (`ai` plus `@ai-sdk/anthropic`,
`@ai-sdk/openai`, `@ai-sdk/google`). The raw vendor SDKs are not dependencies.

### Model and key resolution — `lib/ai/assistant/models.ts`

`parseModelSpec` reads `"provider:modelId"` strings, so vendor and model swap
with a settings change or an env edit rather than a deploy.

`resolveModelForUser(userId, kind)` resolves in this order:

1. the API key the user saved in **Settings → AI** (encrypted at rest; see
   `lib/ai/key-crypto.ts`),
2. the server's env key for that provider (`ANTHROPIC_API_KEY` etc.), for a
   hosted deployment,
3. otherwise it throws `NoAIKeyConfiguredError`.

A saved key is only used for the provider it was saved for. A key that will not
decrypt — a rotated `AI_KEY_ENCRYPTION_SECRET`, a corrupt row — is treated as
absent rather than raising.

Routes map `NoAIKeyConfiguredError` to **409 `no_ai_key`**, which the UI turns
into a link to Settings. Streaming routes resolve the model *before* opening the
stream, so the common case is an ordinary JSON response.

### Surfaces

| Surface | File | Notes |
|---|---|---|
| One-shot generation | `lib/ai/generate.ts` | `generateForUser({userId, system, user, maxTokens?, timeoutMs?})`. Used by metadata, the editorial report (per-chapter map-reduce), and continuity. |
| Streaming chat + tools | `lib/ai/assistant/chat.ts` | Wraps `streamText`, multi-turn tool calling via `stopWhen: stepCountIs(...)`, mapped onto our SSE frames. |
| Tools, context, modes | `lib/ai/assistant/{tools,context-builder,modes}.ts` | Mode-gated `tool()` definitions; `read_chapter` and `query_codex`. |
| Errors | `lib/ai/errors.ts` | `AIAPIError`, `RateLimitError`, `InvalidResponseError`, `InputTooShortError`, `NoAIKeyConfiguredError`. Kept free of SDK imports so routes can import them cheaply. |

Embeddings are not implemented; there is no `ASSISTANT_EMBEDDINGS_MODEL`.

### Rate limiting

- A **10 messages / 60s** burst throttle on assistant chat, claimed in
  `ai_usage_events` *before* the model runs so concurrent bursts cannot race it.
  Applies to everyone: it protects the server.
- Per-manuscript cooldowns (24h for metadata and continuity, 7 days for the
  editorial report) apply **only when the server supplied the key**. A user on
  their own key is paying their own provider, so the cooldown is skipped.
- `AI_RATELIMIT_DISABLED=true` bypasses both. Development only.

### Privacy

Manuscript text is never logged, cached, or persisted outside the user's own
rows, and never used for training. `ai_usage_events` records token
counts, latency, and the model spec — never text.
