# Contributing to ManuHaven

Thanks for taking an interest. This is a solo-maintained project, so the most useful
thing you can do before writing code is open an issue and check the direction — a small
PR that fits is worth more than a large one that has to be unwound.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

You need [Bun](https://bun.sh) and Docker. The app runs on the host; Postgres
and [Mailpit](https://mailpit.axllent.org) (a local inbox for magic links and
password resets) run in `compose.dev.yml`.

```bash
bun install

cp .env.example .env.local
# then set in .env.local:
#   DATABASE_URL=postgres://manuhaven:manuhaven@localhost:5432/manuhaven
#   BETTER_AUTH_SECRET=<openssl rand -hex 32>
#   SMTP_HOST=localhost
#   SMTP_PORT=1025

bun run db:up          # Postgres on :5432, Mailpit on :1025 / http://localhost:8025
bun run db:migrate
bun run db:seed        # optional: demo account with sample books (see below)
bun run dev
```

Open <http://localhost:3000>. Uploaded files go to `./.data/files`.

**Demo data.** `bun run db:seed` creates `demo@example.com` / `manuhaven-demo`
with three public-domain Austen novels, a finished editorial report, a story
bible, an assistant conversation and a year of royalties. It needs no AI key,
and re-running it replaces the demo account and touches nothing else. The same
account drives `./scripts/readme-screenshots.sh`, which retakes the images in
`docs/images/`.

**Exports.** Start the converter too:

```bash
bun run converter:up   # builds once, then serves on 127.0.0.1:3001
# and in .env.local: CONVERTER_URL=http://localhost:3001, CONVERTER_API_KEY=manuhaven-dev
```

**AI.** Set `AI_KEY_ENCRYPTION_SECRET` (`openssl rand -base64 32`), then open
**Settings → AI** in the app and paste in your own provider key.

### Scripts

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
bun run db:seed           # Demo account with sample data
bun run db:studio         # Browse the database (drizzle-kit studio)
bun run converter:up      # Dev EPUB/PDF converter

tests/integration/convert.sh   # DOCX -> EPUB -> epubcheck (needs Docker + a JRE)
```

**Use `bun` for everything.** Never `npm`, `npx`, or `yarn` — use `bunx` in place of
`npx`. Mixed lockfiles are the single most common broken PR. The converter in
`services/converter/` runs on Node but has its own `bun.lock` too, so a dependency
change there is `cd services/converter && bun add …`. CI uses the Bun version pinned
in the root `package.json` (`packageManager`).

## Before you open a PR

All of these must pass:

```bash
bun run lint
bunx tsc --noEmit
bun run test
bun run test:integration   # needs `bun run db:up` and DATABASE_URL
bun run build
```

If you add or change a function in `lib/db/queries/`, extend
`tests/integration/db/authz.test.ts` so it proves another user can't reach the data.
Schema changes go in `lib/db/schema.ts`, followed by `bun run db:generate`; commit the
generated migration and never edit one that has shipped.

## House rules

These are enforced in review, and they are the ones people trip on:

- **Server Components by default.** Add `"use client"` only for hooks, event handlers, or
  browser APIs, and push it down to the smallest island you can.
- **Next.js 16:** `params` is a Promise — `await params` in server components, `use(params)`
  in client components.
- **shadcn components use `@base-ui/react`**, not `@radix-ui`. Never import from radix.
- **Every API route authenticates** before doing anything else (`getSessionUser()`).
- **All database access goes through `lib/db/queries/`**, and every function there takes
  `userId` and scopes by it. There is no row-level security to catch a mistake.
- **Never log manuscript text.** Not `console.log`, not analytics, not error reports. The
  zero-retention promise in `docs/platform/compliance.md` is a real commitment to authors,
  not a slogan.
- **No dead code.** Delete it; git remembers.
- Read a file before you change it. Don't assume a helper exists.

The full ruleset lives in [`CLAUDE.md`](./CLAUDE.md) and [`AGENTS.md`](./AGENTS.md). Those
files are written as instructions for AI coding agents, and this repo is developed with
them — that's deliberate and we'd rather say so than pretend otherwise. They double as the
most precise statement of the conventions, so they're worth reading whether you're a
person or not.

## Internationalization

The UI ships in English and Mexican Spanish, and the two locale files must stay in lockstep.
If you add a key to `messages/en.json`, add it to `messages/es.json` in the same PR. CI
fails on a key mismatch. See `i18n/STYLE_GUIDE.md` for tone and terminology, and if you
aren't confident in your Spanish, say so in the PR — a rough translation flagged as rough
is welcome; a confident wrong one is not.

## Tests

Unit and integration tests run under vitest (`tests/`). New behavior wants a test; bug
fixes want a regression test that fails before your change. Don't chase a coverage number.

## Commits and PRs

Conventional commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. PR titles
follow the same format; releases and the changelog are generated from them.

Branch from `main` as `feat/…`, `fix/…`, `refactor/…`, or `test/…`.

## Sign your work (DCO)

There is no CLA. We use the [Developer Certificate of Origin](https://developercertificate.org/):
sign off each commit to certify you wrote the patch or otherwise have the right to submit
it under this project's license.

```bash
git commit -s -m "feat: add a thing"
```

That appends `Signed-off-by: Your Name <you@example.com>` to the message.

## Licensing of contributions

The project is [AGPL-3.0-only](./LICENSE). Contributions are accepted under that license.
New source files may carry an SPDX header:

```
// SPDX-License-Identifier: AGPL-3.0-only
```

There is no CLA and no commercial license: your contribution stays yours, under
the AGPL, and the project is AGPL for everyone.
