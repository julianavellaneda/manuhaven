# Compliance Rules

Rules in this document affect EPUB output, AI feature behavior, and UI copy. Read
before touching the export pipeline or any AI feature.

Scope note: this project is a self-hostable writing studio. It sells nothing, takes no
payments, and distributes to no retailer, so commerce, payout, and tax rules are out of
scope. What remains below are the rules that govern the *artifact* the software
produces and the way it handles an author's text.

---

## GDPR

- Right to deletion: purge the user's files from storage (`{userId}/` prefix), then delete the user row, which cascades to everything they own.
- Data portability: JSON/CSV export of all author data.
- Operators of a hosted instance are the data controller for their own users.

## EAA — European Accessibility Act (active 2025-06-28)

- EPUB 3 output must pass DAISY ACE + EPUBCheck.
- Embed `schema:accessibilityFeature` metadata in every EPUB.
- WCAG 2.1 AA minimum for the web UI.
- `exports.accessibility_score` JSONB stores the ACE report per export.

## EU AI Act — Article 50 (enforceable 2026-08-02)

- Fiction and creative works are explicitly **exempted** from cover-side AI disclosure.
- Required: non-intrusive backend metadata disclosure only (copyright page or EPUB
  metadata).
- Do **not** add cover stamps or visible "AI-assisted" labels — no legal upside, and it
  harms the work's marketability.

## Retailer AI disclosure (KDP and equivalents)

- The AI scope here is editorial only — analysis, critique, and continuity checking, not
  generative prose. That scope qualifies for the KDP "AI-assisted" safe harbor.
- If a generative mode is ever added it must be opt-in and separately disclosed.

## Author copyright

- Authors retain 100% copyright. The software receives no license of any kind to the
  author's text.
- Manuscript content may **never** be used for AI training, by this project or by any
  provider it calls.

## AI privacy — zero retention

- Use zero-retention terms with any AI API provider.
- Manuscripts are processed ephemerally: no logging, no caching, discarded after the
  response.
- **Never** `console.log`, `logger.info`, or otherwise persist manuscript text.
- Self-hosting the models entirely is the strongest form of this guarantee and is a
  supported deployment goal.
