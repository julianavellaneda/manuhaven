// Fixed AI results for the demo copy of Pride and Prejudice, so the seed
// needs no API key. Chapters are numbered 1–61 straight through, as the demo
// manuscript is (volume II starts at 24, volume III at 43).

import type { StoryBible } from "@/lib/ai/continuity";
import type { EditorialReport, StyleAnalysis } from "@/lib/ai/editorial";
import type { AIMetadataResult } from "@/lib/ai/metadata";

export const EDITORIAL_REPORT: EditorialReport = {
  overallScore: 91,
  pacing: {
    score: 84,
    analysis:
      "The novel moves in three movements, each ending on a reversal: the Netherfield ball and Charlotte's engagement, Darcy's first proposal and letter, and Lydia's elopement. Social set pieces keep the pace brisk, but the middle of volume II slows while Elizabeth is at Hunsford, and the Lydia subplot delays the resolution by several chapters.",
    slowSections: [
      {
        chapter: 27,
        description:
          "The journey to Hunsford is mostly logistics; the chapter could be folded into the arrival.",
      },
      {
        chapter: 39,
        description:
          "The Brighton plans repeat information the reader already has from Lydia's earlier scenes.",
      },
    ],
    fastSections: [
      {
        chapter: 34,
        description:
          "Darcy's proposal and Elizabeth's refusal land in a single, very tight scene.",
      },
      {
        chapter: 46,
        description:
          "News of the elopement arrives and Elizabeth leaves Lambton within pages.",
      },
    ],
  },
  characterArcs: [
    {
      character: "Elizabeth Bennet",
      arc: "From confident first judgements to the recognition, after Darcy's letter, that she has been 'blind, partial, prejudiced, absurd'.",
      consistency: 95,
      issues: [],
    },
    {
      character: "Fitzwilliam Darcy",
      arc: "From aloof pride to open, practical kindness, shown rather than told through his conduct at Pemberley and in London.",
      consistency: 92,
      issues: [
        "His change of manner at Pemberley (ch. 43) is abrupt from Elizabeth's point of view; one earlier hint would soften it.",
      ],
    },
    {
      character: "Jane Bennet",
      arc: "Steady throughout; her restraint is what nearly costs her Bingley.",
      consistency: 90,
      issues: [],
    },
    {
      character: "George Wickham",
      arc: "Charming newcomer revealed as a fortune hunter.",
      consistency: 86,
      issues: [
        "His openness with Elizabeth about Darcy on first meeting (ch. 16) is convenient; a line on why he trusts her would help.",
      ],
    },
  ],
  plotStructure: {
    actBreaks: [
      { chapter: 23, description: "End of volume I: Bingley gone, Charlotte engaged to Mr. Collins." },
      { chapter: 35, description: "Darcy's letter: the midpoint reversal of Elizabeth's judgement." },
      { chapter: 46, description: "Lydia's elopement: the crisis that tests every relationship." },
    ],
    plotHoles: [],
    unresolved: [
      "Kitty's future is mentioned only in passing in the final chapter.",
    ],
  },
  proseQuality: {
    overusedWords: [
      { word: "very", count: 1204, suggestion: "Cut about a third; most instances add nothing to the adjective." },
      { word: "felt", count: 216, suggestion: "In dialogue-heavy scenes, let the reply show the feeling." },
      { word: "immediately", count: 94, suggestion: "Vary with 'at once' or restructure the sentence." },
    ],
    adverbDensity: 2.8,
    dialogueTagVariety: [
      { tag: "said", count: 604 },
      { tag: "replied", count: 207 },
      { tag: "cried", count: 196 },
      { tag: "answered", count: 44 },
    ],
    sentenceLengthVariation: {
      mean: 24.6,
      stddev: 15.1,
      monotonousSections: [
        {
          chapter: 36,
          description:
            "Elizabeth's reflection on the letter runs in long, similar sentences; one short line would give it a turn.",
        },
      ],
    },
  },
  strengths: [
    "Dialogue carries character: nobody in the book sounds like anybody else.",
    "The free indirect style lets irony and sympathy sit in the same sentence.",
    "Every set piece, from the Meryton assembly to Lady Catherine's visit, changes a relationship.",
    "The letter in chapter 35 turns the plot and the heroine at once.",
  ],
  suggestions: [
    {
      priority: "high",
      chapter: 43,
      description:
        "Give Darcy one small, earlier act of consideration so his warmth at Pemberley reads as revealed, not changed.",
    },
    {
      priority: "medium",
      chapter: 27,
      description: "Compress the Hunsford journey into the opening of chapter 28.",
    },
    {
      priority: "low",
      chapter: 61,
      description: "A line more on Kitty would close her thread.",
    },
  ],
};

