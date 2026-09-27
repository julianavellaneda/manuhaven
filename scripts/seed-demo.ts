// Seeds a demo account for screenshots and the hosted demo:
//
//   bun run db:seed
//
// Signs in as demo@example.com / manuhaven-demo (replacing any previous demo
// account, and nothing else), with three Austen novels from Project Gutenberg,
// a finished editorial report, a story bible, an assistant conversation,
// writing stats and a year of royalties. No AI key or converter is needed:
// the AI results are fixed data from scripts/demo/analysis.ts.
//
// Runs through the app's own auth and query layer; the package.json script
// preloads scripts/server-only-stub.ts so the "server-only" guard lets it in.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getAuth } from "@/lib/auth/auth";
import {
  createConversation,
  insertMessage,
  setConversationTitleIfUnset,
} from "@/lib/db/queries/assistant";
import {
  saveManuscriptContent,
  saveUploadedManuscript,
  updateManuscriptAi,
} from "@/lib/db/queries/manuscripts";
import {
  createProject,
  saveProjectAiMetadata,
  setProjectCover,
  updateProjectDetails,
} from "@/lib/db/queries/projects";
import {
  upsertRoyalties,
  type RoyaltyImportRow,
} from "@/lib/db/queries/royalties";
import { deleteUser } from "@/lib/db/queries/users";
import type { ProjectStatus } from "@/lib/constants";
import type { WritingStatsPayload } from "@/lib/editor/use-autosave";
import {
  buildChapterSummary,
  countWordsInNodes,
  splitIntoChapters,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";
import { txtToTiptap } from "@/lib/manuscript/txt-to-tiptap";
import { getStorage } from "@/lib/storage";
import { coverKey, manuscriptKey } from "@/lib/storage/keys";

import {
  ASSISTANT_CONVERSATION,
  EDITORIAL_REPORT,
  METADATA,
  STORY_BIBLE,
  STYLE_ANALYSIS,
} from "./demo/analysis";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "manuhaven-demo";
const DEMO_DIR = path.join(process.cwd(), "scripts", "demo");

interface DemoBook {
  file: string;
  cover: string;
  title: string;
  genre: string;
  status: ProjectStatus;
  description: string;
  /** How many days of writing sessions to record. */
  writingDays: number;
}

const BOOKS: DemoBook[] = [
  {
    file: "pride-and-prejudice.txt",
    cover: "pride-and-prejudice-cover.png",
    title: "Pride and Prejudice",
    genre: "romance",
    status: "live",
    description:
      "Elizabeth Bennet, the sharpest of five sisters, and the proud Mr. Darcy misjudge each other, then slowly learn better.",
    writingDays: 120,
  },
  {
    file: "sense-and-sensibility.txt",
    cover: "sense-and-sensibility-cover.png",
    title: "Sense and Sensibility",
    genre: "literary",
    status: "formatting",
    description:
      "Two sisters, one all reason and one all feeling, face love and a sudden loss of fortune.",
    writingDays: 30,
  },
  {
    file: "persuasion.txt",
    cover: "persuasion-cover.png",
    title: "Persuasion",
    genre: "romance",
    status: "draft",
    description:
      "Eight years after being talked out of an engagement, Anne Elliot meets Captain Wentworth again.",
    writingDays: 9,
  },
];

/** Sign up the demo account, deleting a previous one first. */
async function createDemoUser(): Promise<string> {
  const auth = getAuth();
  const existing = await auth.api
    .signInEmail({ body: { email: DEMO_EMAIL, password: DEMO_PASSWORD } })
    .catch(() => null);
  if (existing) {
    await getStorage().deletePrefix(`${existing.user.id}/`);
    await deleteUser(existing.user.id);
  }
  const created = await auth.api.signUpEmail({
    body: { name: "Demo Author", email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  return created.user.id;
}

async function seedBook(userId: string, book: DemoBook): Promise<string> {
  const { id: projectId } = await createProject(userId, {
    title: book.title,
    genre: book.genre,
  });
  await updateProjectDetails(userId, projectId, {
    authorName: "Jane Austen",
    status: book.status,
    description: book.description,
  });

  const storage = getStorage();
  const text = await readFile(path.join(DEMO_DIR, book.file));
  const fileKey = manuscriptKey(userId, projectId, "txt");
  await storage.put(fileKey, text);
  const tiptapJson = txtToTiptap(text.toString("utf8")) as TiptapDoc;
  const body = {
    tiptapJson,
    wordCount: countWordsInNodes(tiptapJson.content),
    chapters: buildChapterSummary(splitIntoChapters(tiptapJson)),
  };
  await saveUploadedManuscript(userId, projectId, {
    ...body,
    fileKey,
    fileType: "txt",
  });
  await saveManuscriptContent(userId, projectId, {
    ...body,
    writingStats: writingStats(book.writingDays),
  });

  const key = coverKey(userId, projectId, "png");
  await storage.put(key, await readFile(path.join(DEMO_DIR, book.cover)));
  await setProjectCover(userId, projectId, key);

  return projectId;
}

/** Sessions ending today, with a few days off. */
function writingStats(days: number): WritingStatsPayload {
  const sessions: WritingStatsPayload["sessions"] = {};
  for (let daysAgo = 0; daysAgo < days; daysAgo++) {
    if (daysAgo % 7 === 5 || daysAgo % 11 === 3) continue;
    const day = new Date(Date.now() - daysAgo * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const words = 350 + ((daysAgo * 137) % 700);
    sessions[day] = { words, seconds: words * 4 };
  }
  return { sessions, dailyGoal: 500 };
}

const RETAILERS = [
  { retailer: "amazon", territory: "US", currency: "USD", rate: 1, share: 1 },
  { retailer: "amazon", territory: "GB", currency: "GBP", rate: 1.27, share: 0.3 },
  { retailer: "apple", territory: "US", currency: "USD", rate: 1, share: 0.35 },
  { retailer: "kobo", territory: "CA", currency: "CAD", rate: 0.73, share: 0.25 },
  { retailer: "streetlib", territory: "IT", currency: "EUR", rate: 1.08, share: 0.12 },
];

/** The last twelve full months, growing toward a launch-month spike. */
function royaltyRows(): RoyaltyImportRow[] {
  const rows: RoyaltyImportRow[] = [];
  const now = new Date();
  for (let i = 12; i >= 1; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const trend = 40 + (12 - i) * 14 + (i === 4 ? 90 : 0);
    for (const r of RETAILERS) {
      const unitsSold = Math.round(trend * r.share * (0.9 + ((i * 7) % 5) / 20));
      const revenueUsd = Math.round(unitsSold * 3.49 * 100) / 100;
      rows.push({
        retailer: r.retailer,
        territory: r.territory,
        unitsSold,
        unitsReturned: Math.floor(unitsSold / 40),
        revenue: Math.round((revenueUsd / r.rate) * 100) / 100,
        currency: r.currency,
        revenueUsd,
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10),
      });
    }
  }
  return rows;
}

async function main(): Promise<void> {
  const userId = await createDemoUser();
  const [pride] = await Promise.all(BOOKS.map((book) => seedBook(userId, book)));

  await updateManuscriptAi(userId, pride, {
    editorialReport: EDITORIAL_REPORT,
    styleAnalysis: STYLE_ANALYSIS,
    storyBible: STORY_BIBLE,
    lastAiEditorialAt: new Date(),
    lastAiContinuityAt: new Date(),
  });
  await saveProjectAiMetadata(userId, pride, METADATA);
  await upsertRoyalties(userId, pride, royaltyRows());

  const conversationId = await createConversation(userId, pride);
  await setConversationTitleIfUnset(
    userId,
    conversationId,
    ASSISTANT_CONVERSATION.title,
  );
  for (const message of ASSISTANT_CONVERSATION.messages) {
    await insertMessage(userId, conversationId, message);
  }

  console.log(`[seed] demo account ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    // Log the message only: a driver error can include the connection string.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed] failed: ${message}`);
    process.exit(1);
  },
);
