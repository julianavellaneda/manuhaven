# Roadmap

What ManuHaven is for: writing a novel, editing it with AI you control, turning
it into a retail-ready EPUB and PDF, and seeing what it earned. Everything below
serves that loop. Everything that doesn't is in [Not planned](#not-planned).

This is a solo-maintained project, so treat the ordering as intent rather than a
schedule. Dates are deliberately absent. If something here matters to you, say so
on the issue — that is the main thing that moves items up.

## Now — v0.1

The first public release. The studio already works end to end; this is about
making it something a stranger can run.

- [x] No cloud account needed: Postgres, auth, file storage and the converter
      all run in `docker compose up`
- [x] Authz test suite: every query function is checked against cross-user access
- [x] Bring-your-own-key AI, with the app fully usable when no key exists
- [x] Docker images for the app and the converter, with no deployment
      configuration baked into the build
- [x] CI: lint, types, tests, build, and a real DOCX → EPUB → epubcheck run
- [ ] Hosted demo with a sample public-domain manuscript
- [ ] Self-hosting documentation that has been followed by someone other than
      the author

## Next — v0.2, export hardening

Export is what authors ultimately need to be perfect, and it is where the
project is most obviously better than a general-purpose writing tool.

- [x] Cover image upload wired through to the EPUB cover
- [ ] Front and back matter: title page, copyright page, "also by", dedication
- [ ] Print PDF trim-size presets (5×8, 5.5×8.5, 6×9) with correct gutters
- [ ] Page-count and spine-width estimate in the preview
- [ ] DAISY ACE accessibility validation alongside epubcheck in CI

## v0.3 — the Codex, without AI

The continuity data currently lives in a JSON blob written by the AI. Making it
first-class means an author who wants nothing to do with AI still gets a usable
story bible.

- [ ] `codex_entities` / `codex_facts` tables replacing the jsonb column
- [ ] Manual editing of every entity and fact
- [ ] Continuity flags surfaced in the chapter navigator
- [ ] "No AI assistance was used" statement available in the export metadata

## v0.4 — assistant v1

- [ ] `propose_edit`: every AI edit arrives as a diff the author applies or
      discards, never as a silent rewrite
- [ ] A provenance log of what the assistant touched, exportable
- [ ] Slash commands in the assistant input
- [ ] AI SDK 6 → 7 (typed tool context and tool-approval flows map directly
      onto the diff model above)

## v0.5 — import and export breadth

- [ ] Markdown import and export
- [ ] Scrivener (`.scriv`) import
- [ ] DOCX export

## v0.6 — royalty depth

- [ ] Draft2Digital and Google Play CSV parsers
- [ ] Multi-currency with historical conversion
- [ ] Per-title profit and loss with simple expense entry

## v1.0

- [ ] A third locale, contributed and maintained by a native speaker
- [ ] Genre templates as drop-in files, no code change required
- [ ] WCAG AA audit of the editor
- [ ] Sentry and PostHog documented for self-hosters (optional, off by default)

## Not planned

Saying no to these is what keeps the rest small.

- **Distribution to retailers, and payouts.** The project used to attempt this.
  It is a business, not a feature: contracts, tax forms, support obligations.
  Export a valid EPUB and upload it yourself.
- **Generating prose.** No scene generator, no ghost text, no autocomplete that
  writes the next sentence. The AI here reads what you wrote and tells you
  things about it. That line is a product decision, and it is not moving.
- **Embeddings and vector retrieval.** Modern context windows plus a tool that
  reads the chapter it needs are enough, and they cost the user nothing to
  maintain.
- **A paid "pro" tier of the software.** Everything is in the AGPL core. If a
  hosted option ever appears it will be convenience, not features.