export const STYLE_ANALYSIS: StyleAnalysis = {
  genreAlignment: 88,
  toneProfile: {
    dominant: "Ironic",
    secondary: "Warm",
    outlierChapters: [35, 46],
  },
  readingLevel: { grade: 10.4, score: 61.2, comparison: "above" },
  paceProfile: Array.from({ length: 61 }, (_, i) => {
    const chapter = i + 1;
    const fast = [3, 18, 19, 34, 35, 46, 47, 56, 58];
    const slow = [7, 27, 28, 37, 39, 52, 60];
    return {
      chapter,
      pace: fast.includes(chapter)
        ? ("fast" as const)
        : slow.includes(chapter)
          ? ("slow" as const)
          : ("moderate" as const),
    };
  }),
  styleMarkers: {
    dialogueRatio: 0.46,
    descriptionDensity: 0.12,
    actionDensity: 0.14,
    introspectionDensity: 0.28,
  },
  outlierPassages: [
    {
      chapter: 35,
      startParagraph: 3,
      issue: "Darcy's letter shifts to a formal first-person register for several pages.",
      suggestion: "Intentional and effective; keep it, but break it once with Elizabeth's reaction.",
    },
  ],
};

export const STORY_BIBLE: StoryBible = {
  characters: [
    {
      name: "Elizabeth Bennet",
      aliases: ["Lizzy", "Eliza"],
      description: "Second of the five Bennet sisters; quick, playful and sure of her judgement.",
      physicalTraits: [{ trait: "eyes", value: "fine, dark", firstMention: 6 }],
      relationships: [
        { character: "Jane Bennet", type: "sister and confidante", since: 1 },
        { character: "Fitzwilliam Darcy", type: "antagonist, then love interest", since: 3 },
        { character: "Charlotte Lucas", type: "close friend", since: 5 },
      ],
      firstAppearance: 1,
      lastAppearance: 61,
    },
    {
      name: "Fitzwilliam Darcy",
      aliases: ["Mr. Darcy"],
      description: "Master of Pemberley, with ten thousand a year; reserved and proud in company.",
      physicalTraits: [{ trait: "figure", value: "tall, handsome, noble mien", firstMention: 3 }],
      relationships: [
        { character: "Charles Bingley", type: "close friend", since: 3 },
        { character: "Georgiana Darcy", type: "sister and ward", since: 16 },
        { character: "George Wickham", type: "estranged childhood companion", since: 15 },
      ],
      firstAppearance: 3,
      lastAppearance: 61,
    },
    {
      name: "Jane Bennet",
      aliases: [],
      description: "Eldest Bennet sister; beautiful, gentle, slow to think ill of anyone.",
      physicalTraits: [],
      relationships: [{ character: "Charles Bingley", type: "suitor", since: 3 }],
      firstAppearance: 2,
      lastAppearance: 61,
    },
    {
      name: "Charles Bingley",
      aliases: [],
      description: "Amiable young man who takes Netherfield Park.",
      physicalTraits: [],
      relationships: [{ character: "Caroline Bingley", type: "sister", since: 3 }],
      firstAppearance: 3,
      lastAppearance: 61,
    },
    {
      name: "George Wickham",
      aliases: [],
      description: "Militia officer with easy manners and a grievance against Darcy.",
      physicalTraits: [],
      relationships: [{ character: "Lydia Bennet", type: "elopes with, then marries", since: 46 }],
      firstAppearance: 15,
      lastAppearance: 61,
    },
    {
      name: "William Collins",
      aliases: ["Mr. Collins"],
      description: "Clergyman, heir to Longbourn, devoted to his patroness.",
      physicalTraits: [{ trait: "build", value: "tall, heavy-looking", firstMention: 13 }],
      relationships: [{ character: "Charlotte Lucas", type: "marries", since: 22 }],
      firstAppearance: 13,
      lastAppearance: 57,
    },
  ],
  locations: [
    {
      name: "Longbourn",
      description: "The Bennet family home in Hertfordshire, entailed on Mr. Collins.",
      details: [{ detail: "One mile from Meryton", firstMention: 7 }],
    },
    {
      name: "Netherfield Park",
      description: "Large house near Longbourn, let by Mr. Bingley.",
      details: [{ detail: "Site of the ball", firstMention: 18 }],
    },
    {
      name: "Rosings Park",
      description: "Lady Catherine de Bourgh's estate in Kent, beside the Hunsford parsonage.",
      details: [],
    },
    {
      name: "Pemberley",
      description: "Darcy's estate in Derbyshire.",
      details: [{ detail: "Stands on rising ground across a valley, with a stream before it", firstMention: 43 }],
    },
  ],
  timeline: [
    { event: "Bingley takes Netherfield", chapter: 1, relativeTime: "Michaelmas" },
    { event: "The Meryton assembly", chapter: 3, relativeTime: "Autumn" },
    { event: "The Netherfield ball", chapter: 18, relativeTime: "26 November" },
    { event: "Darcy's first proposal", chapter: 34, relativeTime: "Easter, the following spring" },
    { event: "Elizabeth visits Pemberley", chapter: 43, relativeTime: "Summer" },
    { event: "Lydia elopes with Wickham", chapter: 46, relativeTime: "August" },
    { event: "Darcy's second proposal", chapter: 58, relativeTime: "Autumn" },
  ],
  inconsistencies: [
    {
      type: "timeline",
      description:
        "Mrs. Bennet says Bingley arrives 'before Michaelmas', but the officers' winter quarters imply a later date; worth one clarifying line.",
      chapters: [1, 7],
      severity: "warning",
    },
  ],
};

