"use strict";

/**
 * convert-epub.js
 * Converts HTML + metadata + template CSS + cover into an EPUB 3.0 file
 * using Pandoc as the conversion engine.
 */

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { ConversionError } = require("./errors");

const execFileAsync = promisify(execFile);

/**
 * Convert HTML to EPUB using Pandoc.
 *
 * @param {object} params
 * @param {string} params.html - Full HTML document string
 * @param {object} params.metadata - { title, authorName, language }
 * @param {string} params.templateCss - CSS content string
 * @param {{ data: Buffer, ext: string } | null} params.cover - Cover image
 *   bytes and file extension (jpg, png, webp); Pandoc infers the media type
 *   from the extension
 * @param {string} params.outputPath - Where to write the final EPUB
 * @returns {Promise<string>} The output path on success
 */
async function convertToEpub({
  html,
  metadata,
  templateCss,
  cover,
  outputPath,
}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "epub-"));

  const htmlPath = path.join(tmpDir, "input.html");
  const cssPath = path.join(tmpDir, "template.css");
  const coverPath = cover ? path.join(tmpDir, `cover.${cover.ext}`) : null;

  try {
    await Promise.all([
      fs.writeFile(htmlPath, html, "utf-8"),
      fs.writeFile(cssPath, templateCss, "utf-8"),
      coverPath && fs.writeFile(coverPath, cover.data),
    ]);

    const args = [
      htmlPath,
      "-o",
      outputPath,
      `--css=${cssPath}`,
      `--metadata=title:${metadata.title || "Untitled"}`,
      `--metadata=author:${metadata.authorName || metadata.author || "Unknown"}`,
      `--metadata=lang:${metadata.language || "en"}`,
      "--toc",
      "--toc-depth=1",
      "--epub-chapter-level=1",
    ];
    if (coverPath) {
      args.push(`--epub-cover-image=${coverPath}`);
    }

    // Pandoc's stderr can quote the manuscript, so it is never logged or
    // returned; only the exit code travels.
    try {
      await execFileAsync("pandoc", args, { timeout: 60000 });
    } catch (err) {
      throw new ConversionError("pandoc", err);
    }

    await fs.access(outputPath);
    return outputPath;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { convertToEpub };
