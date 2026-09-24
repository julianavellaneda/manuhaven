// The authorization matrix: for every query function in lib/db/queries/,
// user B must not be able to read, change or delete anything user A owns.
// There is no RLS behind these functions, so this suite is the guarantee.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  aiUsageEvents,
  assistantConversations,
  bookExports,
} from "@/lib/db/schema";
import {
  createProject,
  getOwnedProject,
  listDashboardProjects,
  listProjectOptions,
  saveProjectAiMetadata,
  setProjectCover,
} from "@/lib/db/queries/projects";
import {
  claimAiCooldown,
  getManuscript,
  releaseAiCooldown,
  saveManuscriptContent,
  saveUploadedManuscript,
  updateManuscriptAi,
} from "@/lib/db/queries/manuscripts";
import {
  claimExport,
  countRecentExports,
  deleteExport,
  finishExport,
} from "@/lib/db/queries/exports";
import { listActiveTemplates } from "@/lib/db/queries/templates";
import {
  listProjectRoyalties,
  listRoyalties,
  upsertRoyalties,
  type RoyaltyImportRow,
} from "@/lib/db/queries/royalties";
import {
  archiveConversation,
  createConversation,
  getConversation,
  insertMessage,
  listConversations,
  listMessages,
  setConversationTitleIfUnset,
  touchConversation,
} from "@/lib/db/queries/assistant";
import {
  claimUsageEvent,
  completeUsageEvent,
  countRecentUsage,
} from "@/lib/db/queries/ai-usage";
import {
  getAiSettings,
  getAiSettingsWithCipher,
  saveAiSettings,
} from "@/lib/db/queries/ai-settings";
import { getProfile } from "@/lib/db/queries/users";
import { closeDb, createTestUser, removeTestUsers } from "./helpers";

const DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha." }] }],
};

const ROYALTY: RoyaltyImportRow = {
  retailer: "kobo",
  territory: null,
  unitsSold: 3,
  unitsReturned: 0,
  revenue: 9.99,
  currency: "USD",
  revenueUsd: 9.99,
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
};

let alice: string;
let bob: string;
let aliceProject: string;
let aliceConversation: string;
let aliceUsageEvent: string;

beforeAll(async () => {
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");

  ({ id: aliceProject } = await createProject(alice, {
    title: "Alice's Book",
    genre: "fantasy",
  }));
  await saveManuscriptContent(alice, aliceProject, {
    tiptapJson: DOC,
    wordCount: 1,
    chapters: [],
  });
  await upsertRoyalties(alice, aliceProject, [ROYALTY]);
  aliceConversation = await createConversation(alice, aliceProject);
  await insertMessage(alice, aliceConversation, {
    role: "user",
    content: { text: "Hello" },
  });
  aliceUsageEvent = await claimUsageEvent(alice, aliceProject, "assistant_chat");
  await saveAiSettings(alice, {
    provider: "anthropic",
    chatModel: null,
    utilityModel: null,
    autonomy: "lite",
    apiKeyCipher: "cipher-a",
    apiKeyHint: "sk-…a",
  });
});

afterAll(async () => {
  await removeTestUsers(alice, bob);
  await closeDb();
});

describe("projects", () => {
  it("hides another user's project", async () => {
    expect(await getOwnedProject(bob, aliceProject)).toBeNull();
    expect(await getOwnedProject(alice, aliceProject)).not.toBeNull();
  });

  it("lists only the caller's projects", async () => {
    expect(await listDashboardProjects(bob)).toEqual([]);
    expect(await listProjectOptions(bob)).toEqual([]);
    const board = await listDashboardProjects(alice);
    expect(board.map((p) => p.id)).toEqual([aliceProject]);
    expect(board[0].wordCount).toBe(1);
  });

  it("refuses to write AI metadata to another user's project", async () => {
    expect(await saveProjectAiMetadata(bob, aliceProject, { x: 1 })).toBe(false);
    const project = await getOwnedProject(alice, aliceProject);
    expect(project?.aiMetadata).toBeNull();
    const manuscript = await getManuscript(alice, aliceProject);
    expect(manuscript?.lastAiMetadataAt).toBeNull();
  });
});

describe("covers", () => {
  it("refuses to set a cover on another user's project", async () => {
    const result = await setProjectCover(
      bob,
      aliceProject,
      `${bob}/${aliceProject}/cover.png`,
    );
    expect(result).toBe(false);
    expect((await getOwnedProject(alice, aliceProject))?.coverKey).toBeNull();
  });

  it("reports the replaced cover key to the owner", async () => {
    const dana = await createTestUser("dana");
    const { id: projectId } = await createProject(dana, { title: "Cover", genre: null });
    const pngKey = `${dana}/${projectId}/cover.png`;
    expect(await setProjectCover(dana, projectId, pngKey)).toEqual({
      previousCoverKey: null,
    });
    expect(
      await setProjectCover(dana, projectId, `${dana}/${projectId}/cover.jpg`),
    ).toEqual({ previousCoverKey: pngKey });
    await removeTestUsers(dana);
  });
});

