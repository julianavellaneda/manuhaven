<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Package Manager
Always use `bun` for all package management and script commands in this project.
Never use `npm`, `npx`, or `yarn`. Use `bunx` instead of `npx`.


# CLAUDE.md — ManuHaven

> Coding rules for AI agents. Violations of these rules are bugs.

An open-source, self-hostable writing studio for novelists: a browser manuscript editor, AI editorial help that runs on the user's own API key, EPUB/PDF export, and royalty tracking. AGPL-3.0.

**For architecture see `docs/architecture.md`; for schema, design system, and
domain rules see `docs/platform/`.**
**For self-hosting, AI, and i18n see `docs/self-hosting.md`, `docs/ai.md`, `docs/i18n.md`.**
**For what is planned (and what is not) see `ROADMAP.md`.**

---

## Golden Rules

These rules are **immutable**. Every code change must comply. No exceptions.

### 1. Never speculate about code you haven't read
- Always read the relevant file(s) before modifying them.
- Never assume a function exists, a type is shaped a certain way, or an import path is correct.
- If you're unsure, read it first.

### 2. Server Components by default
- Every component is a React Server Component unless it needs interactivity.
- Only add `"use client"` when the component uses hooks, event handlers, or browser APIs.
- Never put `"use client"` at the top of a page/layout unless absolutely necessary.
- Prefer passing server-fetched data as props to small client islands.

### 3. All database access goes through `lib/db/queries/`
- Pages, routes and server actions call query functions; no `getDb()` or
  `drizzle-orm` import anywhere else.
- Every function that touches user data takes `userId` and scopes by it,
  directly or through `ownedProjectIds(userId)`. There is no RLS behind it:
  `tests/integration/db/authz.test.ts` is the guarantee, so extend it with
  every new query function.
- The browser never talks to the database. Client components mutate through
  API routes or server actions.

### 4. Every API route validates auth
- Always call `getSessionUser()` (`lib/auth/session.ts`) at the top of every
  route handler and server action. Pages use `requireUser()`.
- Return 401 immediately if no valid session.
- **There are no anonymous write endpoints.** The only unauthenticated routes
  are `/api/health` and Better Auth's `/api/auth/*`. The old public-write exceptions (waitlist, pricing survey)
  were deleted with the marketing funnel; do not add new ones without a very
  good reason and an entry here.

### 5. Provider pattern for external integrations
- Royalty ingestion goes through `lib/providers/royalties/`.
- File storage goes through `lib/storage/` (`getStorage()`: local `fs` volume
  by default, or any S3-compatible bucket). The database stores storage keys,
  never URLs, and browsers read files only through the authz-checked
  `/api/files/[...key]` route (`fileUrl(key)`).
- EPUB/PDF conversion goes through the converter service in
  `services/converter/`, called only from `app/api/convert/*` (via
  `lib/export/run-export.ts`). The converter gets bytes and returns bytes; it
  never holds a database or storage credential. Never call it from a
  page or component.