export const METADATA: AIMetadataResult = {
  keywords: [
    "regency romance",
    "enemies to lovers",
    "classic literature",
    "comedy of manners",
    "sisters",
    "english countryside",
    "marriage plot",
  ],
  bisacPrimary: "FIC004000",
  bisacSecondary: "FIC027000",
  tagline: "It is a truth universally acknowledged that first impressions are usually wrong.",
  blurbShort:
    "Elizabeth Bennet has no fortune, four sisters to marry off, and a talent for seeing through people. So when the proud Mr. Darcy slights her at a country ball, she knows exactly what he is. She is wrong.",
  blurbLong:
    "Elizabeth Bennet has no fortune, four sisters to marry off, a mother determined to do it, and a talent for seeing through people. When wealthy Mr. Bingley takes the great house nearby, her gentle sister Jane catches his eye, and his friend Mr. Darcy catches Elizabeth's contempt. Darcy is proud, rude and rich; the charming officer George Wickham has a story about him that confirms every opinion she has formed. Then Darcy proposes, and a single letter makes her question everything she thought she knew. A comedy of manners, a love story, and the most famous first line in English fiction.",
};

export const ASSISTANT_CONVERSATION: {
  title: string;
  messages: { role: "user" | "assistant"; content: { text: string } }[];
} = {
  title: "Darcy at Pemberley",
  messages: [
    {
      role: "user",
      content: {
        text: "Does Darcy's change of manner at Pemberley feel earned, or too sudden?",
      },
    },
    {
      role: "assistant",
      content: {
        text: "Mostly earned, because the reader has Darcy's letter (chapter 35) and Mrs. Reynolds's praise (chapter 43) before he appears. The risk is that Elizabeth has seen none of his kindness first-hand before chapter 43.\n\nTwo options that keep your structure:\n\n1. In chapter 40, let Elizabeth hear from Jane that Darcy's servants speak well of him.\n2. In chapter 43, let him reach Elizabeth only after she has seen how he treats his tenants.\n\nEither gives her something to see, not just be told.",
      },
    },
    {
      role: "user",
      content: { text: "Where does Wickham first mention Darcy to her?" },
    },
    {
      role: "assistant",
      content: {
        text: "Chapter 16, at the Philipses' card party. He raises Pemberley himself and tells the story of the lost living within the same conversation, which is quick trust for a first meeting; Elizabeth notices this herself in chapter 36.",
      },
    },
  ],
};
