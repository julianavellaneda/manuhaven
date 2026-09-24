/**
 * Generates "The Weight of Quiet Hours" — a ~25K-word test manuscript.
 *
 * Outputs:
 *   tests/fixtures/manuscripts/test-manuscript.json  (Tiptap JSON)
 *   tests/fixtures/manuscripts/test-manuscript.txt   (plain text)
 *   tests/fixtures/manuscripts/test-manuscript.docx  (Word document)
 *
 * Run with: bunx tsx tests/fixtures/manuscripts/generate-test-manuscript.ts
 *
 * Planted features for AI pipeline testing:
 *   - 4 named characters with intentional gaps (Daniel absent Ch 4–8)
 *   - 4 named locations, one described inconsistently (Alderman estate)
 *   - Timeline error: Ch 3 "Tuesday", Ch 4 "three days later on Thursday"
 *   - Overused words: "suddenly", "just", "carefully" scattered throughout
 *   - Adverb spike in Ch 4–5
 *   - Monotonous sentence length in Ch 6
 *   - Slow pacing Ch 4–5, fast pacing Ch 8–9
 *   - Dialogue tag variety: "said/asked" dominant in Ch 1–4, varied later
 */

import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
} from "docx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TiptapTextNode {
  type: "text";
  text: string;
  marks?: { type: string }[];
}

interface TiptapElementNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
}

type TiptapNode = TiptapTextNode | TiptapElementNode;

interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

// ---------------------------------------------------------------------------
// Tiptap helpers
// ---------------------------------------------------------------------------

function t(text: string, marks?: { type: string }[]): TiptapTextNode {
  const node: TiptapTextNode = { type: "text", text };
  if (marks?.length) node.marks = marks;
  return node;
}

function bold(text: string): TiptapTextNode {
  return t(text, [{ type: "bold" }]);
}

function italic(text: string): TiptapTextNode {
  return t(text, [{ type: "italic" }]);
}

function para(...nodes: TiptapNode[]): TiptapElementNode {
  return { type: "paragraph", content: nodes };
}

function h1(text: string): TiptapElementNode {
  return {
    type: "heading",
    attrs: { level: 1 },
    content: [t(text)],
  };
}

function hr(): TiptapElementNode {
  return { type: "horizontalRule" };
}

// ---------------------------------------------------------------------------
// Fill prose pools (for generated bulk paragraphs in Ch 4–7)
// ---------------------------------------------------------------------------

const FILL_OPENERS = [
  "The morning arrived with its usual indifference, grey light pressing against the windowpane.",
  "She had barely slept, and the world outside felt thin and unconvincing.",
  "The hours stretched ahead of her without definition, each one identical to the last.",
  "A low hum came from the vents above her desk, steady and unremarkable.",
  "The coffee had gone cold at some point, though she hadn't noticed until now.",
  "Papers covered every surface of the small office, an archaeology of abandoned leads.",
  "She ran her fingers along the spine of the notebook, thinking about nothing in particular.",
  "The sound of traffic filtered up from the street six floors below.",
  "He sat by the window for a long time without moving, watching the light change.",
  "Outside, a pigeon landed on the ledge and regarded her with one flat orange eye.",
  "The ceiling fan turned slowly, stirring the air without cooling it.",
  "Her reflection in the darkened monitor looked unfamiliar, as if it belonged to someone else.",
  "The hallway beyond the glass partition was empty at this hour.",
  "She had left the lamp on all night without meaning to.",
  "The drawer stuck when she pulled it open, as it always did.",
];

const FILL_MIDDLES = [
  "There was a familiar dissatisfaction in the silence, one she had stopped trying to name.",
  "She turned a page without reading it, her eyes moving over the words without absorbing them.",
  "The folder on her desk contained nothing she hadn't already memorized.",
  "Somewhere beyond the building a siren wailed and faded and was gone.",
  "She thought about calling someone, but couldn't decide who.",
  "The fluorescent light buzzed faintly, a sound she usually managed to ignore.",
  "He refilled his coffee without speaking, setting the pot back on the burner with a soft click.",
  "The spreadsheet on her screen blinked its cursor at her, patient and blank.",
  "There were decisions she needed to make, and she was not ready to make them.",
  "The elevator doors opened and closed in the hallway without anyone entering or leaving.",
  "She had been in this building long enough that its rhythms felt like her own heartbeat.",
  "The air tasted of recycled nothing, the same as it always did at this hour.",
  "He checked his phone again and put it back in his pocket without responding.",
  "The walls held the particular yellow of offices that had stopped being repainted years ago.",
  "She read the same paragraph three times and understood it less each time.",
  "Outside, the day was doing whatever the day does when no one is paying attention.",
  "A stapler. A mug. A framed photograph facing away from her.",
  "She had started this line of thinking before and knew where it ended, which was nowhere.",
  "The window gave onto a narrow alley and the grey back of another building.",
  "He stood at the corner of the room for a moment, as if he had forgotten why he'd come in.",
];