describe("manuscripts", () => {
  it("hides another user's manuscript", async () => {
    expect(await getManuscript(bob, aliceProject)).toBeNull();
  });

  it("refuses to overwrite another user's manuscript", async () => {
    const saved = await saveManuscriptContent(bob, aliceProject, {
      tiptapJson: { type: "doc", content: [] },
      wordCount: 0,
      chapters: [],
    });
    expect(saved).toBe(false);
    expect((await getManuscript(alice, aliceProject))?.tiptapJson).toEqual(DOC);
  });

  it("refuses to replace another user's manuscript with an upload", async () => {
    const saved = await saveUploadedManuscript(bob, aliceProject, {
      fileKey: `${bob}/${aliceProject}/manuscript/original.txt`,
      fileType: "txt",
      tiptapJson: { type: "doc", content: [] },
      wordCount: 0,
      chapters: [],
    });
    expect(saved).toBe(false);
    const manuscript = await getManuscript(alice, aliceProject);
    expect(manuscript?.fileKey).toBeNull();
    expect(manuscript?.tiptapJson).toEqual(DOC);
  });

  it("reports the replaced file key to the owner", async () => {
    const dana = await createTestUser("dana");
    const { id: projectId } = await createProject(dana, { title: "Upload", genre: null });
    const upload = {
      fileType: "txt" as const,
      tiptapJson: DOC,
      wordCount: 1,
      chapters: [],
    };
    const docxKey = `${dana}/${projectId}/manuscript/original.docx`;
    expect(
      await saveUploadedManuscript(dana, projectId, { ...upload, fileKey: docxKey }),
    ).toEqual({ previousFileKey: null });
    expect(
      await saveUploadedManuscript(dana, projectId, {
        ...upload,
        fileKey: `${dana}/${projectId}/manuscript/original.txt`,
      }),
    ).toEqual({ previousFileKey: docxKey });
    await removeTestUsers(dana);
  });

  it("refuses AI write-backs to another user's manuscript", async () => {
    const updated = await updateManuscriptAi(bob, aliceProject, {
      storyBible: { hijacked: true },
      lastAiContinuityAt: new Date(),
    });
    expect(updated).toBe(false);
    const manuscript = await getManuscript(alice, aliceProject);
    expect(manuscript?.storyBible).toBeNull();
    expect(manuscript?.lastAiContinuityAt).toBeNull();
  });

  it("refuses to claim or release another user's AI cooldown", async () => {
    expect(
      await claimAiCooldown(bob, aliceProject, "lastAiEditorialAt", 1000),
    ).toBeNull();

    const claim = await claimAiCooldown(
      alice,
      aliceProject,
      "lastAiMetadataAt",
      1000,
    );
    expect(claim?.ok).toBe(true);
    if (!claim?.ok) return;
    await releaseAiCooldown(bob, aliceProject, "lastAiMetadataAt", claim);
    const manuscript = await getManuscript(alice, aliceProject);
    expect(manuscript?.lastAiMetadataAt).toEqual(claim.stampedAt);
  });
});

describe("exports", () => {
  const since = new Date(Date.now() - 60_000);

  it("refuses to claim an export on another user's project", async () => {
    const [template] = await listActiveTemplates();
    const id = await claimExport(bob, {
      projectId: aliceProject,
      format: "epub",
      templateId: template.id,
    });
    expect(id).toBeNull();
    const rows = await getDb()
      .select()
      .from(bookExports)
      .where(eq(bookExports.projectId, aliceProject));
    expect(rows).toEqual([]);
  });

  it("keeps another user's exports out of reach", async () => {
    const [template] = await listActiveTemplates();
    const id = await claimExport(alice, {
      projectId: aliceProject,
      format: "pdf",
      templateId: template.id,
    });
    expect(id).not.toBeNull();

    expect(await countRecentExports(bob, since)).toBe(0);
    expect(await countRecentExports(alice, since)).toBe(1);

    expect(
      await finishExport(bob, id!, { status: "failed", errorMessage: "x" }),
    ).toBe(false);
    await deleteExport(bob, id!);
    const [row] = await getDb()
      .select()
      .from(bookExports)
      .where(eq(bookExports.id, id!));
    expect(row.status).toBe("processing");

    expect(
      await finishExport(alice, id!, {
        status: "complete",
        fileKey: "k",
        fileSizeBytes: 1,
      }),
    ).toBe(true);
    await deleteExport(alice, id!);
    expect(await countRecentExports(alice, since)).toBe(0);
  });
});

