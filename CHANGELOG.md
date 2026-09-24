# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `LICENSE` (AGPL-3.0-only), `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and this changelog.
- Docker images for the app and the converter, and a `docker compose` that runs
  both. Published to GHCR on release.
- Continuous integration: lint, types, tests, build, a Docker build, CodeQL,
  and a real DOCX -> EPUB -> epubcheck run against the converter container.
- `ROADMAP.md`, `docs/self-hosting.md`, `docs/architecture.md`, `docs/ai.md`,
  `docs/i18n.md`, and `docs/maintaining.md`.
- Issue and pull request templates, labels, and `scripts/gh-bootstrap.sh` to
  apply them.

### Changed
- Deployment configuration is read at request time rather than inlined at build
  time, so a published image runs against any Supabase project without being
  rebuilt.
- `docs/platform/architecture.md` moved to `docs/architecture.md` and was
  rewritten around the current deployment story.
- `docs/platform/compliance.md` — the GDPR, EAA, EU AI Act, copyright, and AI-privacy
  rules that govern the export pipeline and the AI features.

### Removed
- The business-plan, market-research, and internal presentation material that belonged to
  the project's closed-source SaaS era. None of it described the software.
