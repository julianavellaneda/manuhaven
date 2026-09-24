import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractJSON, validateWithSchema } from "@/lib/ai/validation";
import { InvalidResponseError } from "@/lib/ai/errors";

describe("extractJSON", () => {
  it("parses bare JSON", () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    const raw = '```json\n{"a":2}\n```';
    expect(extractJSON(raw)).toEqual({ a: 2 });
  });

  it("ignores preamble text", () => {
    expect(extractJSON('Sure! Here is: {"a":3}')).toEqual({ a: 3 });
  });

  it("handles strings containing braces", () => {
    expect(extractJSON('{"a":"has } brace"}')).toEqual({ a: "has } brace" });
  });

  it("throws on empty", () => {
    expect(() => extractJSON("")).toThrow(InvalidResponseError);
  });

  it("throws on no JSON", () => {
    expect(() => extractJSON("just text")).toThrow(InvalidResponseError);
  });
});

describe("validateWithSchema", () => {
  const schema = z.object({ n: z.number() });

  it("returns parsed data", () => {
    expect(validateWithSchema('{"n":5}', schema)).toEqual({ n: 5 });
  });

  it("throws InvalidResponseError on mismatch", () => {
    expect(() => validateWithSchema('{"n":"nope"}', schema)).toThrow(
      InvalidResponseError
    );
  });
});
