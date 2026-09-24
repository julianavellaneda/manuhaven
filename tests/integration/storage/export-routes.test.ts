// The export routes against real Postgres and the fs driver, with the
// converter replaced by a stub: the converter gets cover bytes (never a URL
// or a credential), the rendered file lands under the owner's prefix, and the
// per-user throttle holds.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import { bookExports, projects } from "@/lib/db/schema";
import { saveManuscriptContent } from "@/lib/db/queries/manuscripts";
import { createProject, setProjectCover } from "@/lib/db/queries/projects";
import { listActiveTemplates } from "@/lib/db/queries/templates";
import type { ConvertRequest } from "@/lib/export/converter";
import { getStorage } from "@/lib/storage";
import { closeDb, createTestUser, removeTestUsers } from "../db/helpers";

const session = vi.hoisted(() => ({
  user: null as { id: string; email: string; name: string } | null,
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => session.user,
}));

const convert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/export/converter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/export/converter")>()),
  convert,
}));

const { ConverterError } = await import("@/lib/export/converter");
const { EXPORT_THROTTLE_MAX } = await import("@/lib/export/run-export");
const { POST: exportEpub } = await import("@/app/api/convert/epub/route");
const { POST: exportPdf } = await import("@/app/api/convert/pdf/route");
const { GET: getFile } = await import("@/app/api/files/[...key]/route");

const EPUB = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 4, 5]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
const DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "One" }] },
    { type: "paragraph", content: [{ type: "text", text: "The pier at dawn." }] },
  ],
};
const PRINT = { trimSize: "6x9", margins: "normal", fontSize: "medium" } as const;

let storageDir: string;
let alice: string;
let bob: string;
let aliceProject: string;
let templateId: string;

function as(userId: string | null) {
  session.user = userId ? { id: userId, email: "", name: "" } : null;
}

function post(handler: (req: Request) => Promise<Response>, body: unknown) {
  return handler(
    new Request("http://test/api", { method: "POST", body: JSON.stringify(body) }),
  );
}

function lastRequest(): ConvertRequest {
  return convert.mock.lastCall![1];
}

async function exportRows(projectId: string) {
  return getDb()
    .select()
    .from(bookExports)
    .where(eq(bookExports.projectId, projectId));
}

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "manuhaven-exports-"));
  vi.stubEnv("STORAGE_DRIVER", "fs");
  vi.stubEnv("STORAGE_DIR", storageDir);
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");
  ({ id: aliceProject } = await createProject(alice, { title: "Tides", genre: null }));
  await saveManuscriptContent(alice, aliceProject, {
    tiptapJson: DOC,
    wordCount: 5,
    chapters: [],
  });
  [{ id: templateId }] = await listActiveTemplates();
});

beforeEach(async () => {
  as(alice);
  convert.mockReset();
  convert.mockImplementation(async (format: string) => (format === "epub" ? EPUB : PDF));
  await getDb().delete(bookExports).where(eq(bookExports.projectId, aliceProject));
});

afterAll(async () => {
  await removeTestUsers(alice, bob);
  await closeDb();
  await rm(storageDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("EPUB export", () => {
  it("requires a session", async () => {
    as(null);
    expect((await post(exportEpub, { projectId: aliceProject, templateId })).status).toBe(401);
    expect(convert).not.toHaveBeenCalled();
  });

  it("stores the rendered file under the owner's prefix", async () => {
    const res = await post(exportEpub, { projectId: aliceProject, templateId });
    expect(res.status).toBe(200);
    const { fileUrl, fileSizeBytes, exportId } = await res.json();
    const key = `${alice}/${aliceProject}/exports/${exportId}.epub`;
    expect(fileUrl).toBe(`/api/files/${key}`);
    expect(fileSizeBytes).toBe(EPUB.byteLength);

    const [row] = await exportRows(aliceProject);
    expect(row).toMatchObject({ id: exportId, status: "complete", fileKey: key });

    const file = await getFile(new Request("http://test"), {
      params: Promise.resolve({ key: key.split("/") }),
    });
    expect(file.headers.get("content-type")).toBe("application/epub+zip");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(EPUB);

    const sent = lastRequest();
    expect(sent.html).toContain("The pier at dawn.");
    expect(sent.metadata.title).toBe("Tides");
    expect(sent.cover).toBeUndefined();
    // The converter gets content only: no storage paths, URLs or keys.
    expect(JSON.stringify(sent)).not.toMatch(/supabase|storagePath|http/i);
  });

  it("sends the cover as bytes", async () => {
    const coverKey = `${alice}/${aliceProject}/cover.png`;
    await getStorage().put(coverKey, PNG);
    await setProjectCover(alice, aliceProject, coverKey);
    try {
      expect((await post(exportEpub, { projectId: aliceProject, templateId })).status).toBe(200);
      expect(lastRequest().cover).toEqual({
        base64: Buffer.from(PNG).toString("base64"),
        contentType: "image/png",
      });
    } finally {
      await getDb()
        .update(projects)
        .set({ coverKey: null })
        .where(eq(projects.id, aliceProject));
    }
  });

  it("refuses another user's project without calling the converter", async () => {
    as(bob);
    expect((await post(exportEpub, { projectId: aliceProject, templateId })).status).toBe(404);
    expect(convert).not.toHaveBeenCalled();
    expect(await exportRows(aliceProject)).toEqual([]);
  });

  it("records a converter failure without leaking its response", async () => {
    convert.mockRejectedValue(new ConverterError(500));
    const res = await post(exportEpub, { projectId: aliceProject, templateId });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Conversion failed. Please try again." });
    const [row] = await exportRows(aliceProject);
    expect(row).toMatchObject({
      status: "failed",
      fileKey: null,
      errorMessage: "Converter returned 500",
    });
  });
});

describe("PDF export", () => {
  it("passes print settings and no cover", async () => {
    const res = await post(exportPdf, {
      projectId: aliceProject,
      templateId,
      printSettings: PRINT,
    });
    expect(res.status).toBe(200);
    const { exportId } = await res.json();
    expect(convert.mock.lastCall![0]).toBe("pdf");
    expect(lastRequest().printSettings).toEqual(PRINT);
    expect(await getStorage().get(`${alice}/${aliceProject}/exports/${exportId}.pdf`)).not.toBeNull();
  });

  it("rejects unknown print settings", async () => {
    const res = await post(exportPdf, {
      projectId: aliceProject,
      templateId,
      printSettings: { ...PRINT, trimSize: "a4" },
    });
    expect(res.status).toBe(400);
  });
});

describe("throttle", () => {
  it("refuses exports past the limit and does not count the refusal", async () => {
    const rows = Array.from({ length: EXPORT_THROTTLE_MAX }, () => ({
      projectId: aliceProject,
      format: "epub",
      templateId,
      status: "complete",
    }));
    await getDb().insert(bookExports).values(rows);

    const res = await post(exportEpub, { projectId: aliceProject, templateId });
    expect(res.status).toBe(429);
    expect(convert).not.toHaveBeenCalled();
    const processing = await getDb()
      .select()
      .from(bookExports)
      .where(
        and(eq(bookExports.projectId, aliceProject), eq(bookExports.status, "processing")),
      );
    expect(processing).toEqual([]);
    expect(await exportRows(aliceProject)).toHaveLength(EXPORT_THROTTLE_MAX);
  });
});