- All AI goes through **one** layer: `lib/ai/assistant/models.ts` resolves the
  model and key (user's key first, then the server env key), and
  `lib/ai/generate.ts` / `lib/ai/assistant/chat.ts` are the only callers of the
  AI SDK. Never construct a provider client anywhere else.

### 6. Error boundaries on every page
- Every route has an `error.tsx` boundary.
- Every async operation has try/catch with user-facing error messages.
- Never show a white screen. Never show a raw stack trace.

### 7. No dead code
- Delete unused imports, variables, functions, and files immediately.
- Never comment out code "for later." Use version control.

### 8. Configuration is read at runtime, never inlined
- **Never write `process.env.NEXT_PUBLIC_*` directly.** Next.js substitutes
  those with their build-time value in the server bundle as well as the client
  one, which would tie a published image to whoever built it.
- Use `serverPublicEnv()` / `publicEnv()` / `runtimeEnv()` from
  `lib/public-env.ts`. Server-only secrets (`BETTER_AUTH_SECRET`,
  `DATABASE_URL`, provider keys) are not inlined and may be read from
  `process.env` normally.
- Only values that are public by design may be added to `PublicEnv` — it is
  serialized into the HTML of every page.

### 9. AI Privacy — Zero Retention
- Manuscripts sent to AI APIs must be processed ephemerally — no logging, no caching, discarded after response.
- **Never** `console.log`, `logger.info`, or otherwise persist manuscript text.
- Platform may NOT use manuscript content for AI training under any circumstances.

---

## Next.js 16 Gotchas

- `params` in page/layout props is a **Promise** — must `await params` in server components, `use(params)` in client components.
- Read `node_modules/next/dist/docs/` before using any Next.js API. Breaking changes exist from training data.
- shadcn components use `@base-ui/react` (NOT `@radix-ui`). Never import from radix.
- Middleware is exported from `proxy.ts` as `proxy` function (not `middleware` from `middleware.ts`).

---

## Coding Patterns

### Data Fetching (Server Components)
```typescript
import { requireUser } from "@/lib/auth/session";
import { listDashboardProjects } from "@/lib/db/queries/projects";

export default async function Page() {
  const user = await requireUser(); // redirects to /login
  const projects = await listDashboardProjects(user.id);
  return <ClientComponent projects={projects} />;
}
```

### API Route Pattern
```typescript
import { getSessionUser } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Validate body with zod, then call lib/db/queries/* with user.id
}
```

### AI Usage (always through the one provider layer)
```typescript
// One-shot generation (editorial, metadata, continuity):
import { generateForUser } from "@/lib/ai/generate";
const res = await generateForUser({ userId, system, user, maxTokens: 2048 });

// Resolving a model directly: user's key -> server env key -> NoAIKeyConfiguredError
import { resolveModelForUser } from "@/lib/ai/assistant/models";
const { model, spec, keySource } = await resolveModelForUser(userId, "chat");
```
Routes map `NoAIKeyConfiguredError` to **409 `no_ai_key`**, which the UI turns
into a link to Settings → AI. Streaming routes resolve the model *before*
opening the stream.

### Client Islands
```typescript
async function Page({ params }) {
  const { id } = await params; // Next.js 16: params is a Promise
  const data = await getData(id);
  return <InteractiveWidget data={data} />;  // only the widget is "use client"
}
```

### Validation
- Use `zod` for all input validation — API routes and client forms.
- Validate on both client (UX) and server (security).

### shadcn/UI
- Import from `@/components/ui/` — never install component libraries directly.
- Components use `@base-ui/react` internally (NOT `@radix-ui`).
- Use `cn()` from `lib/utils.ts` for conditional classNames.

---

## Naming Conventions

### Files & Folders
- **Components**: PascalCase — `ProjectCard.tsx`, `RevenueChart.tsx`
- **Utilities/libs**: kebab-case — `docx-parser.ts`, `chapter-detector.ts`
- **API routes**: kebab-case folders — `app/api/convert/epub/route.ts`
- **Types**: PascalCase, co-located in `types.ts` — `BookMetadata`, `RoyaltyRecord`
- **Migrations**: generated by `bun run db:generate` into `drizzle/` (`0000_init.sql`, …); never edit a shipped one

### Code
- **Variables/functions**: camelCase — `fetchRoyalties()`, `parseManuscript()`
- **Types/interfaces**: PascalCase — `DistributionProvider`, `ExportStatus`
- **Constants**: UPPER_SNAKE_CASE — `MAX_MANUSCRIPT_SIZE_BYTES`
- **Enum-like values**: lowercase strings — `status: "draft" | "formatting" | "live"`
- **Database columns**: snake_case — `user_id`, `created_at`
- **Environment variables**: UPPER_SNAKE_CASE — `STORAGE_DRIVER`

---

## Environment Variables

`.env.example` is the canonical list — keep the two in sync. `scripts/setup.sh`
copies it to `.env` and generates the four secrets for Docker. Only the database
and `BETTER_AUTH_SECRET` are required; with nothing else set you get a working
studio (email/password sign-in, files on disk) and the AI features stay inert
until a key is configured.

```bash
# Database (required)
POSTGRES_PASSWORD=                  # docker-compose.yml builds DATABASE_URL from it
DATABASE_URL=                       # Outside Docker, e.g. postgres://manuhaven:manuhaven@localhost:5432/manuhaven

# App
NEXT_PUBLIC_APP_URL=                # Required in production: auth base URL + canonical URLs. Read at runtime
APP_PORT=                           # Host port for docker-compose.yml (default 3000)

# Auth (Better Auth)
BETTER_AUTH_SECRET=                 # Required. openssl rand -hex 32
AUTH_ALLOW_SIGNUP=                  # "false" closes sign-up for every method
AUTH_REQUIRE_EMAIL_VERIFICATION=    # "true" needs SMTP
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (magic links, password resets). Dev: Mailpit on localhost:1025
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# Storage (lib/storage)
STORAGE_DRIVER=                     # fs (default) | s3
STORAGE_DIR=                        # fs root; default ./.data/files, /data/files in the image
S3_ENDPOINT=                        # Omit for AWS
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=                # Default true

# AI
AI_KEY_ENCRYPTION_SECRET=           # Encrypts user API keys at rest (openssl rand -base64 32)
ANTHROPIC_API_KEY=                  # Optional server fallback when a user has no key
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
ASSISTANT_CHAT_MODEL=               # Optional "provider:modelId" (default anthropic:claude-sonnet-4-6)
ASSISTANT_UTILITY_MODEL=            # Optional (default anthropic:claude-haiku-4-5)
AI_RATELIMIT_DISABLED=              # Dev only. NEVER set in production.

# Converter (services/converter)
CONVERTER_URL=                      # Default http://localhost:3001
CONVERTER_API_KEY=                  # Shared secret; the service rejects all requests until set

# PostHog (optional analytics; no-ops when unset)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

**NEVER commit `.env` or `.env.local`. NEVER log secret keys or user API keys.
NEVER read a server secret from a client component.**

## Scripts

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Run production server
bun run lint         # Run ESLint
bun run test         # Run vitest unit tests (jsdom environment)
bun run test:integration  # Real Postgres (+ S3 when S3_TEST_ENDPOINT is set)
bun run db:up        # Dev Postgres + Mailpit (compose.dev.yml)
bun run db:generate  # Migration from lib/db/schema.ts changes
bun run db:migrate   # Apply pending migrations
bun run converter:up # Dev converter on 127.0.0.1:3001
```

---

## Security Checklist

- [ ] The converter holds no credentials beyond `CONVERTER_API_KEY` and publishes no port
- [ ] All API routes and server actions check `getSessionUser()` before processing
- [ ] File uploads validated: type + size (50MB manuscripts, 10MB covers)
- [ ] No user-uploaded content served without Content-Disposition headers
- [ ] Rate limiting on conversion and AI endpoints
- [ ] AI manuscript text never logged or persisted
- [ ] User API keys encrypted at rest, never logged, never returned to the client

---

## Git Workflow

- `main` — production, always deployable
- Feature branches: `feat/...`, `fix/...`, `refactor/...`, `test/...`
- Commit messages: conventional commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

---

## When in Doubt

1. Read the code before changing it.
2. Use the provider pattern for anything external.
3. Server Components by default, client islands for interactivity.
4. `await params` in server components (Next.js 16).
5. `bun`, never npm/yarn.
6. AI text is ephemeral — never log manuscript content.
7. Ask, don't assume.
