"use strict";

/**
 * convert-pdf.js
 * Converts HTML + metadata + template CSS + cover into a print-ready PDF
 * using WeasyPrint as the rendering engine.
 */

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { ConversionError } = require("./errors");

const execFileAsync = promisify(execFile);

/**
 * Trim size dimensions in inches (width x height).
 */
const TRIM_SIZES = {
  "5x8": { width: "5in", height: "8in" },
  "5.5x8.5": { width: "5.5in", height: "8.5in" },
  "6x9": { width: "6in", height: "9in" },
};

/**
 * Margin presets in inches.
 * Inside margin (gutter) is wider to account for binding.
 */
const MARGIN_PRESETS = {
  narrow: { top: "0.5in", bottom: "0.5in", outside: "0.5in", inside: "0.75in" },
  normal: { top: "0.75in", bottom: "0.75in", outside: "0.625in", inside: "0.875in" },
  wide: { top: "1in", bottom: "1in", outside: "0.75in", inside: "1in" },
};

/**
 * Font size presets.
 */
const FONT_SIZES = {
  small: "10pt",
  medium: "11pt",
  large: "12pt",
};

/**
 * Generate @page CSS rules based on print settings.
 * Uses :left and :right pseudo-pages for correct inside/outside margins.
 *
 * @param {object} printSettings
 * @param {string} printSettings.trimSize - "5x8" | "5.5x8.5" | "6x9"
 * @param {string} printSettings.margins - "narrow" | "normal" | "wide"
 * @param {string} printSettings.fontSize - "small" | "medium" | "large"
 * @returns {string} CSS string
 */
function generatePageCss(printSettings = {}) {
  const trim = TRIM_SIZES[printSettings.trimSize] || TRIM_SIZES["6x9"];
  const margins = MARGIN_PRESETS[printSettings.margins] || MARGIN_PRESETS["normal"];
  const fontSize = FONT_SIZES[printSettings.fontSize] || FONT_SIZES["medium"];

  return `
/* Print settings - generated */
@page {
  size: ${trim.width} ${trim.height};
  margin-top: ${margins.top};
  margin-bottom: ${margins.bottom};
}

/* Right-hand (recto) pages: gutter on left */
@page :right {
  margin-left: ${margins.inside};
  margin-right: ${margins.outside};
}

/* Left-hand (verso) pages: gutter on right */
@page :left {
  margin-left: ${margins.outside};
  margin-right: ${margins.inside};
}

/* Force chapters to start on right-hand page */
section.chapter {
  page-break-before: right;
}

/* Base font size override */
body {
  font-size: ${fontSize};
}
`;
}

/**
 * Build a self-contained HTML document with embedded CSS for WeasyPrint.
 *
 * @param {string} bodyHtml - The HTML body content (sections)
 * @param {string} templateCss - The genre template CSS
 * @param {string} pageCss - The generated @page CSS
 * @param {object} metadata - { title, author, language }
 * @returns {string} Complete HTML document
 */
function buildPdfHtml(bodyHtml, templateCss, pageCss, metadata) {
  const escapeHtml = (str) =>
    (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const title = escapeHtml(metadata.title || "Untitled");
  const language = escapeHtml(metadata.language || "en");

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
${pageCss}

${templateCss}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Convert HTML to a print-ready PDF using WeasyPrint.
 *
 * @param {object} params
 * @param {string} params.html - HTML body content (chapter sections)
 * @param {object} params.metadata - { title, author, language }
 * @param {string} params.templateCss - Genre template CSS content
 * @param {object} params.printSettings - { trimSize, margins, fontSize }
 * @param {string} params.outputPath - Where to write the final PDF
 * @returns {Promise<string>} The output path on success
 */
async function convertToPdf({
  html,
  metadata,
  templateCss,
  printSettings,
  outputPath,
}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
  const htmlPath = path.join(tmpDir, "input.html");

  try {
    // Generate print-specific CSS
    const pageCss = generatePageCss(printSettings);

    // Build self-contained HTML with embedded styles
    const fullHtml = buildPdfHtml(html, templateCss, pageCss, metadata);

    // Write input file
    await fs.writeFile(htmlPath, fullHtml, "utf-8");

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // WeasyPrint's stderr can quote the manuscript, so it is never logged or
    // returned; only the exit code travels.
    try {
      await execFileAsync("weasyprint", [htmlPath, outputPath], {
        timeout: 120000, // 120s timeout for large books
      });
    } catch (err) {
      throw new ConversionError("weasyprint", err);
    }

    await fs.access(outputPath);
    return outputPath;
  } finally {
    // Clean up temp directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { convertToPdf, generatePageCss };
