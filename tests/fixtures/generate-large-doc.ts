/**
 * Generates a ~100K-word Tiptap JSON manuscript fixture in memory. Seeded, so
 * the document is identical on every call and every machine.
 */

// --- Sentence pools (varied, prose-like) ---

const openers = [
  "The morning light filtered through the curtains, casting long amber shadows across the wooden floor.",
  "She stood at the window and watched the rain slide down the glass in thin, trembling lines.",
  "He had not slept well, and the dark circles under his eyes told a story he preferred to keep silent.",
  "Somewhere in the distance a church bell rang, its sound swallowed by the low grey clouds.",
  "The letter had arrived three days ago, but she had not yet found the courage to open it.",
  "They walked together along the riverbank, their footsteps leaving shallow prints in the wet earth.",
  "A cold wind pressed against the house, rattling the shutters and sending leaves spiraling across the yard.",
  "The café was nearly empty at this hour, only a single patron hunched over a cup of black coffee.",
  "He turned the key in the lock and pushed the door open into the darkness of the hallway.",
  "The garden had grown wild in the months since anyone had tended it, a tangle of weeds and forgotten blooms.",
  "She opened the notebook and stared at the blank page, waiting for the words to come.",
  "The train pulled away from the station with a low metallic groan, leaving the platform deserted.",
  "It was the kind of evening that made you want to sit on the porch and say nothing at all.",
  "The old house creaked as if it remembered things its walls had witnessed over the decades.",
  "He poured himself a glass of water and sat down at the kitchen table, staring at his hands.",
];

const middles = [
  "There was a stillness in the air that felt deliberate, as though the world itself were holding its breath.",
  "She thought of her mother then, the way she used to hum while folding laundry on Sunday mornings.",
  "The road ahead curved sharply to the left, disappearing behind a stand of silver birch trees.",
  "He could not shake the feeling that someone had been watching from across the street.",
  "The floorboards groaned under her weight as she crossed the room to the bookshelf.",
  "Outside, the streetlamps flickered on one by one, their orange glow pooling on the wet asphalt.",
  "She had always believed that silence was a kind of language, one most people never learned to speak.",
  "The clock on the mantelpiece ticked steadily, measuring out the seconds with indifferent precision.",
  "He folded the newspaper and set it aside, unable to concentrate on the words any longer.",
  "There was something about the way the shadows fell in the late afternoon that reminded her of childhood.",
  "The wind picked up again, carrying with it the scent of pine and damp earth from the hills beyond.",
  "A dog barked somewhere down the lane, its voice sharp and insistent against the evening quiet.",
  "She reached for her coat and paused, her fingers brushing the fabric as if reconsidering.",
  "The conversation had ended badly, and neither of them had known how to repair the silence that followed.",
  "He watched the fire die down to embers, each one glowing with a stubborn, fading heat.",
  "The room smelled of old paper and cedar, a scent that clung to everything like a gentle memory.",
  "She could hear the distant murmur of voices from the next room, though she could not make out the words.",
  "The horizon was a thin bruise of purple and grey, the last traces of daylight retreating westward.",
  "He closed his eyes and tried to recall the exact shade of blue the sky had been that morning.",
  "There were days when the weight of everything felt manageable, and then there were days like this one.",
];

const closers = [
  "But that was a long time ago now, and the world had moved on without waiting for her to catch up.",
  "He knew, even then, that nothing would ever be quite the same again.",
  "And yet the silence persisted, thick and unyielding, filling every corner of the room.",
  "She turned away from the window and let the curtain fall back into place.",
  "It was not an answer, exactly, but it was the closest thing to one she was likely to get.",
  "The thought settled in his mind like a stone dropped into still water, sending out slow, quiet ripples.",
  "She did not look back as she walked toward the door, though every part of her wanted to.",
  "The night stretched ahead of him, long and formless, with nothing to mark one hour from the next.",
  "And so they sat there, the two of them, letting the evening fold itself around them like a blanket.",
  "It was the kind of truth that could only be spoken once, and never taken back.",
  "Somewhere a door closed softly, and the house settled into its familiar, creaking silence.",
  "She pressed her palm flat against the cold glass and felt the tremor of the wind outside.",
  "He did not know what he had expected, but it was not this quiet, persistent ache.",
  "The stars emerged slowly overhead, each one a small, steady fire against the vast indifference of the dark.",
  "And with that, the day was over, unremarkable in every way except the one that mattered most.",
];

// --- Helpers ---

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

let rand = seededRandom(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string }[];
}

function textNode(text: string, marks?: { type: string }[]): TiptapNode {
  const node: TiptapNode = { type: "text", text };
  if (marks) node.marks = marks;
  return node;
}

function paragraphNode(sentences: string[]): TiptapNode {
  const content: TiptapNode[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const r = rand();

    if (r < 0.08 && sentence.length > 10) {
      // Bold a phrase
      const words = sentence.split(" ");
      const start = randomInt(0, Math.max(0, words.length - 4));
      const len = randomInt(2, 4);
      const before = words.slice(0, start).join(" ");
      const bold = words.slice(start, start + len).join(" ");
      const after = words.slice(start + len).join(" ");

      if (before) content.push(textNode(before + " "));
      content.push(textNode(bold, [{ type: "bold" }]));
      if (after) content.push(textNode(" " + after));
    } else if (r < 0.15 && sentence.length > 10) {
      // Italic a phrase
      const words = sentence.split(" ");
      const start = randomInt(0, Math.max(0, words.length - 3));
      const len = randomInt(2, 3);
      const before = words.slice(0, start).join(" ");
      const italic = words.slice(start, start + len).join(" ");
      const after = words.slice(start + len).join(" ");

      if (before) content.push(textNode(before + " "));
      content.push(textNode(italic, [{ type: "italic" }]));
      if (after) content.push(textNode(" " + after));
    } else {
      content.push(textNode(sentence));
    }

    if (i < sentences.length - 1) {
      // Add space between sentences
      content.push(textNode(" "));
    }
  }

  return { type: "paragraph", content };
}

function headingNode(text: string, level: number): TiptapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [textNode(text)],
  };
}

function horizontalRuleNode(): TiptapNode {
  return { type: "horizontalRule" };
}

function generateParagraph(): TiptapNode {
  const sentenceCount = randomInt(5, 10);
  const sentences: string[] = [];
  sentences.push(pick(openers));
  for (let i = 1; i < sentenceCount - 1; i++) {
    sentences.push(pick(middles));
  }
  if (sentenceCount > 1) {
    sentences.push(pick(closers));
  }
  return paragraphNode(sentences);
}

function generateChapter(chapterNumber: number): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  nodes.push(headingNode(`Chapter ${chapterNumber}`, 1));

  const paragraphCount = randomInt(36, 44);
  for (let i = 0; i < paragraphCount; i++) {
    nodes.push(generateParagraph());

    // Occasional scene break (horizontal rule) between paragraphs
    if (i > 0 && i < paragraphCount - 1 && rand() < 0.12) {
      nodes.push(horizontalRuleNode());
    }
  }

  return nodes;
}

// --- Main ---

export function generateLargeManuscript(): TiptapNode {
  // Reseed so every call returns the same document.
  rand = seededRandom(42);

  const content: TiptapNode[] = [];
  for (let ch = 1; ch <= 20; ch++) {
    content.push(...generateChapter(ch));
  }

  return { type: "doc", content };
}
