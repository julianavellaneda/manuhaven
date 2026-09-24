import { describe, it, expect } from "vitest";
import {
  EditorialReportSchema,
  StyleAnalysisSchema,
} from "@/lib/ai/editorial";

const validReport = {
  overallScore: 75,
  pacing: {
    score: 70,
    analysis: "Solid middle, soft opening.",
    slowSections: [{ chapter: 2, description: "Setup drags." }],
    fastSections: [{ chapter: 8, description: "Action sequence rushes." }],
  },
  characterArcs: [
    {
      character: "Mira",
      arc: "Reluctant hero.",
      consistency: 82,
      issues: [],
    },
  ],
  plotStructure: {
    actBreaks: [{ chapter: 5, description: "Inciting reveal." }],
    plotHoles: [],
    unresolved: [],
  },
  proseQuality: {
    overusedWords: [
      { word: "just", count: 47, suggestion: "Cut roughly half." },
    ],
    adverbDensity: 1.8,
    dialogueTagVariety: [{ tag: "said", count: 120 }],
    sentenceLengthVariation: {
      mean: 14.3,
      stddev: 5.1,
      monotonousSections: [],
    },
  },
  strengths: ["Strong voice", "Vivid setting", "Crisp dialogue"],
  suggestions: [
    {
      priority: "high",
      chapter: 2,
      description: "Tighten the opening.",
    },
  ],
};

describe("EditorialReportSchema", () => {
  it("accepts a complete report", () => {
    expect(EditorialReportSchema.parse(validReport)).toBeTruthy();
  });

  it("rejects scores outside 1-100", () => {
    expect(() =>
      EditorialReportSchema.parse({ ...validReport, overallScore: 150 })
    ).toThrow();
    expect(() =>
      EditorialReportSchema.parse({ ...validReport, overallScore: 0 })
    ).toThrow();
  });

  it("rejects empty strengths", () => {
    expect(() =>
      EditorialReportSchema.parse({ ...validReport, strengths: [] })
    ).toThrow();
  });

  it("rejects unknown suggestion priorities", () => {
    const bad = {
      ...validReport,
      suggestions: [
        { priority: "urgent", chapter: 1, description: "x" },
      ],
    };
    expect(() => EditorialReportSchema.parse(bad)).toThrow();
  });

  it("rejects chapter 0 anywhere", () => {
    const bad = {
      ...validReport,
      pacing: {
        ...validReport.pacing,
        slowSections: [{ chapter: 0, description: "x" }],
      },
    };
    expect(() => EditorialReportSchema.parse(bad)).toThrow();
  });
});

describe("StyleAnalysisSchema", () => {
  const validStyle = {
    genreAlignment: 80,
    toneProfile: {
      dominant: "tense",
      secondary: "wry",
      outlierChapters: [11],
    },
    readingLevel: { grade: 9.2, score: 72, comparison: "at" },
    paceProfile: [{ chapter: 1, pace: "moderate" }],
    styleMarkers: {
      dialogueRatio: 0.35,
      descriptionDensity: 0.25,
      actionDensity: 0.3,
      introspectionDensity: 0.1,
    },
    outlierPassages: [],
  };

  it("accepts a valid style report", () => {
    expect(StyleAnalysisSchema.parse(validStyle)).toBeTruthy();
  });

  it("rejects style markers outside 0-1", () => {
    const bad = {
      ...validStyle,
      styleMarkers: { ...validStyle.styleMarkers, dialogueRatio: 1.5 },
    };
    expect(() => StyleAnalysisSchema.parse(bad)).toThrow();
  });

  it("rejects unknown comparison values", () => {
    const bad = {
      ...validStyle,
      readingLevel: { ...validStyle.readingLevel, comparison: "unknown" },
    };
    expect(() => StyleAnalysisSchema.parse(bad)).toThrow();
  });
});
