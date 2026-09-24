import { BISAC_FICTION_CODES, type Genre } from "@/lib/constants";

const BISAC_LIST = BISAC_FICTION_CODES.map(
  (b) => `  ${b.code} — ${b.label}`
).join("\n");

const GENRE_LABELS: Record<Genre, string> = {
  romance: "romance",
  thriller: "thriller",
  fantasy: "fantasy",
  scifi: "science fiction",
  literary: "literary fiction",
  other: "fiction",
};

const SYSTEM_PROMPT = `You are a publishing metadata specialist helping an indie fiction author optimize their book for retail algorithm discovery. You generate data strictly from the manuscript content provided. You respond with valid JSON only — no preamble, no commentary, no markdown fences.`;

export interface MetadataPromptInput {
  genre: Genre;
  manuscriptText: string;
  strict?: boolean;
}

export function buildMetadataPrompt({
  genre,
  manuscriptText,
  strict = false,
}: MetadataPromptInput): { system: string; user: string } {
  const genreLabel = GENRE_LABELS[genre] ?? "fiction";

  const strictSuffix = strict
    ? `\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a single JSON object matching this exact shape, with no extra text:\n{"keywords":[7 strings],"bisacPrimary":"FIC######","bisacSecondary":"FIC######","tagline":"...","blurbShort":"...","blurbLong":"..."}`
    : "";

  const user = `This is the opening portion of a ${genreLabel} novel. Generate the following:

1. Seven Amazon search keywords (single words or short 2-word phrases, not the title or author name, optimized for reader search behavior).
2. BISAC primary category code — MUST be one of the codes listed below, copied exactly.
3. BISAC secondary category code — MUST also be one of the codes listed below, and must differ from the primary.

ALLOWED BISAC CODES (pick exactly two — primary and secondary — from this list and nowhere else):
${BISAC_LIST}

4. A tagline (under 20 words, hooks the reader immediately).
5. A 100-word back cover blurb (present tense, third person, ends on a hook).
6. A 250-word back cover blurb (same style, more detail and atmosphere).

Respond as a single JSON object with keys: keywords (array of 7 strings), bisacPrimary (string), bisacSecondary (string), tagline (string), blurbShort (string), blurbLong (string). No preamble, no explanation.${strictSuffix}

MANUSCRIPT:
${manuscriptText}`;

  return { system: SYSTEM_PROMPT, user };
}
