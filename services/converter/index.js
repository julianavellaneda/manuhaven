const express = require("express");
const { execFile } = require("child_process");
const { readFile, mkdir } = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const { convertToEpub } = require("./lib/convert-epub");
const { convertToPdf } = require("./lib/convert-pdf");

const app = express();
const PORT = process.env.PORT || 3001;
const CONVERTER_API_KEY = process.env.CONVERTER_API_KEY;

// Valid template IDs
const VALID_TEMPLATES = ["romance", "thriller", "fantasy", "scifi", "literary"];

// Cover types the app accepts on upload, and the extension Pandoc needs to
// infer each one's media type.
const COVER_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// A 50 MB manuscript's HTML plus a 10 MB cover as base64 (~13.4 MB).
// Registered per route, after the auth check, so an unauthenticated caller
// can't make the service buffer a body.
const parseJson = express.json({ limit: "60mb" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a version string from a CLI tool.
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<string>}
 */
function getVersion(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, (err, stdout) => {
      if (err) {
        resolve("not installed");
        return;
      }
      // First line typically contains the version
      const firstLine = stdout.trim().split("\n")[0];
      resolve(firstLine);
    });
  });
}

/**
 * Create a unique temp directory for a conversion job.
 * @returns {Promise<string>} Path to the temp directory
 */
