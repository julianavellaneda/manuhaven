import type { ChapterChunk } from "@/lib/ai/chunk-by-chapter";

const SYSTEM_PROMPT = `You are a senior fiction editor providing developmental and line-edit feedback. You read carefully, ground every observation in the manuscript text, and respond only with the JSON shape requested — no preamble, no commentary, no markdown fences.`;

// ---------------------------------------------------------------------------
// Pass 1 — per-chapter analysis (compact)
// ---------------------------------------------------------------------------

const CHAPTER_STRICT_NOTE = `\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a single JSON object with these fields: {"chapter": int, "pacingScore": int 1-100, "pace": "fast"|"moderate"|"slow", "pacingNote": str, "characters": [str], "proseNote": str, "overusedWords": [{"word": str, "count": int}], "adverbDensity": number, "dialogueTags": [{"tag": str, "count": int}], "avgSentenceLength": number, "sentenceLengthStddev": number, "monotonous": bool}`;

export interface PerChapterPromptInput {
  chapter: ChapterChunk;
  strict?: boolean;
}

export function buildPerChapterPrompt({
  chapter,
  strict = false,
}: PerChapterPromptInput): { system: string; user: string } {
  const strictSuffix = strict ? CHAPTER_STRICT_NOTE : "";
  const user = `Analyze the following chapter for an editorial report. Return a single JSON object with these fields:

- "chapter": ${chapter.index}
- "pacingScore": integer 1–100 (higher = better-paced for the genre)
- "pace": "fast" | "moderate" | "slow"
- "pacingNote": one-sentence diagnosis of the pacing
- "characters": array of named characters who appear in this chapter (canonical names)
- "proseNote": one-sentence diagnosis of prose quality (voice, rhythm, clarity)
- "overusedWords": up to 5 noticeable repeats: [{"word", "count"}]
- "adverbDensity": adverbs per 100 words (number, can be fractional)
- "dialogueTags": up to 5 dialogue tags used: [{"tag", "count"}] (e.g. "said", "whispered")
- "avgSentenceLength": average words per sentence
- "sentenceLengthStddev": standard deviation of sentence lengths
- "monotonous": boolean — true if sentence rhythm feels monotonous in this chapter

Return JSON only — no preamble, no markdown.${strictSuffix}

CHAPTER ${chapter.index}: ${chapter.title}
${chapter.text}`;
  return { system: SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Pass 2 — synthesis into EditorialReport
// ---------------------------------------------------------------------------

const SYNTH_STRICT_NOTE = `\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a single JSON object matching the EditorialReport schema described above.`;

export interface SynthesisPromptInput {
  /** Compact per-chapter analyses produced by pass 1. */
  chapterAnalyses: unknown[];
  /** Genre label, e.g. "thriller", "romance". */
  genreLabel: string;
  strict?: boolean;
}

export function buildSynthesisPrompt({
  chapterAnalyses,
  genreLabel,
  strict = false,
}: SynthesisPromptInput): { system: string; user: string } {
  const strictSuffix = strict ? SYNTH_STRICT_NOTE : "";
  const user = `You have per-chapter analyses (JSON array below) for a ${genreLabel} novel. Produce a final editorial report as a single JSON object with this exact shape:

{
  "overallScore": int 1-100,
  "pacing": {
    "score": int 1-100,
    "analysis": str,
    "slowSections": [{"chapter": int, "description": str}],
    "fastSections": [{"chapter": int, "description": str}]
  },
  "characterArcs": [{"character": str, "arc": str, "consistency": int 1-100, "issues": [str]}],
  "plotStructure": {
    "actBreaks": [{"chapter": int, "description": str}],
    "plotHoles": [str],
    "unresolved": [str]
  },
  "proseQuality": {
    "overusedWords": [{"word": str, "count": int, "suggestion": str}],
    "adverbDensity": number,
    "dialogueTagVariety": [{"tag": str, "count": int}],
    "sentenceLengthVariation": {
      "mean": number,
      "stddev": number,
      "monotonousSections": [{"chapter": int, "description": str}]
    }
  },
  "strengths": [str] (3 to 5 items),
  "suggestions": [{"priority": "high"|"medium"|"low", "chapter": int, "description": str}]
}

Use 1-indexed chapter numbers (matching the "chapter" field in the analyses). Aggregate prose stats by averaging or summing the per-chapter values. Identify slow/fast sections from the pace + pacingScore fields. Infer character arcs by tracking which named characters appear across chapters and what shifts in their portrayal. Be specific and grounded — every observation should map to chapter data.

Return JSON only — no preamble, no markdown.${strictSuffix}

PER-CHAPTER ANALYSES:
${JSON.stringify(chapterAnalyses)}`;
  return { system: SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Pass 3 — style & tone
// ---------------------------------------------------------------------------

const STYLE_STRICT_NOTE = `\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a single JSON object matching the StyleAnalysis schema described above.`;

export interface StylePromptInput {
  chapterAnalyses: unknown[];
  genreLabel: string;
  strict?: boolean;
}

export function buildStylePrompt({
  chapterAnalyses,
  genreLabel,
  strict = false,
}: StylePromptInput): { system: string; user: string } {
  const strictSuffix = strict ? STYLE_STRICT_NOTE : "";
  const user = `You have per-chapter prose analyses (JSON array below) for a ${genreLabel} novel. Produce a style and tone report as a single JSON object with this exact shape:

{
  "genreAlignment": int 1-100,
  "toneProfile": {
    "dominant": str,
    "secondary": str,
    "outlierChapters": [int]
  },
  "readingLevel": {
    "grade": number,
    "score": number,
    "comparison": "above"|"at"|"below"
  },
  "paceProfile": [{"chapter": int, "pace": "fast"|"moderate"|"slow"}],
  "styleMarkers": {
    "dialogueRatio": number 0-1,
    "descriptionDensity": number 0-1,
    "actionDensity": number 0-1,
    "introspectionDensity": number 0-1
  },
  "outlierPassages": [{"chapter": int, "startParagraph": int, "issue": str, "suggestion": str}]
}

"genreAlignment" measures how well the prose matches conventions of the ${genreLabel} genre. "comparison" is relative to typical ${genreLabel} reading level. "outlierChapters" are chapters whose tone diverges noticeably from the dominant tone. Estimate density values from the per-chapter notes. Up to 5 outlier passages.

Use 1-indexed chapters. Return JSON only — no preamble, no markdown.${strictSuffix}

PER-CHAPTER ANALYSES:
${JSON.stringify(chapterAnalyses)}`;
  return { system: SYSTEM_PROMPT, user };
}
