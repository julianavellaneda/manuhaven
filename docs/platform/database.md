# Database Schema Reference

`lib/db/schema.ts` (Drizzle) is the single source of truth. The SQL in
`drizzle/` is generated from it with `bun run db:generate`; this page is a
readable overview, and when the two disagree, the schema file is right.

A fresh install applies two migrations: `0000_init.sql` creates every table,
and `0001_seed_templates.sql` seeds the genre templates. The app image applies
pending migrations on every start (`scripts/migrate.ts`, under a Postgres
advisory lock); in development, run `bun run db:migrate`.

**There is no row-level security.** Ownership is enforced in the application:
every function in `lib/db/queries/` takes `userId` and scopes by it, directly
or through `ownedProjectIds(userId)`, and nothing else in the app imports the
database client. `tests/integration/db/authz.test.ts` is the guarantee: for
every query function it checks that one user cannot read, change or delete
another user's rows.

Every user-owned row cascades from `user`, so deleting a user deletes
everything they own. Account deletion purges the user's files from storage
first, then deletes the row.

---

## Auth tables

`user`, `session`, `account`, `verification` and `rate_limit` belong to Better
Auth (`lib/auth/auth.ts`, Drizzle adapter). IDs are UUIDs
(`advanced.database.generateId: "uuid"`), so every domain foreign key is a
`uuid` column. Passwords live hashed in `account.password`; OAuth tokens in
`account` as well. `rate_limit` backs Better Auth's limiter with
`storage: "database"`, so limits survive a restart.

Change these only in step with Better Auth: its CLI (`bunx @better-auth/cli
generate`) shows the columns the installed version expects.

---

## Tables

### profiles
App-side user data, 1:1 with `user`. Created by a Better Auth
`databaseHooks.user.create.after` hook for every new account, whichever
sign-in method made it.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | → `user.id`, cascade |
| display_name, email, pen_name, genre_interest | text | |
| book_status | text | `not_started` \| `drafting` \| `revising` \| `complete` |
| theme_preference | text | `light` \| `dark` \| `system` (default `system`) |
| onboarding_completed_at | timestamptz | |
| created_at, updated_at | timestamptz | |

### projects
One row per book.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid | → `user.id`, cascade |
| title | text | required |
| subtitle, author_name, genre, description, isbn | text | |
| cover_key | text | storage key, never a URL; served via `/api/files/` |
| language | text | default `en` |
| status | text | `draft` \| `formatting` \| `review` \| `publishing` \| `live` \| `archived` |
| ai_metadata | jsonb | AI-generated keywords, BISAC codes, tagline, blurbs |

Indexed on `(user_id, status)`.

### manuscripts
Exactly one per project (`project_id` is unique). `tiptap_json` is the
manuscript body; the AI columns cache generated analysis so it survives a
reload, and the `last_ai_*` stamps drive per-manuscript cooldowns.

| Column | Type | Notes |
|---|---|---|
| project_id | uuid UNIQUE | → `projects.id`, cascade |
| file_key | text | storage key of the original upload |
| file_type | text | `docx` \| `txt` \| `paste` |
| tiptap_json, chapters | jsonb | |
| word_count | integer | |
| writing_stats | jsonb | `{sessions, dailyGoal}` |
| story_bible | jsonb | continuity output; backs the assistant's Codex |
| editorial_report, style_analysis | jsonb | |
| last_ai_metadata_at, last_ai_editorial_at, last_ai_continuity_at | timestamptz | cooldown stamps |
| last_saved_at | timestamptz | set by Drizzle on every update |
| uploaded_at | timestamptz | there is no `updated_at` |

### templates
Genre CSS templates for EPUB/PDF rendering. Global, seeded by
`0001_seed_templates.sql`, and read-only to the app. `genre` is load-bearing:
the convert routes lowercase it to name a stylesheet in
`services/converter/templates/`.

### exports
One row per render. `format` is `epub` \| `pdf` \| `mobi`; `status` is
`pending` \| `processing` \| `complete` \| `failed`. A render claims its row as
`processing` before calling the converter, which is also how the 20-per-hour
throttle counts; `file_key` and `file_size_bytes` are filled in when the file
is stored.

### royalties
Imported from retailer CSVs. Unique on
`(user_id, project_id, retailer, territory, period_start, period_end)` with
`NULLS NOT DISTINCT`, so re-importing the same statement updates rather than
double-counts, even with no territory.

| Column | Type | Notes |
|---|---|---|
| project_id, user_id | uuid | both cascade |
| retailer, territory, currency | text | |
| units_sold, units_returned | integer | |
| revenue, revenue_usd | numeric(12,2) | |
| period_start, period_end | date | |
| settlement_status | text | `pending` \| `invoiced` \| `paid` |
| expected_payout_date | date | |
| source_type | text | `api` \| `csv_upload` |

---

## AI tables

### user_ai_settings
Bring-your-own-key configuration, one row per user.

`api_key_cipher` holds an AES-256-GCM ciphertext produced by the application
(`lib/ai/key-crypto.ts`) using `AI_KEY_ENCRYPTION_SECRET` — the plaintext key
never reaches the database. The ciphertext is read only by the model resolver
(`lib/ai/assistant/models.ts`) and never returned to the browser.

`api_key_hint` is the redacted display value (`sk-ant-…4f2a`) shown in
Settings. `provider` is `anthropic` \| `openai` \| `google`; `autonomy` is
`off` \| `lite` \| `editorial` \| `collaborator`.

### assistant_conversations / assistant_messages
Chat threads and their turns. Messages cascade from conversations, which
cascade from both the project and the user. Message `content` is jsonb holding
message parts; manuscript text quoted inside a message stays in the author's
own rows — the same trust boundary as `manuscripts.tiptap_json`.

### ai_usage_events
Token counts and latency only — **never text**. Powers the per-minute throttle.

The row is claimed *before* the model runs, so concurrent bursts cannot race
the throttle; `model` and the token counts are therefore nullable/zero at
insert and filled in on completion (only the assistant fills them today). The
Settings → AI connection test has no project, so `project_id` is null for it.
`project_id` is `on delete set null` rather
than cascade so per-user accounting survives a project delete; account deletion
still removes the rows via the `user_id` cascade.

---

## Files

File bytes are not in the database. `lib/storage/` writes them to a local
volume or an S3-compatible bucket, under keys that start with the owner:

```
{userId}/{projectId}/manuscript/original.{docx|txt}
{userId}/{projectId}/cover.{jpg|png|webp}
{userId}/{projectId}/exports/{exportId}.{epub|pdf}
```

The database stores these keys (`manuscripts.file_key`, `projects.cover_key`,
`exports.file_key`). Browsers fetch them through `/api/files/[...key]`, which
checks that the first segment is the signed-in user and the second is a
project they own.
