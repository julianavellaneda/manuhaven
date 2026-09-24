# EPUB Specification — "ManuHaven" Domain Reference

> Domain knowledge injection for AI coding agents. Read before touching anything in the conversion pipeline, `services/converter/`, or `lib/providers/conversion/`.

---

## EPUB 3.0 Package Structure

A valid EPUB 3.0 file is a ZIP archive with this internal layout:

```
book.epub (ZIP)
├── mimetype                    # Must be first file, uncompressed: "application/epub+zip"
├── META-INF/
│   └── container.xml           # Points to the OPF file
└── OEBPS/
    ├── content.opf             # Package document (metadata + manifest + spine)
    ├── nav.xhtml               # Navigation document (required: TOC + landmarks)
    ├── Styles/
    │   └── [template-slug].css # One CSS file per template
    ├── Images/
    │   └── cover.jpg           # Cover image (1600×2400px min, JPEG or PNG, RGB)
    └── Text/
        ├── cover.xhtml         # Cover page
        ├── title-page.xhtml    # Title page
        ├── chapter-001.xhtml   # One file per chapter
        ├── chapter-002.xhtml
        └── ...
```

### content.opf Requirements

The `<metadata>` block must include:
- `dc:title` — book title
- `dc:creator` — author name
- `dc:language` — IETF language tag (e.g., `en`, `fr`, `de`)
- `dc:identifier` — ISBN-13 as URN (`urn:isbn:9781234567890`) or fallback UUID
- `dc:date` — publication date (ISO 8601: `YYYY-MM-DD`)
- `<meta name="cover" content="cover-image"/>` — cover manifest ID

Accessibility metadata (required for EAA compliance):
```xml
<meta property="schema:accessMode">textual</meta>
<meta property="schema:accessibilityFeature">structuralNavigation</meta>
<meta property="schema:accessibilitySummary">This publication meets WCAG 2.1 Level AA.</meta>
```

The `<spine>` must list all content documents in reading order. `nav.xhtml` must appear first.

### nav.xhtml Requirements

Must use `epub:type` attributes:
- `<nav epub:type="toc">` — table of contents (required)
- `<nav epub:type="landmarks">` — front/body/back matter landmarks (required for accessibility)
- `<nav epub:type="page-list">` — page breaks (optional, recommended for library distribution)

All TOC entries must have meaningful text — use actual chapter titles, not "Chapter 1".

---

## Semantic HTML Targets for Templates

The conversion pipeline produces semantic HTML that template CSS styles. Template CSS must only target these elements — no inline styles, no JavaScript.

| HTML Element / Class | Semantic Meaning | Notes |
|---|---|---|
| `h1` | Book title | Title page only; one per book |
| `h2` | Chapter title | One per chapter file; triggers chapter split |
| `h3` | Section heading within chapter | Optional |
| `p` | Body paragraph | First-line indent; no top margin after `h2` |
| `p.first` | First paragraph of chapter | No indent; drop-cap candidate |
| `blockquote` | Quoted text / epigraph | Indented, italic |
| `.chapter-title` | Decorative chapter header wrapper | Contains `h2` + optional chapter number span |
| `.scene-break` | Scene break marker | Renders as centered `* * *` or ornament |
| `.drop-cap` | First letter of chapter | CSS `::first-letter` or explicit `<span class="drop-cap">` |
| `.epigraph` | Opening quote at chapter start | Placed before body text, with attribution |
| `.poetry` | Poetry stanza wrapper | `white-space: pre-wrap`; no indent |
| `.poetry-line` | Individual line of poetry | — |
| `.author-note` | Author's note (front/back matter) | — |

---

## Tiptap JSON → Semantic HTML Conversion Mapping

The `tiptap-to-html.ts` converter must apply these rules:

