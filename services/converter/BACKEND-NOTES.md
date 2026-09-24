# Converter Service — Backend Notes

## Tool Comparison: Pandoc vs WeasyPrint for PDF Output

### Pandoc
- Default PDF output uses LaTeX (pdflatex/xelatex/lualatex), which requires a full TeX distribution (~2-4 GB).
- Excellent for academic papers, technical documents, and Markdown-to-anything workflows.
- EPUB output is first-class — Pandoc is the gold standard for EPUB 3.0 generation.
- PDF via LaTeX gives limited control over CSS-based page layouts. Styling is done through LaTeX templates, not CSS.
- Supports custom EPUB stylesheets via `--css` flag.
- Handles table of contents, chapter splitting, and metadata embedding natively.

### WeasyPrint
- Native CSS Paged Media support (`@page`, `@page :left`, `@page :right`, named pages).
- Designed specifically for rendering HTML+CSS into paginated PDF documents.
- Supports trim sizes, gutters (inner/outer margins), bleed, crop marks.
- CSS-based workflow means fiction book templates are straightforward to author: the same CSS vocabulary used for screen display applies to print.
- Lighter install footprint than a full TeX distribution.
- Does not produce EPUB — it is PDF-only.

### Decision

| Format | Tool      | Rationale                                                                 |
|--------|-----------|---------------------------------------------------------------------------|
| EPUB   | Pandoc    | Industry-standard EPUB 3.0 generator. Handles TOC, metadata, chapter splitting, and custom CSS out of the box. |
| PDF    | WeasyPrint| CSS Paged Media is more intuitive for book templates than LaTeX. Authors and designers can write standard CSS to control trim size, margins, gutters, running headers/footers, drop caps, and page breaks. |

This split lets each tool do what it does best: Pandoc for reflowable EPUB, WeasyPrint for fixed-layout print-ready PDF.