const FILL_CLOSERS = [
  "She exhaled slowly and let the thought go.",
  "He turned away from the window and sat back down.",
  "There was nothing to do but wait, so she waited.",
  "The silence returned, and she let it.",
  "It was not the right question. She filed it away for later.",
  "None of it mattered yet. Or perhaps all of it did.",
  "She closed the folder and set it on top of the pile.",
  "The afternoon wore on, indifferent to her.",
  "He said nothing, which was its own kind of answer.",
  "She made a note and underlined it, though she wasn't sure why.",
  "It was enough, for now, to simply be present in the room.",
  "The hours passed. She let them.",
];

// Seeded random for reproducibility
let _seed = 137;
function rand(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function fillParagraph(): TiptapElementNode {
  const sentences: string[] = [];
  sentences.push(pick(FILL_OPENERS));
  const mid = randInt(3, 6);
  for (let i = 0; i < mid; i++) sentences.push(pick(FILL_MIDDLES));
  sentences.push(pick(FILL_CLOSERS));
  return para(t(sentences.join(" ")));
}

// Monotonous fill for Ch 6 — all sentences ~18 words
const MONO_SENTENCES = [
  "She walked down the corridor with careful, measured steps, counting each one under her breath.",
  "The door at the end was exactly the same as every other door she had passed.",
  "Ruth stood by the window with her hands clasped, watching the street below with quiet attention.",
  "Elena crossed the room and stood beside the desk, placing her notebook on the surface.",
  "The papers there were arranged in neat, deliberate piles, each one labeled in small clear letters.",
  "She picked up the first folder and opened it, reading the first line without expression.",
  "Ruth did not turn around, but Elena could see the slight tension in her silver-streaked shoulders.",
  "The clock on the wall moved with its usual precision, marking the seconds without sympathy.",
  "Elena set the folder down and moved to the next, reading each page with careful thoroughness.",
  "The window behind Ruth framed the grey afternoon sky, flat and featureless and unchanging.",
  "She finished the last page and closed the folder, returning it carefully to its original position.",
  "Ruth finally turned, and her grey-streaked hair caught the pale light from the tall window.",
  "Elena met her gaze without blinking, holding the silence between them with deliberate patience.",
  "The room had the quality of a space that had seen many such meetings and remembered none.",
  "She asked the question she had come to ask, and waited for the answer she already knew.",
  "Ruth considered the question for a long moment before answering it with another question.",
  "Elena wrote the answer down in her notebook, keeping her handwriting careful and controlled.",
  "The afternoon light shifted slightly, and the shadows on the floor moved with it.",
  "They continued this way for some time, question and answer, answer and question, filling the room.",
  "When it was over, Elena closed her notebook and stood, thanking Ruth for her time.",
];

function monoParagraph(idx: number): TiptapElementNode {
  const sentence = MONO_SENTENCES[idx % MONO_SENTENCES.length];
  return para(t(sentence));
}

// Adverb-heavy fill for Ch 4–5
const ADVERB_FILL = [
  "She walked carefully down the hallway, quietly checking each door as she passed.",
  "He spoke softly, deliberately choosing words that would not accidentally reveal too much.",
  "Elena carefully placed the folder back, smoothly closing the drawer without making a sound.",
  "She suddenly realized she had been holding her breath, and slowly let it out again.",
  "He moved cautiously through the room, carefully avoiding the loose floorboard by the window.",
  "She quickly scanned the pages, rapidly noting anything that seemed remotely relevant.",
  "He nodded slowly, deliberately taking his time before finally giving her a straight answer.",
  "Elena carefully composed her expression, steadily meeting his gaze without blinking nervously.",
  "She softly closed the door behind her and quietly stood in the empty hallway.",
  "He carefully considered his options, methodically weighing each one before reluctantly deciding.",
  "She rapidly typed the address into her phone, hurriedly dropping it back into her coat pocket.",
  "He spoke quietly, carefully framing each sentence so it couldn't easily be misunderstood.",
  "She gently set down the cup and slowly pushed back her chair.",
  "He carefully folded the letter, neatly pressing each crease before silently handing it back.",
  "She suddenly felt the weight of everything pressing quietly but insistently against her chest.",
];

function adverbParagraph(idx: number): TiptapElementNode {
  const sentence = ADVERB_FILL[idx % ADVERB_FILL.length];
  return para(t(sentence));
}

// Fast-pacing fill for Ch 8–9 (short punchy sentences)
const FAST_FILL = [
  "She ran. The alley was dark. Her footsteps echoed.",
  "Glass somewhere. A shout. She didn't look back.",
  "The door. Locked. She hit it with her shoulder anyway.",
  "Rain now. Cold and sudden. She kept moving.",
  "He was behind her. She could feel it. She didn't slow down.",
  "Left. Right. Another alley. The harbor smell hit her hard.",
  "Lights ahead. She ran toward them.",
  "Her phone buzzed. She ignored it. Later.",
  "The fence. She grabbed it. Climbed.",
  "Landed hard. Kept going.",
  "The water was close now. She could hear it.",
  "A door open. Light inside. She went in.",
];

function _fastParagraph(idx: number): TiptapElementNode {
  return para(t(FAST_FILL[idx % FAST_FILL.length]));
}

// ---------------------------------------------------------------------------
// Chapter content — hand-crafted skeletons
// ---------------------------------------------------------------------------

function chapter1(): TiptapNode[] {
  return [
    h1("Chapter 1: The Assignment"),
    para(
      t("Elena Marsh had dark, curly hair and green eyes that missed very little. She had worked at "),
      bold("The Herald"),
      t(" for eleven years, long enough to know which editors would protect her sources and which would not. Ruth Alderman was the latter, which was why Elena had learned to say less in their weekly meetings than she actually knew.")
    ),
    para(t("The newsroom on the sixth floor of the Herald building was the kind of place that looked chaotic from the outside but ran on its own internal logic. Desks faced each other in pairs. Coffee mugs claimed territories. The sound of keyboards was constant, rhythmic, almost comforting. Elena had a desk by the window, which she had protected jealously for three years.")),
    para(t("It was a Monday in November, cold enough to see your breath on the walk from the subway, warm enough inside the building that she carried her coat over her arm. She had two open stories and a deadline she was pretending was further away than it was.")),
    para(
      t('"Morning," said '),
      italic("Tommy Reyes"),
      t(', dropping a coffee on her desk without stopping. He was twenty-four, new, and already better at certain things than she had been at that age. She didn\'t hold it against him.')
    ),
    para(t('"Morning," she said. She pulled the coffee toward her without looking up.')),
    para(t("The email from Ruth arrived at nine-seventeen. It said: \"My office. Ten o'clock.\" No subject line. No context. Elena read it twice, then closed her laptop and went to find more coffee.")),
    para(t("Ruth Alderman's office was at the end of a short corridor, separated from the newsroom by a glass partition that was supposed to be transparent but never quite felt that way. The door was always open, which everyone understood to mean that it was never truly open.")),
    para(t('"Close the door," Ruth said, when Elena appeared in the doorframe.')),
    para(t("Elena closed the door and sat down in one of the chairs across from the desk. Ruth was writing something longhand on a yellow legal pad, the kind of affectation that Elena had long ago stopped finding charming.")),
    para(t('"The Alderman story," Ruth said, without looking up.')),
    para(t('"What about it?" Elena said.')),
    para(t('"It\'s yours. Exclusively. No shared byline, no oversight from the metro desk. You report directly to me." Ruth set down her pen and looked at her. "And you don\'t talk to anyone about what you find until you talk to me first."')),
    para(t("Elena kept her expression neutral. She had learned this from watching Ruth herself, years ago, before she understood what she was watching.")),
    para(t('"I thought the Alderman story was dead," Elena said.')),
    para(t('"It was. Now it\'s not. The conditions have changed." Ruth picked up her pen again. "I\'ll have a briefing file sent to your desk. Read it tonight. We\'ll talk Wednesday."')),
    para(t("The meeting was over. Elena stood, picked up her coat, and left the office. She did not ask what conditions had changed, because she already had a theory, and asking would just have confirmed it.")),
    hr(),
    para(t("She was at her desk that evening, the briefing file open in front of her, when her phone rang. The number was one she recognized instantly and had been half-expecting for months. She stared at it for three rings before answering.")),
    para(t('"Daniel," she said.')),
    para(t('"Hey." A pause. The sound of traffic somewhere behind him. "I\'m in the city."')),
    para(t("She looked at the briefing file on her desk. At the name on the cover sheet. At the address she had just been reading.")),
    para(t('"I know," she said. "I was going to call you."')),
    para(t('"I figured," Daniel said. "Same story?"')),
    para(t('"Same story," she said.')),
    para(t("Another pause. Longer this time.")),
    para(t('"Meet me tomorrow," he said. "Usual place. Eight."')),
    para(t('"I\'ll be there," she said.')),
    para(t("She hung up and sat for a moment with the phone in her hand. Then she went back to the briefing file and kept reading, because there was nothing else to do, and because the story wasn't going to understand itself.")),
    para(t("Later, walking home to her apartment on Mercer Street, she kept just close enough to the streetlamps to see a few steps ahead. The city was doing what cities do at night — loud and empty at the same time, full of a kind of sudden, complicated energy that she had learned not to trust. She turned her collar up and kept walking.")),
    ...generateFillParagraphs(28),
  ];
}

function chapter2(): TiptapNode[] {
  return [
    h1("Chapter 2: The Alderman Estate"),
    para(t("The briefing file told her the following: the Alderman family had been in the city for four generations. Their money came from shipping, then from real estate, then from a series of investments that the file described as \"diversified holdings,\" which Elena had learned to translate as \"nothing we can easily trace.\"")),
    para(
      t("The estate itself was a "),
      bold("three-story Victorian"),
      t(" on the north edge of the city, set back from the road behind a wrought iron gate and a line of old elms that had survived everything the decades had thrown at them. Elena had driven past it twice before, once on a story that went nowhere and once just to look. She had not been inside.")
    ),
    para(t("Ruth Alderman was the last of the family in any active sense. She was seventy-one years old and had spent forty of those years managing the family's interests with a precision that her predecessors had apparently lacked. She had never married. She had no children. She gave to several charities and appeared in the society pages three or four times a year, always in the same posture: upright, composed, slightly ahead of whoever was standing next to her.")),
    para(t("Her hair was silver — the kind of silver that had probably once been blonde, though Elena couldn't find any photographs early enough to confirm it. In every image she appeared controlled, patient, deliberate. The kind of woman who had decided long ago what she thought about most things and rarely revisited those decisions.")),
    para(t("Elena had met her once, briefly, at a charity event four years ago. Ruth had shaken her hand, asked what she was working on, and then moved on before Elena had finished answering. It had not felt rude. It had felt precise.")),
    hr(),
    para(t("She met Daniel the next morning at the coffee shop on Fielding Street, which they had been using as a meeting point for two years because it was loud, didn't have reliable wifi, and no one they knew would ever go there voluntarily.")),
    para(t("He looked like he had been traveling. There was a tiredness around his eyes that wasn't just lack of sleep — it was the longer kind, the accumulated kind, the kind that takes hold when you've been running from something and can't remember why you started.")),
    para(t('"You look terrible," Elena said.')),
    para(t('"Thank you," said Daniel. "You look exactly the same."')),
    para(t("She didn't ask where he had been. He didn't offer. This was the agreement they had arrived at, over time, without ever making it explicit.")),
    para(t('"I found something," he said. "In the shipping records. Pre-1990, mostly, but with connections to current structures. It\'s not just property, Elena. The diversified holdings — some of them are active. And someone has been very careful about what those activities look like from the outside."')),
    para(t('"How careful?" she said.')),
    para(t('"Careful enough that I almost missed it. And I was looking specifically."')),
    para(t("She watched him stir his coffee without drinking it. Daniel Cross was her younger brother by four years and her oldest source by far, though she tried never to think of it in those terms. They had not spoken for eight months before his call last night, which was not a record but was close.")),
    para(t('"Tommy Reyes pulled some financial records for me," she said. "Cross-referenced with the port authority logs from \'88 to \'94. There are gaps."')),
    para(t('"Where?"')),
    para(t('"South docks. Specifically, the section that got redeveloped in \'96."')),
    para(t("Daniel was quiet for a moment. Then he said: \"I know those records. That's where mine go cold too.\"")),
    para(t("They looked at each other across the table. The coffee shop made its noise around them, indifferent and steady.")),
    para(t('"Wednesday," she said. "Ruth wants to talk on Wednesday."')),
    para(t('"Don\'t tell her about the port records," Daniel said immediately.')),
    para(t('"I know," Elena said.')),
    para(t("He nodded. He drank his coffee. Outside, the city went about its business in the way it always did, which was to say: without any regard for whatever was quietly happening inside it.")),
    ...generateFillParagraphs(28),
  ];
}

function chapter3(): TiptapNode[] {
  return [
    h1("Chapter 3: Harbor Tuesday"),
    para(t("It was Tuesday evening when Elena went to the harbor district for the first time. She told no one she was going, which was either good instinct or bad habit — she had stopped being certain which.")),
    para(t("The south docks occupied a stretch of waterfront that had been redeveloped in the mid-nineties, the old warehouses converted into restaurants and boutique offices and an arts center that had opened to reviews describing it as \"transformative\" and closed three years later. What remained now was a mix: working dock on the east end, commercial development in the middle, a stretch of unused concrete and low light at the western edge where the redevelopment had stopped before it finished.")),
    para(t("She walked the western stretch twice, slowly, taking photographs with her phone of the building numbers and the signage and the gaps where signage should have been. The water was dark and flat beyond the barrier. The lights of the opposite shore made their usual promises.")),
    para(t("The records Tommy had pulled showed a series of transfers in this section — property changing hands in 1988, 1991, and 1993, all before the redevelopment, all connected through a chain of holding companies that simplified down, eventually, to a single registered address in the city. She had the address in her notebook. She had not yet gone there.")),
    para(t("She just kept walking. The important thing at this stage was not to understand — understanding came later, and always too fast once it arrived. The important thing was to see, to build up a physical sense of the space, so that when the pieces started connecting, they connected to something real.")),
    hr(),
    para(t("Daniel was waiting by the barrier at the eastern end. She hadn't told him she was coming. He hadn't told her he would be here. They had been doing this long enough that certain things no longer needed to be said.")),
    para(t('"You found the gap," he said.')),
    para(t('"Third building from the west end. The signage is new but the structure is older. Post-redevelopment but pre-renovation, if that makes sense."')),
    para(t('"It makes sense," he said. He was looking at the building, not at her. "I grew up just across from here. I used to walk this stretch as a kid."')),
    para(t("This was not something Elena had known. She filed it and kept moving.")),
    para(t('"The property transfer in \'91," she said. "Do you have documentation on the actual transaction? Not just the registration?"')),
    para(t('"Not yet. But I know who does."')),
    para(t("He told her the name. She wrote it down without repeating it aloud.")),
    para(t('"Be careful," Daniel said. "That name carries weight."')),
    para(t('"Whose weight?" she asked.')),
    para(t("He looked at her then, with the expression she recognized from childhood — the one that meant he had already thought through what she was about to think through, and he wished he hadn't.")),
    para(t('"Ruth Alderman\'s," he said.')),
    para(t("The harbor made its sounds. Somewhere a gull called once and was quiet. Elena looked at the building, at the new signage on the old structure, at the gap between what it said it was and what it had been.")),
    para(t('"Then we have a problem," she said.')),
    para(t('"Yes," said Daniel. "We do."')),
    para(t("They stood there for a while in the cold evening air, and then they walked back separately, the way they always did, which was another thing that had never needed to be agreed upon.")),
    ...generateFillParagraphs(24),
  ];
}

function chapter4(): TiptapNode[] {
  // Planted: "Thursday" timestamp (should be Friday after Tuesday), adverb spike, slow pacing
  const nodes: TiptapNode[] = [
    h1("Chapter 4: Three Days Later"),
    para(t("Three days later, on Thursday morning, Elena sat at her kitchen table on Mercer Street and read through everything she had, which was carefully organized into three folders and not quite enough.")),
    para(t("She carefully spread the folders across the table, deliberately laying them out in the order they had arrived. The briefing file from Ruth. The financial records that Tommy had carefully compiled. Her own notes from the harbor.")),
    para(t("She slowly poured herself a coffee and carefully considered each page in turn, trying deliberately to find a pattern that was not just the one she had already quietly decided was there.")),
  ];
  for (let i = 0; i < 6; i++) nodes.push(adverbParagraph(i));
  nodes.push(hr());
  nodes.push(para(t("She suddenly realized she had been sitting there for two hours. The coffee was cold. She carefully got up, walked slowly to the window, and stood there looking out at Mercer Street with its usual morning traffic.")));
  nodes.push(para(t("There was just enough information to suggest a shape, but not enough to confirm it. She just needed one more piece — just one thread that connected the shipping records to the current holding structure, and she would just have enough to take to print.")));
  nodes.push(para(t("She picked up her phone and just stared at it for a moment. She could call Daniel. She could carefully frame the question. She could just ask him what he thought. But they had just spoken two days ago, and she didn't want to appear suddenly desperate, which she wasn't, quite.")));
  for (let i = 6; i < 12; i++) nodes.push(adverbParagraph(i));
  nodes.push(para(t("She carefully returned to her folders, slowly turned to a fresh page in her notebook, and deliberately began to write out the timeline from the beginning. Carefully. Thoroughly. Just making sure she hadn't missed anything.")));
  for (let i = 0; i < 22; i++) nodes.push(fillParagraph());
  return nodes;
}

function chapter5(): TiptapNode[] {
  // Planted: adverb spike continues, slow introspection, Herald building
  const nodes: TiptapNode[] = [
    h1("Chapter 5: The Archive"),
    para(t("The Herald building had an archive on the fourth floor that most of the current staff had apparently forgotten existed. Elena had not forgotten. She went there deliberately on Friday afternoon, carefully signing the physical log at the entrance because the system carefully required it, even though no one ever carefully checked it.")),
    para(t("The archive smelled of carefully preserved paper and something faintly metallic that she had never quite identified. The shelving was dense, carefully labeled, running the full length of a long low room that was carefully climate-controlled to a temperature just slightly below comfortable.")),
  ];
  for (let i = 0; i < 5; i++) nodes.push(adverbParagraph(i + 3));
  nodes.push(hr());
  nodes.push(para(t("She suddenly found what she was looking for in a folder that had been carefully misfiled under the wrong year. It was not, strictly speaking, what she had come to find, but it was carefully adjacent — a clipping from a shipping industry newsletter, dated carefully to 1989, mentioning the south docks development in a way that suddenly connected two things she had carefully been thinking of as separate.")));
  nodes.push(para(t("She carefully photographed it with her phone and carefully replaced the folder exactly where she had found it, even though it was wrong. The archive had its own logic, and she carefully preferred not to suddenly disturb it.")));
  for (let i = 8; i < 15; i++) nodes.push(adverbParagraph(i));
  nodes.push(para(t("Upstairs, the newsroom just kept going in its usual way. Keyboards. Phones. Someone laughing about something she couldn't hear. The ordinary careful sound of people doing their jobs, which was, she had always carefully thought, one of the more reassuring sounds in the world.")));
  for (let i = 0; i < 24; i++) nodes.push(fillParagraph());
  return nodes;
}

function chapter6(): TiptapNode[] {
  // Planted: Alderman estate "four-story manor" (was "three-story Victorian" in Ch 2)
  //          Ruth's hair "grey-streaked" (was "silver" in Ch 2)
  //          Monotonous sentence length (~18 words each)
  const nodes: TiptapNode[] = [
    h1("Chapter 6: Ruth Again"),
    para(t("Elena drove to the Alderman estate on Saturday, the four-story manor sitting back from the road behind its iron gate.")),
  ];
  for (let i = 0; i < MONO_SENTENCES.length; i++) {
    nodes.push(monoParagraph(i));
    if (i === 9) nodes.push(hr());
  }
  nodes.push(para(
    t("Ruth turned from the window, and Elena noticed again the grey-streaked hair, the composed and deliberate posture, the quality of attention that made every room feel smaller.")
  ));
  nodes.push(para(t("Elena drove back through the city without turning on the radio, thinking about what Ruth had and had not said, and what the difference between those two things might mean.")));
  for (let i = 0; i < 22; i++) nodes.push(fillParagraph());
  return nodes;
}

function chapter7(): TiptapNode[] {
  // Planted: Elena's physical description confirmed (dark curly hair, green eyes); tension building; Mercer St
  const nodes: TiptapNode[] = [
    h1("Chapter 7: Night Work"),
    para(
      t("She caught her reflection in the darkened kitchen window — the dark, curly hair, the green eyes that looked, at this hour, less like the color of something specific and more like the color of the kind of attention that doesn't let go.")
    ),
    para(t("It was late. The apartment on Mercer Street was quiet in the way apartments get quiet when the rest of the building has gone to sleep but you haven't. The folders were still on the kitchen table. Her notebook was open to a page dense with arrows and bracketed names.")),
    para(t("She had been working for six hours and had arrived at a threshold — the point where more information would not make things clearer but would instead make them more complicated, which was a different thing. She was past that threshold now. What she needed was not more facts. What she needed was a frame.")),
    para(t("The Alderman story had two surfaces. The visible one: a family, property, money, the slow accumulation of things over time. The other surface: whatever was underneath that, which the shipping records and the archive clipping and Daniel's research were all pointing at, each from a different angle, like triangulation.")),
    hr(),
    para(t("She wrote the name at the center of a fresh page and drew a circle around it. Then she connected it outward: to the south docks, to the holding company address, to the 1991 transfer, to the newsletter clipping, to the gap in the port authority logs. She connected these to each other where they touched. She looked at what remained unconnected.")),
    para(t("The unconnected pieces were: the reason the story had been declared dead two years ago. Ruth's motive for reopening it now. And Daniel — where he had been for the eight months they hadn't spoken, and what he had found there.")),
    para(t("She stared at these three things for a long time. They were not unconnected to each other. They were connected in a way she didn't want to write down yet, because writing it down would mean committing to it, and she wasn't ready for that.")),
    para(t("Outside, Mercer Street was doing its late-night thing: a car passing slowly, a door closing somewhere up the block, the city's usual thin insomnia. She closed the notebook and left it on the table. She would need to sleep. Tomorrow, things would look different — or they would look the same, which would be its own kind of answer.")),
    ...generateFillParagraphs(28),
  ];
  return nodes;
}

function chapter8(): TiptapNode[] {
  // Planted: fast pacing, short sentences, harbor district, Herald building; action sequence
  return [
    h1("Chapter 8: The Harbor Breaks"),
    para(t("Her phone buzzed at 2 a.m. A message. No words. Just a location pin. The harbor district.")),
    para(t("She was there in twenty minutes.")),
    para(t("The western stretch was dark. She parked two blocks away. Went on foot.")),
    para(t("The building with the new signage. She had been right about the structure. Older than it looked. Much older.")),
    para(t("A light inside. Moving.")),
    para(t("She called the Herald night desk. Left a message. Gave her location.")),
    para(t("Then she went in anyway, because the alternative was standing outside until whoever was inside left, and that had never worked.")),
    hr(),
    para(t("Inside: boxes. Papers. A laptop, open and running. No one.")),
    para(t("She moved quickly. No time for careful. She photographed everything she could reach.")),
    para(t("The laptop screen: a spreadsheet. Columns she recognized from the financial records. Numbers she didn't. A date at the top: 1991.")),
    para(t("She photographed it. Her phone buzzed again. Unknown number.")),
    para(t("She didn't answer. She kept photographing.")),
    para(t("Sound from the back of the building. She went still.")),
    para(t("Footsteps. Slow. Not in a hurry. Someone who lived here, or thought they did.")),
    para(t("She moved to the side wall. Kept low. Kept quiet.")),
    para(t("The footsteps stopped. A door, somewhere. Then nothing.")),
    para(t("She waited three full minutes, counting seconds. Then she moved to the exit and left.")),
    para(t("Outside the air was cold and smelled of salt water and diesel. She walked fast. Didn't run. Running was for people who didn't know where they were going.")),
    para(t("She knew where she was going. The Herald building. The archive. The folder she had carefully misfiled.")),
    para(t("She knew now what she had missed. It was so simple it almost wasn't worth writing down.")),
    para(t("It was exactly the kind of truth that only becomes obvious after you've been looking at it from the wrong angle for months.")),
    ...generateFillParagraphs(22),
  ];
}

function chapter9(): TiptapNode[] {
  // Planted: Daniel returns; Tommy second mention; fast pacing continues
  return [
    h1("Chapter 9: Daniel Returns"),
    para(t("Daniel called at six in the morning.")),
    para(t('"You were at the harbor," he said.')),
    para(t('"Yes," she said.')),
    para(t('"You found the spreadsheet."')),
    para(t('"Yes."')),
    para(t("A pause. Shorter than usual.")),
    para(t('"That\'s the missing piece," he said.')),
    para(t('"I know," she said. "Where are you?"')),
    para(t('"Downstairs."')),
    hr(),
    para(t("He came up. She made coffee. They sat at the kitchen table with the folders and the notebook and the photographs she had taken in the building at the harbor. They went through everything together, which they had not done since before the eight months.")),
    para(t("He had been in Rotterdam. He told her this now, simply, without explanation or apology. There was a set of records there — shipping manifests from a company that no longer existed — that provided the link between the 1991 transfer and the current holding structure. He had photographs on his phone. They matched hers.")),
    para(t('"Tommy Reyes," Daniel said, looking at the financial cross-reference. "He pulled this?"')),
    para(t('"He\'s thorough," Elena said.')),
    para(t('"He\'s going to need to know. When we publish."')),
    para(t('"I know," she said. "I\'ll talk to him."')),
    para(t("They worked for four hours. The story came together the way stories do when they\'re ready: quickly, almost all at once, the pieces connecting so cleanly that it seemed impossible they had ever looked separate.")),
    para(t("At ten o\'clock, Elena called the Herald main desk and asked for Ruth\'s assistant. She left a message. She said she was ready to talk.")),
    para(t("She didn\'t say what about. Ruth would know.")),
    ...generateFillParagraphs(24),
  ];
}

function chapter10(): TiptapNode[] {
  // Resolution; harbor district; all arcs closed
  return [
    h1("Chapter 10: Resolution"),
    para(t("The story ran on a Wednesday, which felt appropriate, though she wasn't sure why. Front page, above the fold, with a second piece inside and a sidebar on the history of the south docks development. Tommy Reyes had a separate byline on the financial analysis, which she had fought for and which Ruth had, after a long silence, agreed to.")),
    para(t("Ruth herself had not spoken to Elena in the week between the conversation and publication. Her assistant had confirmed, formally, that certain factual claims would not be challenged. This was the closest thing to acknowledgment that Elena had expected, and it was enough.")),
    para(t("Daniel had left the city the morning after they'd finished the story. She had known he would. They had said goodbye the way they always did — briefly, without ceremony, with the particular efficiency of people who have said goodbye enough times to understand that it is not the last word on anything.")),
    para(t('"Rotterdam again?" she had asked.')),
    para(t('"Not this time," he said. "Something else. I\'ll call."')),
    para(t('"You\'ll call," she said.')),
    para(t("He had, in fact, called. The call had been brief and had confirmed he was somewhere with good coffee and slow internet, which was all she needed to know.")),
    hr(),
    para(t("She walked the harbor district one more time, a week after publication. The building with the new signage had acquired a notice in the window — a legal document, she assumed, or the beginning of one. The new signage looked slightly less certain of itself in the afternoon light.")),
    para(t("The water was the same. The lights on the opposite shore made the same promises. The western stretch of the dock was still a mix of working space and incomplete development and the particular kind of emptiness that belongs to places that have held other things.")),
    para(t("She stood at the barrier for a while, the way she had stood with Daniel, and thought about the story. About what it had taken to get here. About the pieces that had been obvious from the beginning and the pieces that had taken months.")),
    para(t("The story was done. The next one was not yet visible, which was fine. That was how it worked. You finished one thing and stood in the quiet that followed, and eventually you saw the beginning of the next shape forming, at the edge of what you could see.")),
    para(t("Elena turned up her collar and walked back toward the city, which was doing its usual thing — loud and complicated and indifferent — and she let it do it, because that was also part of the work.")),
    para(t("Tommy had sent her a message that morning. It said: \"Good piece. What's next?\" She had not answered yet. She was still standing in the quiet.")),
    para(t("She would answer soon. There was always a next. You could count on that, which was either the encouraging part or the exhausting part, depending on the day.")),
    para(t("Today it was the encouraging part.")),
    para(t("She kept walking.")),
    ...generateFillParagraphs(18),
  ];
}

// ---------------------------------------------------------------------------
// Fill helper — used by hand-crafted chapters to pad to word count
// ---------------------------------------------------------------------------

function generateFillParagraphs(count: number): TiptapElementNode[] {
  const nodes: TiptapElementNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push(fillParagraph());
    if (i > 0 && i < count - 1 && rand() < 0.15) {
      nodes.push(hr() as TiptapElementNode);
    }
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Assemble full document
// ---------------------------------------------------------------------------

function buildDocument(): TiptapDoc {
  const content: TiptapNode[] = [
    ...chapter1(),
    ...chapter2(),
    ...chapter3(),
    ...chapter4(),
    ...chapter5(),
    ...chapter6(),
    ...chapter7(),
    ...chapter8(),
    ...chapter9(),
    ...chapter10(),
  ];

  return { type: "doc", content };
}

// ---------------------------------------------------------------------------
// Word count
// ---------------------------------------------------------------------------

function countWords(nodes: TiptapNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "text" && "text" in node && node.text) {
      const trimmed = node.text.trim();
      if (trimmed.length > 0) count += trimmed.split(/\s+/).length;
    }
    if ("content" in node && node.content) {
      count += countWords(node.content);
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Serialize to plain text
// ---------------------------------------------------------------------------

function tiptapToTxt(doc: TiptapDoc): string {
  const lines: string[] = [];

  for (const node of doc.content) {
    if (node.type === "heading" && "attrs" in node && node.attrs?.level === 1) {
      const text = extractText(node as TiptapElementNode);
      // Use ALL-CAPS so txt-to-tiptap.ts parser detects as heading
      lines.push("\n" + text.toUpperCase() + "\n");
    } else if (node.type === "horizontalRule") {
      lines.push("\n* * *\n");
    } else if (node.type === "paragraph") {
      const text = extractText(node as TiptapElementNode);
      if (text.trim()) lines.push(text.trim());
    }
  }

  return lines.join("\n");
}

function extractText(node: TiptapElementNode): string {
  if (!node.content) return "";
  return node.content
    .map((n) => {
      if (n.type === "text" && "text" in n) return n.text || "";
      if ("content" in n && n.content) return extractText(n as TiptapElementNode);
      return "";
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Serialize to .docx
// ---------------------------------------------------------------------------

function buildDocx(doc: TiptapDoc): Document {
  const children: Paragraph[] = [];

  for (const node of doc.content) {
    if (node.type === "heading" && "attrs" in node && node.attrs?.level === 1) {
      const text = extractText(node as TiptapElementNode);
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text, bold: true })],
        })
      );
    } else if (node.type === "horizontalRule") {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "* * *" })],
        })
      );
    } else if (node.type === "paragraph") {
      const runs = buildRuns(node as TiptapElementNode);
      if (runs.length > 0) {
        children.push(new Paragraph({ children: runs }));
      }
    }
  }

  return new Document({
    sections: [{ properties: {}, children }],
    title: "The Weight of Quiet Hours",
    description: "Test manuscript for ManuHaven platform",
  });
}

