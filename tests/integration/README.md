# Integration tests

These exercise real external processes (the converter container, a real
Postgres) rather than mocks, so they are **not** part of `bun run test`. Run
them deliberately, and in CI on their own job.

## `convert.sh` — converter HTTP API → EPUB/PDF → epubcheck

Builds the converter image, runs it on `127.0.0.1:3901`, and drives its HTTP
API: auth and validation failures, an EPUB with a cover, a PDF, a check that
no manuscript text reached the container logs, and finally
[epubcheck](https://github.com/w3c/epubcheck) on the EPUB.

```bash
tests/integration/convert.sh
```

Requires Docker and a JRE (for epubcheck). The script downloads epubcheck into
a temp directory.

Last verified: EPUB 3.3, **0 fatals / 0 errors / 0 warnings**, with Pandoc
2.17.1.1 and WeasyPrint 57.2 from the service Dockerfile.

The app side of exports (`lib/export/run-export.ts`, the `/api/convert/*`
routes, the throttle) is covered by `storage/export-routes.test.ts` with the
converter stubbed.

## Database migrations

The CI `database` job applies `drizzle/` to an empty Postgres 18 twice (the
second run must be a no-op), and fails if `lib/db/schema.ts` has changed
without a generated migration. Locally:

```bash
bun run db:up        # Postgres 18 on 127.0.0.1:5432 (compose.dev.yml)
DATABASE_URL=postgres://manuhaven:manuhaven@localhost:5432/manuhaven bun run db:migrate
```

## `db/` — authorization matrix against real Postgres

Every function in `lib/db/queries/` is exercised as two users: user B must not
be able to read, change or delete anything user A owns. There is no RLS behind
the query layer, so this suite is what enforces ownership. It creates throwaway
users and deletes them (and, by cascade, everything they own) afterwards.

```bash
bun run db:up && bun run db:migrate
DATABASE_URL=postgres://manuhaven:manuhaven@localhost:5432/manuhaven bun run test:integration
```

The CI `database` job runs it after migrating.

## `storage/` — upload routes, `/api/files` and the storage drivers

`file-routes.test.ts` drives the cover and manuscript upload routes and
`/api/files` against real Postgres and the `fs` driver in a temp directory:
magic-byte checks, size limits, stale-file cleanup, and that nobody can read,
replace or probe another user's files. It runs with the rest of
`bun run test:integration`.

`s3.test.ts` checks the `s3` driver against a real S3-compatible server and is
skipped unless `S3_TEST_ENDPOINT` is set. CI runs it against RustFS. Locally:

```bash
docker run -d --rm --name manuhaven-s3-test -p 127.0.0.1:9900:9000 \
  -e RUSTFS_ACCESS_KEY=manuhaven -e RUSTFS_SECRET_KEY=manuhaven-secret \
  rustfs/rustfs:latest
S3_TEST_ENDPOINT=http://127.0.0.1:9900 bun run test:integration
docker stop manuhaven-s3-test
```
