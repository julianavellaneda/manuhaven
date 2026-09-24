# ManuHaven — Spanish (es-MX) Translation Style Guide

This guide governs the Spanish copy in `messages/es.json`. The English source
of truth is `messages/en.json`; `es.json` must mirror its key structure exactly.

## Locale & audience

- **Target locale:** `es-MX` — Mexican Spanish, written for independent fiction
  authors in Mexico (and broadly Latin America).
- **Currency:** Mexican peso (MXN), rendered as `MX$1,299.00` (narrow symbol to
  disambiguate from USD). Decimals use `.`, thousands use `,`. Dates DD/MM/YYYY.

## Tone & register

- **Use `tú` (informal, singular).** Address the author directly and warmly —
  ManuHaven is a small, founder-built studio, not a faceless corporation.
- **Use `ustedes` for plural.** **Never use `vosotros`** (that is es-ES, wrong
  for Mexico).
- Keep it concise, encouraging, and professional. Avoid slang and regionalisms
  that wouldn't read cleanly across Latin America.
- Match the English register: marketing copy is inviting; dashboard/system copy
  is clear and direct; error messages are calm and actionable.

## Glossary (product terms — translate consistently)

| English | Spanish (es-MX) | Notes |
|---|---|---|
| manuscript | manuscrito | |
| royalties | regalías | |
| payout | pago | (a disbursement to the author) |
| editorial pass / suite | revisión editorial | |
| story bible | biblia narrativa | |
| retailer | tienda / minorista | prefer "tienda" for storefronts (Amazon, Apple) |
| export bundle | paquete de exportación | |
| cover | portada | |
| draft | borrador | project status |
| live (published) | publicado | project status |
| dashboard | panel | |
| settings | ajustes | |

## Brand & untranslated terms

- **"ManuHaven"** — never translate; it is the product name.
- Format names stay as-is: **EPUB**, **PDF**, **BISAC**, **OXXO**, **SPEI**,
  **Stripe**, **W-9**.
- Retailer names stay as-is: **Amazon**, **Apple Books**, **Kobo**, **Google
  Play**, etc.

## ICU placeholders

- Preserve every `{placeholder}` token verbatim — do not translate or reorder
  the variable names (e.g. `{count}`, `{amount}`, `{name}`).
- Keep ICU plural/select syntax intact; only translate the literal words:
  `"{count, plural, one {# manuscrito} other {# manuscritos}}"`.

## Scope note

This file is the contract handed to translators. The current `es.json` ships
with **English placeholder values** (scaffold) so the `/es` site renders
end-to-end; real Spanish copy replaces those values per this guide.
