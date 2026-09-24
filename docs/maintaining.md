# Maintaining this repository

Notes for whoever holds the commit bit. Everything here is either a one-time
setup step or a thing that is easy to forget.

## One-time setup

```bash
gh auth login
scripts/gh-bootstrap.sh julianavellaneda/manuhaven
```

That creates the labels from `.github/labels.yml`, enables Discussions, and
opens the starter issues. It is idempotent.

Then, by hand in the repository settings:

- **Actions → General → "Allow GitHub Actions to create and approve pull
  requests"**: on. Without it release-please cannot open its release PR and the
  Release workflow fails.
- **GHCR package access**: `ghcr.io/julianavellaneda/manuhaven` and
  `manuhaven-converter` must be linked to this repository, or grant it **Write**
  under each package's "Manage Actions access". A package left over from another
  repository makes "Publish images" fail with `permission_denied`; deleting it
  lets the next run recreate it. Make both packages public after the first
  release so `docker compose pull` works without logging in.
- **Branch protection on `main`**: require the `Lint, types, tests, build`
  check, require a pull request, allow squash merges only.
- **Description and topics**: `self-hosted`, `nextjs`, `postgres`, `epub`,
  `writing`, `ai`, `authors`, `i18n`.
- **Social preview image** (1280×640).
- **Discussions categories**: "Show and tell" and "Self-hosting".
- **Private vulnerability reporting**: on. `SECURITY.md` points at it.
- **GitHub Sponsors**: `.github/FUNDING.yml` only works once Sponsors is
  enabled on the account.

## Releasing

Releases are automatic, driven by conventional commit messages.

1. Merge PRs to `main` with conventional titles (`feat:`, `fix:`, …). Squash
   merges use the PR title, so the title is what ends up in the changelog.
2. release-please keeps a `chore(main): release x.y.z` PR open with the version
   bump and the generated `CHANGELOG.md`.
3. Merging that PR tags the release, and the same `release.yml` run then calls
   `docker-publish.yml` to publish both images to GHCR as `latest` and the
   semver tags. `main` also publishes `edge` on every push. (The publish can't
   hang off a `release: published` trigger: a release created with
   `GITHUB_TOKEN` doesn't start other workflows.) To republish a release, run
   "Publish images" by hand with its tag.

Pre-1.0, `feat:` bumps the minor and everything else the patch. A breaking
change is `feat!:` or a `BREAKING CHANGE:` footer — and anything that needs
manual intervention on upgrade must say so in the changelog under a
**Breaking** heading, because self-hosters read that and nothing else.

## Reviewing contributions

The four checks in CI are non-negotiable. Beyond those, the things worth
looking at, in order:

1. **Does it log manuscript text?** Search the diff for `console.log`, new
   analytics events, and error reports that include a payload. This is the one
   promise the project makes that cannot be walked back.
2. **Locale parity.** The test catches missing keys; it cannot catch a wrong
   translation. If you cannot judge the Spanish, say so and ask.
3. **Is it a Server Component?** `"use client"` at the top of a page is almost
   always someone reaching for a hook they could have pushed down into an
   island.
4. **Authorization.** Every query function in `lib/db/queries/` takes `userId`
   and scopes by it; there is no row-level security behind it. A new function
   needs a case in `tests/integration/db/authz.test.ts`.
5. **Scope.** A PR that adds a dependency to solve something small is worth
   pushing back on. So is one that quietly adds prose generation — see
   ROADMAP.md, "Not planned".

Contributors sign off with DCO (`git commit -s`). There is no CLA, which means
you cannot relicense their work later without asking them.

## Things that break quietly

- **A stale `bun.lock` fails CI.** Dependabot's `bun` ecosystem keeps it in
  sync, but a hand-edited `package.json` does not: CI's `--frozen-lockfile`
  then fails. Run `bun install` and commit the lockfile.
- **The converter's binaries come from Debian.** A base-image change can alter
  EPUB output with no change in this repository. `converter-ci.yml` runs the
  epubcheck integration weekly for exactly this reason — do not let it stay red.
- **`AI_KEY_ENCRYPTION_SECRET` rotation** silently invalidates every stored user
  key. The app degrades gracefully (keys read as absent), but users must
  re-enter them. Never rotate it casually on a shared instance.

## Security reports

`SECURITY.md` directs people to private vulnerability reporting. Acknowledge
within a few days even if you cannot fix it quickly; a reporter who hears
nothing goes public.
