# Self-hosting ManuHaven

Everything here assumes you want your manuscripts on infrastructure you
control. No cloud account of any kind is involved: the whole stack is three
containers you run yourself.

| Part | What it is | Required |
|---|---|---|
| **App** | The Next.js studio, including auth (Better Auth) | yes |
| **Database** | Postgres 18 | yes |
| **Converter** | Pandoc and WeasyPrint behind a small HTTP API | only for EPUB/PDF export |

Uploaded manuscripts, covers and rendered exports live in a `files` volume on
the app by default, or in any S3-compatible bucket (§4).

AI is not a part. It runs on an API key — yours, or each user's — and the
studio works normally without one.

---

## 1. Quick start

You need Docker with Compose v2, `openssl`, and about 1 GB of free RAM.

```bash
git clone https://github.com/julianavellaneda/manuhaven.git
cd manuhaven
./scripts/setup.sh        # writes .env with generated secrets
docker compose up -d      # builds on first run; add --build after a pull
```

Open <http://localhost:3000>, create an account, and upload a manuscript.

`setup.sh` copies `.env.example` to `.env` and fills in `POSTGRES_PASSWORD`,
`BETTER_AUTH_SECRET`, `AI_KEY_ENCRYPTION_SECRET` and `CONVERTER_API_KEY` with
random values. It refuses to touch an existing `.env`.

On start the app applies any pending database migrations (`drizzle/`), then
serves. Watch it come up:

```bash
docker compose ps                  # all three services should report healthy
curl localhost:3000/api/health
docker compose logs app | grep migrate
```

Only the app publishes a port. The database and the converter are reachable
only over the compose network.

---

## 2. Configure

`.env.example` is the canonical list, with a comment on every variable. The
ones you are most likely to change:

```bash
NEXT_PUBLIC_APP_URL=https://write.example.com   # your public origin; required in production
APP_PORT=3000                                   # host port the app is published on
AUTH_ALLOW_SIGNUP=false                         # after you have made your own account
```

`NEXT_PUBLIC_APP_URL` is read at runtime, not at build time, despite the
prefix. Auth uses it as its base URL and only trusts requests from that origin,
so it must match the address in your browser exactly, scheme included.

### Secrets

| Variable | Guards | If you lose or change it |
|---|---|---|
| `POSTGRES_PASSWORD` | The database | Postgres keeps the password it was initialised with; change it with `ALTER USER` first |
| `BETTER_AUTH_SECRET` | Session cookies and tokens | Everyone is signed out |
| `AI_KEY_ENCRYPTION_SECRET` | Users' saved AI provider keys | Saved keys stop decrypting. The app treats them as absent and users paste them again |
| `CONVERTER_API_KEY` | App ↔ converter | Nothing, as long as both sides get the new value |

Back `.env` up with your data (§6).

### Auth

Email and password work with no configuration. Everything else is optional,
and the login page only shows what is configured.

- **Email (magic links and password resets).** Set `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` for any SMTP relay. Without
  SMTP those flows are hidden. `AUTH_REQUIRE_EMAIL_VERIFICATION=true` makes new
  accounts confirm their address before signing in; it has no effect without
  SMTP.
- **Google.** Create an OAuth client, add
  `<NEXT_PUBLIC_APP_URL>/api/auth/callback/google` as an authorised redirect
  URI, and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Closing sign-up.** `AUTH_ALLOW_SIGNUP=false` stops new accounts from any
  method, Google and magic link included. Existing users still sign in.

Sign-in and reset attempts are rate limited in Postgres, so a restart does not
reset the counters.

---

## 3. Running it

### Prebuilt images

Every release publishes:

```
ghcr.io/julianavellaneda/manuhaven:latest
ghcr.io/julianavellaneda/manuhaven-converter:latest
```

`docker compose pull && docker compose up -d` uses them instead of building.
Nothing deployment-specific is compiled in: configuration is read at request
time, so one image runs anywhere.

### Behind a reverse proxy

Terminate TLS in front of the app and forward to `APP_PORT`. Two things
matter: pass the `Host` and scheme through, and allow long-lived responses —
the editorial report and the assistant stream over SSE, which dies under an
aggressive read timeout. Manuscript uploads can be up to 50 MB. For nginx:

```nginx
client_max_body_size 55m;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 300s;
proxy_buffering off;      # required for SSE
```

Then set `NEXT_PUBLIC_APP_URL` to the `https://` origin and restart the app.

### Without Docker

The app is a standard Next.js 16 server. Run `bun install && bun run build`,
then `bun run db:migrate` and `bun run start`, with the same environment and a
`DATABASE_URL` pointing at your Postgres (CI tests against 18). Set `STORAGE_DIR` to a
persistent directory. The converter still has to run as a container, because
it needs Pandoc and WeasyPrint as system binaries; set `CONVERTER_URL` to its
address.

---

## 4. Storage

