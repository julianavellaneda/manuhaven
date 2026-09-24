"use strict";

/**
 * A Pandoc or WeasyPrint run that failed. Carries only the tool name and how
 * it ended: the tools' stderr can echo manuscript text, so it is dropped here
 * and never reaches a log line or a response.
 */
class ConversionError extends Error {
  /**
   * @param {string} tool
   * @param {{ code?: number | string, signal?: string, killed?: boolean }} err
   */
  constructor(tool, err) {
    const how = err.killed
      ? "timed out"
      : err.signal
        ? `killed by ${err.signal}`
        : `exited with ${err.code}`;
    super(`${tool} ${how}`);
    this.name = "ConversionError";
  }
}

module.exports = { ConversionError };
