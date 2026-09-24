# ManuHaven converter service

A small Express service that turns manuscript HTML into a retail-ready EPUB 3
or a print-ready PDF. It is a separate process from the Next.js app because it
needs system binaries the app does not: **Pandoc** for EPUB and **WeasyPrint**
for PDF.

It is a plain CommonJS Node service with its own `package.json`, not part of
the app's TypeScript program.

## Running it

```bash
docker build -t manuhaven-converter services/converter
docker run --rm -p 3001:3001 -e CONVERTER_API_KEY=dev-secret manuhaven-converter
```

Then point the app at it:

```bash
CONVERTER_URL=http://localhost:3001
CONVERTER_API_KEY=dev-secret
```

| Variable | Required | Notes |
|---|---|---|
| `CONVERTER_API_KEY` | yes | Shared secret. **Every authenticated route returns 500 until it is set** — the service refuses to run open. |
| `PORT` | no | Defaults to `3001`. |

## Endpoints

`GET /health` is unauthenticated and reports whether the Pandoc and WeasyPrint
binaries are present. Everything else needs `Authorization: Bearer $CONVERTER_API_KEY`.

### `POST /convert/epub` · `POST /convert/pdf`

JSON in, file bytes out. The service holds no credentials and fetches nothing:
the caller sends everything the render needs and stores the result itself.

```bash
curl -X POST http://localhost:3001/convert/epub \
  -H "Authorization: Bearer $CONVERTER_API_KEY" \
  -H "Content-Type: application/json" \
  -o book.epub \
  -d '{
    "html": "<h1>Chapter One</h1><p>The pier at dawn.</p>",
    "metadata": { "title": "Tides", "authorName": "A. Novelist", "language": "en" },
    "templateId": "literary",
    "cover": { "base64": "iVBORw0KGgo…", "contentType": "image/png" }
  }'
```

| Field | Route | Notes |
|---|---|---|
| `html` | both | Required. The book body; `h1` starts a chapter. |
| `metadata` | both | Required. `title`, `authorName`, `language`. |
| `templateId` | both | Required. One of the stylesheets in `templates/`. |
| `cover` | EPUB | Optional. `{ base64, contentType }`, JPEG, PNG or WebP. |
| `printSettings` | PDF | Required. `{ trimSize: "5x8" \| "5.5x8.5" \| "6x9", margins: "narrow" \| "normal" \| "wide", fontSize: "small" \| "medium" \| "large" }`. |

A success is `200` with `Content-Type: application/epub+zip` or
`application/pdf` and the file as the body. Errors are JSON `{ "error": … }`:
`400` for a bad field, `401` for a bad key, `413` over the 60 MB body limit,
`500` when Pandoc or WeasyPrint fails.

**Privacy.** Pandoc and WeasyPrint can quote the manuscript in their error
output, so the service never logs or returns it: a failed render logs only the
tool and its exit code (`lib/errors.js`).

**Network.** Keep it off the internet. It holds no secrets worth stealing, but
each request is minutes of CPU. The production Compose file publishes no port
for it.

## Template CSS contract

`templateId` selects a stylesheet from `templates/`: `fantasy`, `literary`,
`romance`, `scifi`, `thriller`. The file is written into a temp directory and
handed to Pandoc as `--css=template.css` (and to WeasyPrint for PDF), so it
must be self-contained:

- **No `@import`, no remote URLs, no web fonts.** The conversion runs offline
  in a container; anything it cannot resolve locally is silently dropped.
- Style the semantic elements Pandoc emits — `h1`/`h2` for chapter and section
  headings, `p`, `blockquote`, `hr`, `em`, `strong`. There are no utility
  classes to hook.
- Use `@page` rules for print margins in the PDF path.
- Keep the EPUB and PDF cases in one file; both formats load the same
  stylesheet.

To add a genre, drop `templates/<id>.css` in and use that `<id>` as
`templateId`. There is no registry to update.