Files are stored under keys like `{userId}/{projectId}/cover.jpg`. The
database holds only the keys. Browsers download through `/api/files/…`, which
checks that the signed-in user owns the project, so no file is ever public.

**Filesystem (default).** `STORAGE_DRIVER=fs` writes under `STORAGE_DIR`,
which is the `files` volume at `/data/files` in Compose.

**S3-compatible.** For a bucket on AWS, Cloudflare R2, Garage, RustFS or
similar:

```bash
STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.example.com     # omit for AWS
S3_REGION=us-east-1
S3_BUCKET=manuhaven
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_FORCE_PATH_STYLE=true               # false for AWS virtual-hosted buckets
```

The bucket should be private; the app is the only client. Switching drivers
does not move existing files, so pick one before you upload.

---

## 5. The converter

The export service is a separate container because it needs binaries the app
does not. `services/converter/README.md` documents its API.

It is stateless and holds no credentials beyond `CONVERTER_API_KEY`: the app
sends it the manuscript HTML and cover bytes, gets the finished file back, and
stores it itself. It still does CPU-heavy work on request, so keep it off the
internet. In Compose it publishes no port and is reachable only from the app,
as `http://converter:3001`.

If exports fail, check in this order:

1. `docker compose ps converter` — is it healthy?
   `docker compose exec converter curl -s localhost:3001/health` reports
   whether Pandoc and WeasyPrint are installed.
2. Is `CONVERTER_API_KEY` the same on both sides? A mismatch is a 401. An
   unset key on the converter is a 500 by design, since it refuses to run open.
3. Is the per-user limit (20 exports an hour) the cause? That is a 429 with
   "Too many exports".

---

## 6. Backups

Everything that matters is the database, the files, and `.env`.

```bash
# Database
docker compose exec -T db pg_dump -U manuhaven -Fc manuhaven > manuhaven-$(date +%F).dump

# Files (STORAGE_DRIVER=fs): uploaded originals, covers and rendered exports
docker run --rm -v manuhaven_files:/data:ro -v "$PWD":/backup alpine \
  tar czf /backup/manuhaven-files-$(date +%F).tar.gz -C /data .
```

With S3 storage, use the bucket's own versioning or replication instead.

Manuscript *text* lives in the database, not in the files volume, so a database
dump alone recovers the writing. Keep `.env` with the dump: without
`AI_KEY_ENCRYPTION_SECRET`, the saved provider keys in it are dead weight.

To restore into a fresh install:

```bash
docker compose up -d db
docker compose exec -T db pg_restore -U manuhaven -d manuhaven --clean --if-exists < manuhaven-2026-09-24.dump
docker run --rm -v manuhaven_files:/data -v "$PWD":/backup alpine \
  tar xzf /backup/manuhaven-files-2026-09-24.tar.gz -C /data
docker compose up -d
```

---

## 7. Upgrading

```bash
git pull                   # or: docker compose pull
docker compose up -d --build
```

The app applies new migrations on start; an advisory lock keeps two replicas
from racing. Take a backup first. Read `CHANGELOG.md` before a minor version
bump: anything needing manual steps is called out under a **Breaking** heading.

---

## 8. AI (optional)

Nothing is required. With no key configured, the AI surfaces show an empty
state pointing at Settings, and the rest of the studio is unaffected.

Two ways to supply a key:

- **Per user (recommended).** `setup.sh` already set
  `AI_KEY_ENCRYPTION_SECRET`, so each user can paste their own key into
  **Settings → AI**. You pay nothing and nobody shares a quota.
- **Server-wide.** Set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or
  `GOOGLE_GENERATIVE_AI_API_KEY`. Everyone without a key of their own falls
  back to it, and you pay for all of it.

See `docs/ai.md` for how resolution works and what the cooldowns do.

---

## Troubleshooting

**`docker compose up` fails with "set POSTGRES_PASSWORD in .env".** There is
no `.env`, or it lacks the secrets. Run `./scripts/setup.sh`.

**Sign-in fails with an invalid origin or 403.** `NEXT_PUBLIC_APP_URL` does not
match the address in your browser. It must be the exact origin, including
`https://` and any port.

**The app restarts in a loop after changing `POSTGRES_PASSWORD`.** The database
volume was initialised with the old password. Put it back, or change it inside
Postgres first (`ALTER USER manuhaven PASSWORD '…'`).

**The "Forgot password" and magic-link options are missing.** SMTP is not
configured. See §2.

**Google sign-in fails with `redirect_uri_mismatch`.** The redirect URI in the
Google console must be `<NEXT_PUBLIC_APP_URL>/api/auth/callback/google`.

**Uploads fail with 413.** A proxy in front is capping the body size. See §3.

**The editorial report stops halfway.** A proxy is closing the SSE stream. See
the timeout and buffering settings in §3.

**AI returns 409 `no_ai_key`.** Working as intended: no key for the selected
provider, from either the user's settings or the server environment.