| Tiptap Node/Mark | HTML Output | Notes |
|---|---|---|
| `heading` level 1 | `<h1>` | Title page only |
| `heading` level 2 | `<h2>` | **Triggers new chapter file** |
| `heading` level 3 | `<h3>` | — |
| `paragraph` | `<p>` | First paragraph after `h2` gets class `first` |
| `blockquote` | `<blockquote>` | — |
| `horizontalRule` | `<div class="scene-break">* * *</div>` | — |
| `bold` mark | `<strong>` | — |
| `italic` mark | `<em>` | — |
| `code` mark | `<code>` | — |
| `link` mark | `<a href="...">` | Strip external links in EPUB (EPUB readers don't load URLs) |
| `image` node | `<img src="..." alt="...">` | Alt text required; image must be embedded in EPUB package |

---

## Output Formats

| Format | Generator | Status | Notes |
|---|---|---|---|
| EPUB 3.0 | Pandoc (converter container) | Built | Primary output. epubcheck-clean in CI; ACE validation planned. |
| PDF (print-on-demand) | WeasyPrint (converter container) | Built | Trim sizes 5×8", 5.5×8.5", 6×9" via `printSettings` |
| MOBI (legacy Kindle) | Calibre `ebook-convert` | Not planned | For legacy Kindle device sideloading. KDP accepts EPUB since 2022. |

---

## Conversion Pipeline (Full Flow)

```
1. Author uploads .docx OR writes/edits in Tiptap editor
   └─ .docx path:
      mammoth.js (^1.12.0) converts .docx → HTML
      → HTML sanitized (strip hardcoded fonts, excessive spacing, empty paragraphs)
      → HTML converted to Tiptap JSON
      → Saved to manuscripts.tiptap_json (JSONB)
   └─ Tiptap editor path:
      JSON saved directly to manuscripts.tiptap_json on autosave

2. Manuscript stored as Tiptap JSON in Postgres
   (manuscripts.tiptap_json JSONB column, one row per project)

3. On export request (POST /api/convert/{epub,pdf} → lib/export/run-export.ts):
   a. Claim an `exports` row as "processing" (20 per user per hour)
   b. tiptap-to-html.ts: Tiptap JSON → clean semantic HTML
      (one <section> per chapter, per mapping above)
   c. Read the cover bytes from lib/storage (EPUB only)

4. Payload posted to the converter container (never reachable from outside):
   POST {CONVERTER_URL}/convert/{epub|pdf}   Authorization: Bearer CONVERTER_API_KEY
   {
     html: "...",
     templateId: "romance" | "thriller" | "fantasy" | "scifi" | "literary",
     metadata: { title, authorName, language, ... },
     cover?: { base64, contentType },
     printSettings?: { trimSize, margins, fontSize }   // PDF only
   }

5. Converter:
   EPUB: Pandoc --from=html --to=epub3 with the template CSS + metadata
   PDF:  WeasyPrint with print-specific CSS
   → responds with the file bytes. It fetches nothing and stores nothing.

6. App stores the bytes via lib/storage under
   {userId}/{projectId}/exports/{exportId}.{epub|pdf}

7. App finishes the exports row:
   status = "complete", file_key, file_size_bytes
   (or status = "failed" with error_message)

   Author sees download button + accessibility badge in the UI.
```

---

## Template CSS Architecture

One CSS file per template, plus a `.dark.css` variant, in
`services/converter/templates/` (mounted read-only into the converter).

Rules:
- **Zero JavaScript** — EPUB readers do not support JS. Never use `<script>` tags.
- **No external resources** — fonts must be embedded in the EPUB package or use `font-family: serif | sans-serif`. Do NOT link to Google Fonts or CDNs.
- **Light/dark support**: use CSS `@media (prefers-color-scheme: dark)` for dark mode variants.
- **Page breaks**: `break-before: page` (or `page-break-before: always` for broader compatibility) on chapter wrapper elements.
- **Hyphenation**: `hyphens: auto` on `p` for justified text.
- **Justified text**: `text-align: justify` for body paragraphs (standard book formatting).
- **Drop caps**: target `p.first::first-letter` or `.drop-cap` class.

CSS file naming: `[genre].css` and `[genre].dark.css`, where `[genre]` is the
`templates.genre` value and is listed in the converter's `VALID_TEMPLATES`.

---

## DAISY ACE Accessibility Validation

All EPUB output must pass DAISY ACE before delivery to authors. ACE checks:

| Requirement | How to Satisfy |
|---|---|
| Heading hierarchy | Use `h1` → `h2` → `h3` with no skipped levels |
| All images have alt text | `alt=""` for decorative images, descriptive text for meaningful ones |
| `lang` attribute on `<html>` | Must match `dc:language` in content.opf |
| `nav.xhtml` present and complete | Required; must include `toc` and `landmarks` epub:types |
| No deprecated EPUB 2 features | Do not use `guide` element, deprecated `ncx` as primary TOC |
| Colour contrast ≥ 4.5:1 | Validate template CSS (WCAG AA) |
| Logical reading order | Spine order must match visual reading order |

Planned: store the ACE report with each export. Not built yet.

WCAG 2.1 AA compliance also applies to the web application UI (EAA enforced June 2025).

---

## Adding a New Template

1. Create CSS file targeting only the semantic elements in the table above. No JS.
2. Save it as `services/converter/templates/[genre].css` (plus `[genre].dark.css`)
   and add `[genre]` to `VALID_TEMPLATES` in `services/converter/index.js`.
3. Add a custom migration (`bunx drizzle-kit generate --custom`) that inserts the
   `templates` row:
   - `name`, `genre`, `css_url`, `description`
   - `supports_epub: true`, `supports_pdf: true` (or false if PDF-specific styles are missing)
   - `is_active: false` initially
4. Run DAISY ACE validation against a test EPUB using this template.
5. Test rendering on at least 3 readers: Calibre, Apple Books, Kobo.
6. Set `is_active: true` only after ACE passes and manual review is complete.
