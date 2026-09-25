# ManuHaven

[![CI](https://github.com/julianavellaneda/manuhaven/actions/workflows/ci.yml/badge.svg)](https://github.com/julianavellaneda/manuhaven/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/julianavellaneda/manuhaven?include_prereleases&sort=semver)](https://github.com/julianavellaneda/manuhaven/releases)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

**An open-source writing studio for novelists.** Write in the browser, get AI
editorial help that runs on *your* API key, export retail-ready EPUB and PDF,
and track your royalties. Self-host the whole thing.

> Status: pre-1.0, and honest about it. The studio works end to end; packaging,
> a hosted demo, and the docs site are in progress. See `ROADMAP.md`.

## What it does

| | |
|---|---|
| **Write** | Tiptap editor with chapter navigation, drag-and-drop reordering, split/merge, find and replace, writing stats, distraction-free mode, autosave with version history. Imports `.docx` and `.txt`. |
| **Analyze** | Editorial report, style analysis, continuity checking, and a chat assistant grounded in your actual chapters. Runs on an API key you supply — Anthropic, OpenAI, or Google. |
| **Format & export** | Five genre CSS templates rendered to EPUB 3 and print-ready PDF by a Pandoc + WeasyPrint service. Output validates clean against epubcheck 5.1. |
| **Track** | Royalty CSV import for KDP, Apple, Kobo, and StreetLib, with per-title revenue charts. |
| **Bilingual** | Complete English and Mexican Spanish interface, including the editorial AI prompts. |

**AI is entirely optional and off by default.** With no key configured the AI
surfaces stay inert and everything else works normally.

## Quick start (Docker)

You need Docker and `openssl`. No cloud account of any kind: the database,
auth, file storage and the export service all run in containers on your
machine.

```bash
git clone https://github.com/julianavellaneda/manuhaven.git
cd manuhaven
./scripts/setup.sh        # writes .env with generated secrets
docker compose up -d      # app on :3000; Postgres and the converter stay internal
```

Open <http://localhost:3000>, create an account, and upload a manuscript. The
app applies database migrations on start.
[`docs/self-hosting.md`](docs/self-hosting.md) covers sign-in options, S3
storage, reverse proxies, backups, and upgrades.

## Quick start (development)

You need [Bun](https://bun.sh) and Docker. The app runs on the host; Postgres
and [Mailpit](https://mailpit.axllent.org) (a local inbox for magic links and
password resets) run in `compose.dev.yml`.

```bash
git clone https://github.com/julianavellaneda/manuhaven.git
cd manuhaven
bun install

cp .env.example .env.local
# then set in .env.local:
#   DATABASE_URL=postgres://manuhaven:manuhaven@localhost:5432/manuhaven
#   BETTER_AUTH_SECRET=<openssl rand -hex 32>
#   SMTP_HOST=localhost
#   SMTP_PORT=1025

bun run db:up          # Postgres on :5432, Mailpit on :1025 / http://localhost:8025
bun run db:migrate
bun run dev
```

Open <http://localhost:3000>. Sign up, create a project, and upload a
manuscript. Uploaded files go to `./.data/files`.

To enable exports, start the converter too:

```bash
bun run converter:up   # builds once, then serves on 127.0.0.1:3001
# and in .env.local: CONVERTER_URL=http://localhost:3001, CONVERTER_API_KEY=manuhaven-dev
```

To enable AI, set `AI_KEY_ENCRYPTION_SECRET` (`openssl rand -base64 32`), then
open **Settings → AI** in the app and paste in your own provider key. Keys are
encrypted before they are stored.

## Scripts

```bash
bun run dev               # Development server
bun run build             # Production build
bun run start             # Run the production build
bun run lint              # ESLint
bun run test              # Vitest unit tests
bun run test:integration  # Against real Postgres (DATABASE_URL; `bun run db:up` first)

bun run db:up             # Dev Postgres + Mailpit (compose.dev.yml)
bun run db:generate       # Write a migration from lib/db/schema.ts changes
bun run db:migrate        # Apply pending migrations
bun run db:studio         # Browse the database (drizzle-kit studio)
bun run converter:up      # Dev EPUB/PDF converter

tests/integration/convert.sh   # DOCX -> EPUB -> epubcheck (needs Docker + a JRE)
```

## Environment

`.env.example` is the canonical list, with a comment on every variable.
`scripts/setup.sh` fills in the four secrets for Docker.

| Variable | Required | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | Docker | Password for the bundled Postgres |
| `DATABASE_URL` | outside Docker | Compose builds it from `POSTGRES_PASSWORD` |
| `BETTER_AUTH_SECRET` | yes | Signs sessions and auth tokens |
| `NEXT_PUBLIC_APP_URL` | in production | Your public origin: auth base URL and canonical URLs. Read at runtime |
| `AUTH_ALLOW_SIGNUP` · `AUTH_REQUIRE_EMAIL_VERIFICATION` | no | Close sign-up; require a confirmed address |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASSWORD` · `SMTP_FROM` | for email | Magic links and password resets |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | no | Google sign-in |
| `STORAGE_DRIVER` · `STORAGE_DIR` | no | `fs` (default) or `s3`; `S3_*` configure the bucket |
| `AI_KEY_ENCRYPTION_SECRET` | for BYOK | Encrypts user API keys at rest |
| `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `GOOGLE_GENERATIVE_AI_API_KEY` | no | Server-side fallback when a user has no key of their own |
| `ASSISTANT_CHAT_MODEL` · `ASSISTANT_UTILITY_MODEL` | no | `"provider:modelId"` overrides |
| `CONVERTER_URL` · `CONVERTER_API_KEY` | for exports | The EPUB/PDF service |
| `NEXT_PUBLIC_POSTHOG_KEY` | no | Optional analytics; no-ops when unset |

## Architecture

| Layer | Technology |
|---|---|
| App | Next.js 16 App Router, React 19, Tailwind 4, shadcn on Base UI |
| Database | Postgres 18 via Drizzle ORM; every query scoped by user in `lib/db/queries/` |
| Auth | Better Auth — email/password, magic link, Google |
| Files | Local volume or any S3-compatible bucket, served only through an authz-checked route |
| Editor | Tiptap 3 |
| AI | Vercel AI SDK 6 — Anthropic, OpenAI, or Google, keyed per user |
| Export | Pandoc + WeasyPrint in a container (`services/converter`) |
| i18n | next-intl, `en` and `es-MX` at exact key parity |

```mermaid
flowchart LR
  browser["Browser<br/>(editor, dashboard)"]
  subgraph app["Next.js app"]
    routes["Pages, API routes,<br/>server actions"]
    queries["lib/db/queries<br/>(every call takes userId)"]
    storage["lib/storage<br/>(fs or S3)"]
    ai["lib/ai<br/>(one provider layer)"]
  end
  pg[("Postgres 18")]
  files[("Volume or<br/>S3 bucket")]
  conv["Converter<br/>Pandoc + WeasyPrint<br/>(no credentials, no port)"]
  llm["Anthropic / OpenAI / Google<br/>(user's own key)"]

  browser -- "session cookie" --> routes
  routes --> queries --> pg
  routes --> storage --> files
  routes -- "HTML + cover bytes" --> conv
  conv -- "EPUB / PDF bytes" --> routes
  routes --> ai --> llm
```

| Doc | |
|---|---|
| [`docs/self-hosting.md`](docs/self-hosting.md) | Running your own instance |
| [`docs/architecture.md`](docs/architecture.md) | How the pieces fit together |
| [`docs/ai.md`](docs/ai.md) | Providers, BYOK, budgets, privacy |
| [`docs/i18n.md`](docs/i18n.md) | Translations, and adding a locale |
| [`ROADMAP.md`](ROADMAP.md) | What is planned, and what never will be |

`docs/platform/` holds the deeper reference material — schema, design system,
EPUB specification.

## Engineering highlights

- **One command, no cloud.** `docker compose up` runs Postgres, the app and the
  converter. Only the app publishes a port.
- **A typed data layer with an authz test matrix.** Pages and routes never touch
  the database directly. Every function in `lib/db/queries/` takes a `userId`,
  and `tests/integration/db/authz.test.ts` runs each one against real Postgres
  as a second user to prove it can't read or change the first user's rows.
- **Files are never public.** The database stores storage keys, not URLs, and
  every download goes through `/api/files/[...key]`, which checks ownership.
  Uploads are checked by magic bytes and size on the server.
- **Bring-your-own-key AI through one layer.** Model and key resolution live in
  one module. User keys are encrypted at rest with AES-256-GCM and never sent
  back to the browser. AI routes share a per-user throttle and atomic cooldowns,
  and manuscript text is never logged.
- **A converter with no credentials.** It gets HTML and cover bytes and returns
  a file. It has no database or storage access and no published port. CI
  validates its EPUB output with epubcheck.
- **One image for any deployment.** Public config is read at runtime and
  injected into the page, so nothing deployment-specific is baked in at build
  time. Pages ship a per-request nonce-based Content-Security-Policy.
- **Bilingual by test.** A unit test fails the build if `en` and `es-MX` drift
  out of key parity.

## How it compares

| | ManuHaven | Calibre / Sigil | novelWriter / Manuskript | Atticus | Sudowrite |
|---|---|---|---|---|---|
| Open source | AGPL-3.0 | GPL | GPLv3 | no | no |
| Self-hostable | yes | desktop only | desktop only | no | no |
| Write in a browser | yes | no | no | yes | yes |
| AI that reads your book | yes, your key | no | no | no | yes, their key |
| Generates prose for you | **no, by design** | no | no | no | yes |
| EPUB + print PDF export | yes | yes | limited | yes | no |
| Royalty tracking | yes | no | no | no | no |
| Bilingual interface | EN + es-MX | varies | varies | EN | EN |
| Price | free | free | free | $147 once | from $19/mo |

The honest summary: Calibre and Sigil are better at converting and editing
existing ebooks, and novelWriter is a lovely desktop novel manager. Nothing in
that list does the whole loop — write, analyze, format, export, track — in one
place that you can run yourself.

## AI and privacy

Manuscript text sent to a model provider is processed and discarded. This
application never logs, caches, or persists it, and never uses it for training.
Because you supply your own key, your data relationship for that text is
directly with your provider, under their terms — read them.

Self-hosted installs send no telemetry of any kind.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). In short: `bun` only (never npm or yarn), conventional
commits, and any user-facing string must be added to **both** `messages/en.json`
and `messages/es.json`.

`CLAUDE.md` and `AGENTS.md` are the working rules for AI coding agents on this
repository, and they are kept accurate.

## License

[AGPL-3.0-only](LICENSE). You can run, study, modify, and share it; if you
modify it and offer it to others over a network, you must offer them your
modified source too.
