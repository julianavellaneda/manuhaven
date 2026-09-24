# Compliance Rules

Rules in this document affect EPUB output, AI feature behavior, and UI copy. Read
before touching the export pipeline or any AI feature.

Scope note: this project is a self-hostable writing studio. It sells nothing, takes no
payments, and distributes to no retailer, so commerce, payout, and tax rules are out of
scope. What remains below are the rules that govern the *artifact* the software
produces and the way it handles an author's text. None of this is legal advice;
operators and authors are responsible for the rules that apply to them.

---

## Personal data

- Account deletion (`POST /api/account/delete`) purges the user's files from
  storage (`{userId}/` prefix) first, then deletes the user row, which cascades to
  everything they own.
- Planned, not built: a self-service export of all of a user's data.
- Whoever runs an instance is responsible for its users' data. The project itself
  receives nothing: there is no telemetry, and optional PostHog analytics only run
  when the operator configures a key.

## Accessibility

- The web UI targets WCAG 2.1 AA.
- EPUB output is structurally accessible (language tag, navigation document, one
  heading per chapter). Accessibility metadata and DAISY Ace checks are planned;
  see the Accessibility section of `epub-spec.md`.

## AI scope and disclosure

- The AI features are editorial: analysis, critique, continuity checks, metadata
  suggestions and a chat assistant. None of them writes manuscript prose into the
  book.
- If a generative mode is ever added, it must be opt-in and clearly labeled, so
  authors can meet their retailers' AI-disclosure rules.
- The app adds no AI labels or stamps to exported books.

## Author copyright

- Authors retain 100% copyright. The software receives no license of any kind to the
  author's text.
- Manuscript content may **never** be used for AI training by this project.

## AI privacy — zero retention

- AI calls use the user's own API key, or the operator's server key when the
  operator has configured one. The text goes to that provider under the key
  owner's terms with the provider.
- Manuscripts are processed ephemerally: no logging, no caching, discarded after the
  response.
- **Never** `console.log`, `logger.info`, or otherwise persist manuscript text.
- Running the models locally would be the strongest form of this guarantee. It is
  not supported yet: the provider layer covers Anthropic, OpenAI and Google.