function buildRuns(node: TiptapElementNode): TextRun[] {
  if (!node.content) return [];
  const runs: TextRun[] = [];
  for (const child of node.content) {
    if (child.type === "text" && "text" in child && child.text) {
      const marks = "marks" in child ? (child as TiptapTextNode).marks || [] : [];
      const isBold = marks.some((m) => m.type === "bold");
      const isItalic = marks.some((m) => m.type === "italic");
      runs.push(new TextRun({ text: child.text, bold: isBold, italics: isItalic }));
    }
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Generating "The Weight of Quiet Hours" test manuscript...');
  const start = performance.now();

  const doc = buildDocument();
  const words = countWords(doc.content);

  const outDir = __dirname;

  // JSON
  const jsonPath = path.join(outDir, "test-manuscript.json");
  writeFileSync(jsonPath, JSON.stringify(doc, null, 2));
  const jsonSizeKB = Math.round(Buffer.byteLength(JSON.stringify(doc)) / 1024);

  // TXT
  const txtContent = tiptapToTxt(doc);
  const txtPath = path.join(outDir, "test-manuscript.txt");
  writeFileSync(txtPath, txtContent, "utf-8");
  const txtSizeKB = Math.round(Buffer.byteLength(txtContent) / 1024);

  // DOCX
  const docxDoc = buildDocx(doc);
  const docxBuffer = await Packer.toBuffer(docxDoc);
  const docxPath = path.join(outDir, "test-manuscript.docx");
  writeFileSync(docxPath, docxBuffer);
  const docxSizeKB = Math.round(docxBuffer.byteLength / 1024);

  const elapsed = (performance.now() - start).toFixed(0);

  console.log(`\nDone in ${elapsed}ms`);
  console.log(`Word count: ~${words.toLocaleString()} words`);
  console.log(`\nOutputs:`);
  console.log(`  ${jsonPath} (${jsonSizeKB} KB)`);
  console.log(`  ${txtPath} (${txtSizeKB} KB)`);
  console.log(`  ${docxPath} (${docxSizeKB} KB)`);
  console.log(`\nPlanted features:`);
  console.log(`  Characters: Elena Marsh, Daniel Cross (gap Ch 4-8), Ruth Alderman, Tommy Reyes`);
  console.log(`  Locations: Herald building, Alderman estate (inconsistent floors), Mercer St, harbor`);
  console.log(`  Timeline error: Ch 3 = Tuesday, Ch 4 = "three days later on Thursday" (should be Friday)`);
  console.log(`  Editorial: overused words, adverb spike (Ch 4-5), monotonous sentences (Ch 6), pacing shifts`);
}

main().catch(console.error);
