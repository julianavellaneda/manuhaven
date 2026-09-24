# EPUB and PDF Export — Domain Reference

> Read before touching `lib/tiptap-to-html.ts`, `lib/export/`, `app/api/convert/*`
> or `services/converter/`. This describes what the code does today; planned work
> is marked as such.

---

## Output formats

| Format | Generator | Status | Notes |
|---|---|---|---|
| EPUB 3 | Pandoc (converter container) | Built | Converter CI builds an EPUB from a DOCX fixture and runs epubcheck on it. |
| PDF (print interior) | WeasyPrint (converter container) | Built | Trim sizes 5×8", 5.5×8.5" and 6×9" via `printSettings`. No cover. |
| MOBI | — | Not planned | KDP has accepted EPUB since 2022. |

---

## Pipeline

```
1. The manuscript lives in manuscripts.tiptap_json (JSONB, one row per project).
   It gets there from the editor's autosave, or from a .docx/.txt upload:
   mammoth (.docx) → HTML → lib/manuscript/html-to-tiptap.ts, or
   lib/manuscript/txt-to-tiptap.ts (.txt) → Tiptap JSON.

2. POST /api/convert/{epub,pdf} → lib/export/run-export.ts:
   a. Load the project, template and manuscript, scoped to the user.
   b. Claim an `exports` row as "processing" (20 exports per user per hour;
      a refused claim is deleted).
   c. lib/tiptap-to-html.ts: Tiptap JSON → semantic HTML (mapping below).
   d. EPUB only: read the cover bytes from lib/storage.

3. POST {CONVERTER_URL}/convert/{epub|pdf}
   Authorization: Bearer CONVERTER_API_KEY
   {
     html,
     templateId: "romance" | "thriller" | "fantasy" | "scifi" | "literary",
     metadata: { title, subtitle?, authorName, description?, isbn?, genre, language },
     cover?: { base64, contentType },          // EPUB only
     printSettings?: { trimSize, margins, fontSize }   // PDF only
   }

4. The converter writes the input to a temp dir, runs Pandoc or WeasyPrint,
   returns the file bytes and deletes the temp dir. It has no database or
   storage credentials, fetches nothing, and never logs the tool's stderr,
   because stderr can quote the manuscript.

5. The app stores the bytes via lib/storage at
   {userId}/{projectId}/exports/{exportId}.{epub|pdf}
   and finishes the row: status "complete" with file_key and file_size_bytes,
   or status "failed" with error_message.
```

The converter is reachable only on the compose network; it publishes no port.

---

## Tiptap JSON → HTML (`lib/tiptap-to-html.ts`)

| Tiptap node / mark | HTML |
|---|---|
| `heading` level 1 | `<h1 class="chapter-title">`; starts a chapter |
| `heading` level 2–6 | `<h2>`–`<h6>` |
| `paragraph` | `<p>` (an empty one becomes `<p>&nbsp;</p>`) |
| `blockquote` | `<blockquote>` |
| `bulletList` / `orderedList` / `listItem` | `<ul>` / `<ol>` / `<li>` |
| `horizontalRule` | `<hr class="scene-break" />` |
| `hardBreak` | `<br />` |
| `bold`, `italic`, `strike`, `code`, `underline` | `<strong>`, `<em>`, `<s>`, `<code>`, `<u>` |
| `link` | `<a href="…">` |

All text and attribute values are HTML-escaped. After rendering, everything from
one `<h1>` up to the next is wrapped in `<section class="chapter">`, and the first
`<p>` after each `<h1>` gets `class="chapter-opening"` for drop caps. Content
before the first `<h1>` stays unwrapped.

---

## EPUB (`services/converter/lib/convert-epub.js`)

Pandoc runs as:

```
pandoc input.html -o out.epub --css=template.css \
  --metadata=title:… --metadata=author:… --metadata=lang:… \
  --toc --toc-depth=1 --epub-chapter-level=1 [--epub-cover-image=cover.ext]
```

- One XHTML file per `<h1>` chapter, and a table of contents one level deep.
- Pandoc writes the package document, `nav.xhtml` and the OPF metadata. Only
  title, author and language are passed today; subtitle, description and ISBN
  reach the converter but are not yet written into the EPUB.
- The template CSS is the light stylesheet plus `<genre>.dark.css`, which holds
  only a `prefers-color-scheme: dark` block.

## PDF (`services/converter/lib/convert-pdf.js`)

WeasyPrint renders the HTML with the light stylesheet plus a generated `@page`
rules for the trim size, mirrored inside/outside margins and font size, and
starts every chapter on a right-hand page. The dark stylesheet is never
used, because WeasyPrint rejects media feature queries and paper has no color
scheme.

---

## Templates

Each genre has two files in `services/converter/templates/`: `<genre>.css` and
`<genre>.dark.css`. The genre must also be listed in `VALID_TEMPLATES` in
`services/converter/index.js` and have a row in the `templates` table (seeded by
`drizzle/0001_seed_templates.sql`). The app sends `templates.genre`, lowercased,
as `templateId`.

Stylesheet rules:

- Style only the markup in the mapping above: `section.chapter`,
  `.chapter-title`, `.chapter-opening` (and `::first-letter`), `h2`, `h3`, `p`,
  `blockquote`, lists, `hr.scene-break`, `a`, `code`.
- No JavaScript and no external resources. Use generic font families
  (`serif`, `sans-serif`); readers do not load web fonts or CDNs.
- Keep the main stylesheet free of media feature queries, because WeasyPrint
  reads it too. Dark mode goes in `<genre>.dark.css`.
- Start each `section.chapter` on a new page (`page-break-before: always`).
  The PDF path overrides this to start chapters on a right-hand page.

### Adding a template

1. Write `<genre>.css` and `<genre>.dark.css` following the rules above.
2. Add `<genre>` to `VALID_TEMPLATES` in `services/converter/index.js`.
3. Add a custom migration (`bunx drizzle-kit generate --custom`) that inserts the
   `templates` row (`name`, `genre`, `css_url`, `description`, `supports_epub`,
   `supports_pdf`).
4. Export a test manuscript to EPUB and PDF, run epubcheck on the EPUB, and open
   it in at least two readers (for example Calibre and Apple Books).

---

## Accessibility

The web UI targets WCAG 2.1 AA. For EPUB output, what exists today is
structural: a language tag, a navigation document, and one heading per chapter.

Planned, not built:

- `schema:accessMode`, `schema:accessibilityFeature` and
  `schema:accessibilitySummary` metadata in the OPF.
- DAISY Ace checks in converter CI.
- Alt text for images (the editor has no image node yet).
