<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Package Manager
Always use `bun` for all package management and script commands in this project.
Never use `npm`, `npx`, or `yarn`. Use `bunx` instead of `npx`.

---

# AGENTS.md

Read `CLAUDE.md` for immutable coding rules, patterns, and gotchas.

For domain knowledge, architecture, and reference material:
- `docs/architecture.md` — stack, folder structure, routes, deployment
- `docs/self-hosting.md`, `docs/ai.md`, `docs/i18n.md` — running it, the AI layer, translations
- `docs/platform/` — database schema, design system, providers, compliance rules
- `ROADMAP.md` — what is planned, and what is deliberately not
- `docs/maintaining.md` — release process and review checklist (maintainers)

Do not duplicate content from CLAUDE.md or docs/ here.