async function createTempDir() {
  const id = crypto.randomUUID();
  const dir = path.join(os.tmpdir(), `manuhaven-convert-${id}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Clean up temp directory and all files inside it.
 * @param {string} dirPath
 */
async function cleanupTempDir(dirPath) {
  try {
    const { rm } = require("fs/promises");
    await rm(dirPath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — log but don't throw
    console.warn(`Failed to clean up temp dir: ${dirPath}`);
  }
}

/**
 * Read template CSS from the templates directory.
 *
 * Dark mode lives in a separate `<template>.dark.css` and is appended only for
 * EPUB. WeasyPrint 57 accepts only bare media types, so a `prefers-color-scheme`
 * query in the print stylesheet is discarded with a warning on every export --
 * and a print PDF has no color scheme to respond to in the first place.
 *
 * @param {string} templateId
 * @param {{ darkMode?: boolean }} [options]
 * @returns {Promise<string>} CSS content
 */
async function readTemplateCss(templateId, options = {}) {
  if (!VALID_TEMPLATES.includes(templateId)) {
    throw new Error(
      `Invalid template ID: ${templateId}. Valid templates: ${VALID_TEMPLATES.join(", ")}`
    );
  }

  const cssPath = path.join(__dirname, "templates", `${templateId}.css`);
  let css;
  try {
    css = await readFile(cssPath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Template CSS not found: ${templateId}.css. Ensure the template file exists in /app/templates/.`
      );
    }
    throw err;
  }

  if (!options.darkMode) {
    return css;
  }

  const darkPath = path.join(__dirname, "templates", `${templateId}.dark.css`);
  try {
    return `${css}\n${await readFile(darkPath, "utf-8")}`;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Dark-mode CSS not found: ${templateId}.dark.css. Ensure the template file exists in /app/templates/.`
      );
    }
    throw err;
  }
}

/**
 * Validate the fields both formats share. Returns an error message, or null.
 * @param {any} body
 * @returns {string | null}
 */
function validateCommon(body) {
  if (!body || typeof body !== "object") return "Expected a JSON body";
  if (typeof body.html !== "string" || !body.html) return "html is required";
  if (!body.metadata || typeof body.metadata !== "object") {
    return "metadata is required";
  }
  if (!VALID_TEMPLATES.includes(body.templateId)) {
    return `templateId must be one of: ${VALID_TEMPLATES.join(", ")}`;
  }
  return null;
}

/**
 * Decode the optional cover. Returns undefined when the field is malformed.
 * @param {any} cover
 * @returns {{ data: Buffer, ext: string } | null | undefined}
 */
function decodeCover(cover) {
  if (cover == null) return null;
  const ext = COVER_EXTENSIONS[cover.contentType];
  if (!ext || typeof cover.base64 !== "string") return undefined;
  const data = Buffer.from(cover.base64, "base64");
  return data.length > 0 ? { data, ext } : undefined;
}

/**
 * Run one conversion in a scratch directory and answer with the file bytes.
 * @param {import("express").Response} res
 * @param {string} contentType
 * @param {string} fileName
 * @param {(outputPath: string) => Promise<unknown>} convert
 */
async function sendConverted(res, contentType, fileName, convert) {
  let tempDir;
  try {
    tempDir = await createTempDir();
    const outputPath = path.join(tempDir, fileName);
    await convert(outputPath);
    const bytes = await readFile(outputPath);
    res.set("Content-Type", contentType).send(bytes);
  } catch (err) {
    // The error class and exit code only; see lib/errors.js.
    console.error(`${fileName} conversion failed:`, err.name, err.message);
    res.status(500).json({ error: "Conversion failed" });
  } finally {
    if (tempDir) await cleanupTempDir(tempDir);
  }
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/** Compare secrets in constant time, whatever their lengths. */
function secretsMatch(given, expected) {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAuth(req, res, next) {
  if (!CONVERTER_API_KEY) {
    console.error(
      "CONVERTER_API_KEY is not set. All authenticated requests will be rejected."
    );
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  if (!secretsMatch(authHeader.slice(7), CONVERTER_API_KEY)) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /health — unauthenticated
app.get("/health", async (_req, res) => {
  const [pandocVersion, weasyprintVersion] = await Promise.all([
    getVersion("pandoc", ["--version"]),
    getVersion("weasyprint", ["--version"]),
  ]);

  res.json({
    status: "ok",
    pandoc: pandocVersion,
    weasyprint: weasyprintVersion,
  });
});

// POST /convert/epub — JSON in, EPUB bytes out. Holds no credentials and
// fetches nothing: the caller sends the cover bytes and stores the result.
app.post("/convert/epub", requireAuth, parseJson, async (req, res) => {
  const invalid = validateCommon(req.body);
  if (invalid) return res.status(400).json({ error: invalid });

  const cover = decodeCover(req.body.cover);
  if (cover === undefined) {
    return res.status(400).json({
      error: "cover must be { base64, contentType } with a JPEG, PNG or WebP image",
    });
  }

  const { html, metadata, templateId } = req.body;
  await sendConverted(res, "application/epub+zip", "output.epub", async (outputPath) =>
    convertToEpub({
      html,
      metadata,
      templateCss: await readTemplateCss(templateId, { darkMode: true }),
      cover,
      outputPath,
    })
  );
});

// POST /convert/pdf — JSON in, PDF bytes out.
app.post("/convert/pdf", requireAuth, parseJson, async (req, res) => {
  const invalid = validateCommon(req.body);
  if (invalid) return res.status(400).json({ error: invalid });

  const { html, metadata, templateId, printSettings } = req.body;
  if (!printSettings || !printSettings.trimSize) {
    return res.status(400).json({
      error: "Missing required field: printSettings.trimSize",
    });
  }

  await sendConverted(res, "application/pdf", "output.pdf", async (outputPath) =>
    convertToPdf({
      html,
      metadata,
      templateCss: await readTemplateCss(templateId),
      printSettings,
      outputPath,
    })
  );
});

// Body-parser failures (too large, malformed JSON) as JSON, never the default
// HTML page with a stack trace. The body itself is never logged.
app.use((err, _req, res, _next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error("Unhandled error:", err.name);
  res.status(status).json({
    error: status === 413 ? "Request body too large" : status === 500 ? "Internal error" : "Bad request",
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`ManuHaven converter service running on port ${PORT}`);

  if (!CONVERTER_API_KEY) {
    console.warn(
      "WARNING: CONVERTER_API_KEY is not set. Authenticated endpoints will reject all requests."
    );
  }
});
