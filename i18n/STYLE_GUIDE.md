# ManuHaven — Spanish (es-MX) Translation Style Guide

This guide governs the Spanish copy in `messages/es.json`. The English source
of truth is `messages/en.json`; `es.json` must mirror its key structure exactly.

## Locale & audience

- **Target locale:** `es-MX` — Mexican Spanish, written for independent fiction
  authors in Mexico (and broadly Latin America).
- **Numbers and dates** are formatted with `Intl` for `es-MX`: decimals use `.`,
  thousands use `,`, dates are DD/MM/YYYY. Never hand-format them in copy.

## Tone & register

- **Use `tú` (informal, singular).** Address the author directly and warmly.
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
| editorial pass / suite | revisión editorial | |
| retailer | tienda / minorista | prefer "tienda" for storefronts (Amazon, Apple) |
| cover | portada | |
| draft | borrador | project status |
| live (published) | publicado | project status |
| dashboard | panel | |
| settings | ajustes | |

## Brand & untranslated terms

- **"ManuHaven"** — never translate; it is the product name.
- Format names stay as-is: **EPUB**, **PDF**, **DOCX**.
- Retailer names stay as-is: **Amazon**, **Apple Books**, **Kobo**, **Google
  Play**, etc.

## ICU placeholders

- Preserve every `{placeholder}` token verbatim — do not translate or reorder
  the variable names (e.g. `{count}`, `{amount}`, `{name}`).
- Keep ICU plural/select syntax intact; only translate the literal words:
  `"{count, plural, one {# manuscrito} other {# manuscritos}}"`.

## Scope note

This file is the contract for anyone editing `es.json`. Every key is translated;
a new English key needs its Spanish value in the same change, and the parity test
fails until it has one.