describe("royalties", () => {
  it("hides another user's royalties", async () => {
    expect(await listRoyalties(bob)).toEqual([]);
    expect(await listProjectRoyalties(bob, aliceProject)).toEqual([]);
    expect(await listRoyalties(alice)).toHaveLength(1);
  });

  it("refuses to import into another user's project", async () => {
    expect(await upsertRoyalties(bob, aliceProject, [ROYALTY])).toBe(false);
    expect(await listRoyalties(alice)).toHaveLength(1);
    expect(await listRoyalties(bob)).toEqual([]);
  });

  it("updates on re-import instead of duplicating, even with no territory", async () => {
    await upsertRoyalties(alice, aliceProject, [
      { ...ROYALTY, unitsSold: 5, revenueUsd: 14.99 },
    ]);
    const rows = await listRoyalties(alice);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ unitsSold: 5, revenueUsd: 14.99 });
  });
});

describe("assistant", () => {
  it("hides another user's conversations and messages", async () => {
    expect(await getConversation(bob, aliceConversation)).toBeNull();
    expect(await listConversations(bob, aliceProject)).toEqual([]);
    expect(await listMessages(bob, aliceConversation, 50)).toEqual([]);
    expect(await listMessages(alice, aliceConversation, 50)).toHaveLength(1);
  });

  it("refuses to post into another user's conversation", async () => {
    const posted = await insertMessage(bob, aliceConversation, {
      role: "user",
      content: { text: "injected" },
    });
    expect(posted).toBe(false);
    expect(await listMessages(alice, aliceConversation, 50)).toHaveLength(1);
  });

  it("refuses to rename, touch or archive another user's conversation", async () => {
    const before = await getConversation(alice, aliceConversation);
    await setConversationTitleIfUnset(bob, aliceConversation, "Hijacked");
    await touchConversation(bob, aliceConversation);
    expect(await archiveConversation(bob, aliceConversation)).toBe(false);

    const after = await getConversation(alice, aliceConversation);
    expect(after?.title).toBeNull();
    expect(after?.updatedAt).toEqual(before?.updatedAt);
  });

  it("only names a conversation once", async () => {
    const id = await createConversation(alice, aliceProject);
    await setConversationTitleIfUnset(alice, id, "First");
    await setConversationTitleIfUnset(alice, id, "Second");
    expect((await getConversation(alice, id))?.title).toBe("First");
  });

  it("makes an archived conversation invisible to its owner too", async () => {
    const id = await createConversation(alice, aliceProject);
    expect(await archiveConversation(alice, id)).toBe(true);
    expect(await getConversation(alice, id)).toBeNull();
    expect((await listConversations(alice, aliceProject)).map((c) => c.id))
      .not.toContain(id);
    expect(
      await insertMessage(alice, id, { role: "user", content: { text: "x" } }),
    ).toBe(false);
  });
});

describe("AI usage", () => {
  it("counts only the caller's events", async () => {
    const since = new Date(Date.now() - 60_000);
    expect(await countRecentUsage(bob, since)).toBe(0);
    expect(await countRecentUsage(alice, since)).toBeGreaterThanOrEqual(1);
  });

  it("refuses to complete another user's usage event", async () => {
    await completeUsageEvent(bob, aliceUsageEvent, {
      model: "forged",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const [event] = await getDb()
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, aliceUsageEvent));
    expect(event).toMatchObject({ model: null, inputTokens: 0 });
  });
});

describe("AI settings", () => {
  it("keeps settings per user and never exposes the cipher in the view", async () => {
    expect(await getAiSettings(bob)).toBeNull();
    expect(await getAiSettingsWithCipher(bob)).toBeNull();

    const view = await getAiSettings(alice);
    expect(view).toEqual({
      provider: "anthropic",
      chatModel: null,
      utilityModel: null,
      keyHint: "sk-…a",
      autonomy: "lite",
    });
    expect(JSON.stringify(view)).not.toContain("cipher-a");
  });

  it("does not touch another user's row when saving", async () => {
    const saved = await saveAiSettings(bob, {
      provider: "openai",
      chatModel: null,
      utilityModel: null,
      autonomy: "off",
      apiKeyCipher: "cipher-b",
      apiKeyHint: "sk-…b",
    });
    expect(JSON.stringify(saved)).not.toContain("cipher-b");
    expect((await getAiSettingsWithCipher(alice))?.apiKeyCipher).toBe(
      "cipher-a",
    );
  });

  it("keeps the stored key when the key fields are omitted", async () => {
    await saveAiSettings(alice, {
      provider: "anthropic",
      chatModel: "anthropic:claude-haiku-4-5",
      utilityModel: null,
      autonomy: "editorial",
    });
    const row = await getAiSettingsWithCipher(alice);
    expect(row?.apiKeyCipher).toBe("cipher-a");
    expect(row?.chatModel).toBe("anthropic:claude-haiku-4-5");
  });
});

describe("account deletion", () => {
  it("cascades to everything the user owns", async () => {
    const carol = await createTestUser("carol");
    const { id: projectId } = await createProject(carol, {
      title: "Doomed",
      genre: null,
    });
    const conversationId = await createConversation(carol, projectId);

    await removeTestUsers(carol);

    expect(await getProfile(carol)).toBeNull();
    const leftovers = await getDb()
      .select()
      .from(assistantConversations)
      .where(eq(assistantConversations.id, conversationId));
    expect(leftovers).toEqual([]);
  });
});
